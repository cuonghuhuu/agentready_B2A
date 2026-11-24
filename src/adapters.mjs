import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePublicVariants } from './commerce-model.mjs';

export const SUPPORTED_FORMATS = ['auto', 'shopify', 'woocommerce', 'jsonld'];
export const DEFAULT_ALLOWED_ATTRIBUTES = Object.freeze([
  'color', 'colour', 'size', 'material', 'style', 'fit', 'pattern', 'finish',
  'capacity', 'volume', 'volume_ml', 'weight', 'dimensions', 'storage',
  'memory', 'ram', 'screen_size', 'connectivity', 'edition', 'flavor',
  'flavour', 'scent', 'scent_family', 'occasion', 'gender', 'age_group',
  'pack_size', 'length', 'width', 'height'
]);

const MAX_SOURCE_RECORDS = 5000;
const MAX_VARIANTS = 100;
const MAX_ATTRIBUTES = 30;
const FORBIDDEN_ATTR_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PRIVATE_STATUSES = new Set(['draft', 'private', 'archived', 'unpublished', 'internal', 'trash']);
const PRIVATE_VISIBILITIES = new Set(['hidden', 'private', 'internal', 'draft']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalSite(input) {
  assert(typeof input === 'string' && input.trim().length > 0, 'siteUrl must be a non-empty string');
  const u = new URL(input.trim());
  assert(['http:', 'https:'].includes(u.protocol), 'siteUrl must be http(s)');
  assert(u.username === '' && u.password === '', 'siteUrl must not contain credentials');
  assert(!u.search && !u.hash, 'siteUrl cannot include query or fragment');
  assert(u.pathname === '/' || u.pathname === '', 'siteUrl must be an origin (no path)');
  if (u.protocol === 'http:') {
    assert(['localhost', '127.0.0.1', '[::1]'].includes(u.hostname), 'Use https for non-localhost URLs');
  }
  return u.origin;
}

function safeLocalFile(project, relative, label) {
  assert(typeof relative === 'string' && relative.trim().length > 0, `${label} is required`);
  assert(!path.isAbsolute(relative) && !relative.split(/[\\/]+/).includes('..'), `${label} must remain inside project`);
  const root = path.resolve(project);
  const full = path.resolve(root, relative);
  assert(full.startsWith(root + path.sep), `${label} must remain inside project`);
  return full;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function assertNoSymlinkEscape(root, targetPath, label) {
  const realRoot = await fs.realpath(root);
  const rel = path.relative(path.resolve(root), path.resolve(targetPath));
  assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel), `${label} must remain inside project`);

  const segments = rel.split(path.sep);
  let cursor = path.resolve(root);
  for (let i = 0; i < segments.length; i++) {
    cursor = path.join(cursor, segments[i]);
    let st;
    try {
      st = await fs.lstat(cursor);
    } catch (err) {
      if (err.code === 'ENOENT') break;
      throw err;
    }
    if (st.isSymbolicLink()) {
      throw new Error(`${label} cannot traverse or target a symlink: ${segments.slice(0, i + 1).join('/')}`);
    }
  }
  return realRoot;
}

function stripHtml(value, max = 700) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function sanitizeId(rawId) {
  if (rawId === undefined || rawId === null) return '';
  return String(rawId)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function sanitizeAttributeKey(rawKey) {
  if (typeof rawKey !== 'string') return '';
  const cleaned = rawKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  if (!cleaned || FORBIDDEN_ATTR_KEYS.has(cleaned)) return '';
  return cleaned;
}

function resolveAllowedAttributes(customList) {
  if (customList === undefined) return new Set(DEFAULT_ALLOWED_ATTRIBUTES);
  assert(Array.isArray(customList), 'allowedAttributes must be an array of attribute keys');
  const set = new Set();
  for (const item of customList) {
    const key = sanitizeAttributeKey(item);
    assert(key.length > 0, `Invalid allowlisted attribute key: ${String(item)}`);
    set.add(key);
  }
  return set;
}

function setSafeAttribute(target, rawKey, rawValue, allowedSet, warnings, contextLabel) {
  if (Object.keys(target).length >= MAX_ATTRIBUTES) return false;
  const key = sanitizeAttributeKey(rawKey);
  if (!key) return false;
  if (!allowedSet.has(key)) {
    if (warnings) warnings.push(`Dropped non-allowlisted attribute "${key}" for ${contextLabel}`);
    return false;
  }
  if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') {
    if (warnings) warnings.push(`Dropped non-primitive attribute "${key}" for ${contextLabel}`);
    return false;
  }
  const val = typeof rawValue === 'string'
    ? stripHtml(rawValue, 200)
    : (typeof rawValue === 'number' && Number.isFinite(rawValue)) || typeof rawValue === 'boolean'
      ? String(rawValue).slice(0, 200)
      : '';
  if (!val) return false;
  target[key] = val;
  return true;
}

function normalizeCurrency(code, fallback) {
  const candidate = typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : fallback;
  if (!candidate || !/^[A-Z]{3}$/.test(candidate)) return null;
  return candidate;
}

function parsePrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

function parseWooMinorUnitPrice(rawValue, minorUnit) {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) return null;
  let digits;
  if (typeof rawValue === 'number') {
    if (!Number.isSafeInteger(rawValue) || rawValue < 0) return null;
    digits = String(rawValue);
  } else if (typeof rawValue === 'string') {
    const cleaned = rawValue.trim();
    if (!/^\d+$/.test(cleaned)) return null;
    digits = cleaned;
  } else {
    return null;
  }
  if (minorUnit === 0) {
    const n = Number(digits);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const padded = digits.padStart(minorUnit + 1, '0');
  const intPart = padded.slice(0, -minorUnit);
  const fracPart = padded.slice(-minorUnit);
  const n = Number(`${intPart}.${fracPart}`);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeSameOriginPath(rawUrl, origin) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim(), `${origin}/`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.origin !== origin) return null;
  if (parsed.hash) return null;
  return parsed.pathname + parsed.search;
}

function normalizeSchemaAvailability(raw) {
  if (typeof raw !== 'string') return null;
  const token = raw.trim().split('/').pop()?.toLowerCase() ?? '';
  if (token === 'instock' || token === 'onlineonly' || token === 'limitedavailability') return 'InStock';
  if (token === 'outofstock' || token === 'soldout' || token === 'discontinued') return 'OutOfStock';
  if (token === 'preorder' || token === 'presale' || token === 'backorder') return 'PreOrder';
  return null;
}

function pickRepresentativeOffer(offers) {
  const inStock = offers.filter((o) => o.availability === 'InStock');
  const preOrder = offers.filter((o) => o.availability === 'PreOrder');
  const pool = [...(inStock.length > 0 ? inStock : preOrder.length > 0 ? preOrder : offers)];
  pool.sort((a, b) => a.price - b.price);
  return pool[0];
}

function hasType(node, typeName) {
  const t = node?.['@type'];
  if (typeof t === 'string') return t === typeName;
  if (Array.isArray(t)) return t.includes(typeName);
  return false;
}

function isExplicitlyPrivateOrUnpublished(item) {
  if (!item || typeof item !== 'object') return true;
  if (item.published === false || item.public === false) return true;
  if (item.private === true || item.isPrivate === true || item.hidden === true || item.internal === true) return true;
  if (item.published_at === null) return true;
  if (typeof item.visibility === 'string' && PRIVATE_VISIBILITIES.has(item.visibility.trim().toLowerCase())) return true;
  if (typeof item.catalog_visibility === 'string' && PRIVATE_VISIBILITIES.has(item.catalog_visibility.trim().toLowerCase())) return true;
  if (typeof item.status === 'string' && PRIVATE_STATUSES.has(item.status.trim().toLowerCase())) return true;
  return false;
}

function isValidPastIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const ts = Date.parse(value);
  return !Number.isNaN(ts) && ts <= Date.now();
}

function hasReliableShopifyPublicationEvidence(item) {
  if (isExplicitlyPrivateOrUnpublished(item)) return false;
  if (typeof item.status === 'string' && item.status.trim().toLowerCase() !== 'active') return false;
  if (typeof item.published_at === 'string' && item.published_at.trim().length > 0) {
    return isValidPastIsoTimestamp(item.published_at);
  }
  return item.published === true;
}

function hasReliableShopifyVariantPublicationEvidence(variant, trustedPublicSource) {
  if (isExplicitlyPrivateOrUnpublished(variant)) return false;
  if (typeof variant.published_at === 'string' && variant.published_at.trim().length > 0) {
    return isValidPastIsoTimestamp(variant.published_at);
  }
  if (variant.published === true) return true;
  return trustedPublicSource === true;
}

export function detectCatalogFormat(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Array.isArray(raw.products)) {
      const sample = raw.products.find((item) => item && typeof item === 'object');
      if (!sample || 'handle' in sample || 'variants' in sample || 'body_html' in sample) {
        return 'shopify';
      }
    }
    if ('@context' in raw || '@type' in raw || Array.isArray(raw['@graph'])) {
      return 'jsonld';
    }
  }
  if (Array.isArray(raw)) {
    const sample = raw.find((item) => item && typeof item === 'object');
    if (sample) {
      if ('@type' in sample || '@context' in sample) return 'jsonld';
      if ('prices' in sample || 'is_in_stock' in sample || 'permalink' in sample) return 'woocommerce';
      if ('handle' in sample || 'variants' in sample || 'body_html' in sample) return 'shopify';
    }
  }
  throw new Error('Unable to detect catalog format. Pass --format shopify|woocommerce|jsonld explicitly.');
}

function normalizeShopify(raw, ctx) {
  const items = Array.isArray(raw) ? raw : raw?.products;
  assert(Array.isArray(items), 'Shopify export must be an array or an object with a products array');
  assert(items.length <= MAX_SOURCE_RECORDS, `Source catalog exceeds ${MAX_SOURCE_RECORDS} records`);

  const products = [];
  const skipped = [];
  const warnings = [];

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object') {
      skipped.push({ index, id: null, reason: 'Record is not an object' });
      continue;
    }
    const id = sanitizeId(item.handle || item.id);
    if (!hasReliableShopifyPublicationEvidence(item)) {
      skipped.push({
        index,
        id: id || null,
        reason: 'Missing reliable Shopify publication evidence (published_at timestamp or explicit published:true required)'
      });
      continue;
    }
    if (!id) {
      skipped.push({ index, id: null, reason: 'Missing safe product handle or id' });
      continue;
    }
    const name = stripHtml(item.title, 250);
    if (!name) {
      skipped.push({ index, id, reason: 'Missing product title' });
      continue;
    }
    const rawUrl = typeof item.url === 'string' && item.url.trim()
      ? item.url
      : (typeof item.handle === 'string' && item.handle.trim() ? `/products/${encodeURIComponent(item.handle.trim())}` : null);
    const url = normalizeSameOriginPath(rawUrl, ctx.origin);
    if (!url) {
      skipped.push({ index, id, reason: 'Product URL is missing or not same-origin' });
      continue;
    }

    const rawVariants = Array.isArray(item.variants) ? item.variants : [];
    if (rawVariants.length > MAX_VARIANTS) {
      skipped.push({
        index,
        id,
        reason: `Shopify product has ${rawVariants.length} variants, exceeding the canonical limit of ${MAX_VARIANTS}`
      });
      continue;
    }

    const optionNames = Array.isArray(item.options)
      ? item.options.map((opt) => sanitizeAttributeKey(typeof opt === 'string' ? opt : opt?.name))
      : [];
    const productHasRejectedOption = optionNames.some((key) => key && key !== 'title' && !ctx.allowedAttributes.has(key));

    const candidateVariants = [];
    const seenVariantIds = new Set();
    const seenVariantSkus = new Set();
    let parentCurrency = normalizeCurrency(item.currency, ctx.defaultCurrency);

    for (const [vIndex, variant] of rawVariants.entries()) {
      if (!variant || typeof variant !== 'object') {
        warnings.push(`Skipped non-object variant[${vIndex}] for product ${id}`);
        continue;
      }
      if (!hasReliableShopifyVariantPublicationEvidence(variant, ctx.trustedPublicSource)) {
        warnings.push(
          `Skipped variant ${variant.id ?? vIndex} for product ${id}: missing explicit variant publication evidence (set variant.published=true, variant.published_at, or pass trustedPublicSource:true for verified storefront exports)`
        );
        continue;
      }
      if (typeof variant.available !== 'boolean') {
        warnings.push(`Skipped variant ${variant.id ?? vIndex} for product ${id}: missing explicit boolean availability`);
        continue;
      }
      const vPrice = parsePrice(variant.price);
      if (vPrice === null) {
        warnings.push(`Skipped variant ${variant.id ?? vIndex} for product ${id}: invalid price`);
        continue;
      }
      const vCurrency = normalizeCurrency(variant.price_currency || item.currency, ctx.defaultCurrency);
      if (!vCurrency) {
        warnings.push(`Skipped variant ${variant.id ?? vIndex} for product ${id}: missing ISO 4217 currency`);
        continue;
      }
      if (!parentCurrency) parentCurrency = vCurrency;
      if (vCurrency !== parentCurrency) {
        warnings.push(`Skipped variant ${variant.id ?? vIndex} for product ${id}: currency ${vCurrency} differs from parent currency ${parentCurrency}`);
        continue;
      }
      const vId = sanitizeId(variant.id ?? variant.sku ?? `${id}-v${vIndex + 1}`);
      if (!vId || seenVariantIds.has(vId)) {
        warnings.push(`Skipped duplicate or invalid variant id for product ${id}`);
        continue;
      }
      const vSku = typeof variant.sku === 'string' ? variant.sku.trim().slice(0, 100) : '';
      if (vSku && seenVariantSkus.has(vSku)) {
        warnings.push(`Skipped duplicate variant SKU ${vSku} for product ${id}`);
        continue;
      }

      const vAttributes = {};
      const approvedOptionValues = [];
      let variantHadRejectedOption = productHasRejectedOption;
      const optionValues = [variant.option1, variant.option2, variant.option3];
      for (let i = 0; i < optionValues.length; i++) {
        const val = optionValues[i];
        if (val === undefined || val === null) continue;
        if (typeof val === 'string' && (!val.trim() || val.trim().toLowerCase() === 'default title')) continue;
        const key = optionNames[i] && optionNames[i] !== 'title' ? optionNames[i] : '';
        if (key) {
          const accepted = setSafeAttribute(vAttributes, key, val, ctx.allowedAttributes, warnings, `product ${id} variant ${vId}`);
          if (accepted) approvedOptionValues.push(vAttributes[key]);
          else variantHadRejectedOption = true;
        } else {
          variantHadRejectedOption = true;
        }
      }

      const vUrlCandidate = typeof variant.url === 'string' && variant.url.trim()
        ? variant.url
        : (variant.id !== undefined && variant.id !== null ? `${url}?variant=${encodeURIComponent(String(variant.id))}` : url);
      const vUrl = normalizeSameOriginPath(vUrlCandidate, ctx.origin);
      if (!vUrl) {
        warnings.push(`Skipped variant ${vId} for product ${id}: variant URL is not same-origin`);
        continue;
      }

      // If any Shopify option was rejected by the allowlist, construct the label strictly
      // from approved public options so rejected option values never leak through variant.title.
      const vLabel = variantHadRejectedOption
        ? approvedOptionValues.join(' / ').slice(0, 180)
        : stripHtml(variant.title, 180);

      seenVariantIds.add(vId);
      if (vSku) seenVariantSkus.add(vSku);

      candidateVariants.push({
        id: vId,
        published: true,
        ...(vSku ? { sku: vSku } : {}),
        ...(vLabel && vLabel.toLowerCase() !== 'default title' ? { label: vLabel } : {}),
        price: vPrice,
        currency: vCurrency,
        availability: variant.available ? 'InStock' : 'OutOfStock',
        url: vUrl,
        attributes: vAttributes
      });
    }

    if (candidateVariants.length === 0 || !parentCurrency) {
      skipped.push({
        index,
        id,
        reason: 'No valid public Shopify variants with publication evidence, price, matching currency, and explicit availability'
      });
      continue;
    }

    // Reuse the canonical V0.3 commerce-model validator as the single source of truth.
    let validatedVariants;
    try {
      validatedVariants = normalizePublicVariants(candidateVariants, {
        origin: ctx.origin,
        parentId: id,
        parentCurrency,
        parentUrl: url
      });
    } catch (err) {
      skipped.push({ index, id, reason: `Variant validation failed: ${err.message}` });
      continue;
    }

    if (!validatedVariants || validatedVariants.length === 0) {
      skipped.push({ index, id, reason: 'No validated public variants remained after canonical normalization' });
      continue;
    }

    const primary = pickRepresentativeOffer(validatedVariants);

    const rawImage = typeof item.images?.[0] === 'string' ? item.images[0] : item.images?.[0]?.src;
    let image;
    if (rawImage) {
      const safeImage = normalizeSameOriginPath(rawImage, ctx.origin);
      if (safeImage) image = safeImage;
      else warnings.push(`Omitted off-origin image for product ${id}`);
    }

    // Do NOT copy aggregated multi-variant option values onto parent attributes;
    // each variant carries its own allowlisted attributes to avoid cross-variant contamination.
    const attributes = {};

    products.push({
      id,
      published: true,
      name,
      url,
      description: stripHtml(item.body_html, 700),
      brand: stripHtml(item.vendor, 120),
      category: stripHtml(item.product_type, 120),
      sku: primary.sku || '',
      price: primary.price,
      currency: parentCurrency,
      availability: primary.availability,
      ...(image ? { image } : {}),
      attributes,
      variants: validatedVariants.map((v) => ({
        ...v,
        published: true,
        attributes: { ...v.attributes }
      }))
    });
  }

  return { products, skipped, warnings };
}

function normalizeWooCommerce(raw, ctx) {
  assert(Array.isArray(raw), 'WooCommerce Store API export must be a JSON array');
  assert(raw.length <= MAX_SOURCE_RECORDS, `Source catalog exceeds ${MAX_SOURCE_RECORDS} records`);

  const products = [];
  const skipped = [];
  const warnings = [];

  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object') {
      skipped.push({ index, id: null, reason: 'Record is not an object' });
      continue;
    }
    const id = sanitizeId(item.slug || (item.id !== undefined ? `wc-${item.id}` : ''));
    if (isExplicitlyPrivateOrUnpublished(item) || (typeof item.status === 'string' && item.status.trim().toLowerCase() !== 'publish')) {
      skipped.push({ index, id: id || null, reason: 'Product is private, hidden, or not publicly published' });
      continue;
    }
    if (!id) {
      skipped.push({ index, id: null, reason: 'Missing safe product slug or id' });
      continue;
    }
    const name = stripHtml(item.name, 250);
    if (!name) {
      skipped.push({ index, id, reason: 'Missing product name' });
      continue;
    }
    const rawUrl = typeof item.permalink === 'string' && item.permalink.trim()
      ? item.permalink
      : (typeof item.slug === 'string' && item.slug.trim() ? `/product/${encodeURIComponent(item.slug.trim())}` : null);
    const url = normalizeSameOriginPath(rawUrl, ctx.origin);
    if (!url) {
      skipped.push({ index, id, reason: 'Product permalink is missing or not same-origin' });
      continue;
    }

    let price = null;
    if (item.prices && typeof item.prices === 'object') {
      if (!Number.isInteger(item.prices.currency_minor_unit) || item.prices.currency_minor_unit < 0 || item.prices.currency_minor_unit > 6) {
        skipped.push({ index, id, reason: 'Missing or invalid WooCommerce currency_minor_unit' });
        continue;
      }
      price = parseWooMinorUnitPrice(item.prices.price, item.prices.currency_minor_unit);
    } else if (item.price !== undefined) {
      price = parsePrice(item.price);
    }
    if (price === null) {
      skipped.push({ index, id, reason: 'Missing valid public price' });
      continue;
    }

    const currency = normalizeCurrency(item.prices?.currency_code || item.currency, ctx.defaultCurrency);
    if (!currency) {
      skipped.push({ index, id, reason: 'Missing ISO 4217 currency code' });
      continue;
    }

    let availability = null;
    if (item.is_on_backorder === true) availability = 'PreOrder';
    else if (typeof item.is_in_stock === 'boolean') availability = item.is_in_stock ? 'InStock' : 'OutOfStock';
    if (!availability) {
      skipped.push({ index, id, reason: 'Missing explicit WooCommerce availability (is_in_stock or is_on_backorder)' });
      continue;
    }

    const rawImage = typeof item.images?.[0] === 'string' ? item.images[0] : item.images?.[0]?.src;
    let image;
    if (rawImage) {
      const safeImage = normalizeSameOriginPath(rawImage, ctx.origin);
      if (safeImage) image = safeImage;
      else warnings.push(`Omitted off-origin image for product ${id}`);
    }

    const category = Array.isArray(item.categories) && item.categories[0]?.name
      ? stripHtml(item.categories[0].name, 120)
      : '';
    const brand = Array.isArray(item.brands) && item.brands[0]?.name
      ? stripHtml(item.brands[0].name, 120)
      : '';

    const attributes = {};
    if (Array.isArray(item.attributes)) {
      for (const attr of item.attributes) {
        if (!attr || typeof attr !== 'object') continue;
        const terms = Array.isArray(attr.terms)
          ? attr.terms.map((t) => stripHtml(typeof t === 'string' ? t : t?.name, 80)).filter(Boolean)
          : Array.isArray(attr.options)
            ? attr.options.map((t) => (typeof t === 'string' || typeof t === 'number' ? stripHtml(String(t), 80) : '')).filter(Boolean)
            : [];
        if (terms.length > 0) {
          setSafeAttribute(attributes, attr.name || attr.taxonomy, terms.join(', '), ctx.allowedAttributes, warnings, `product ${id}`);
        }
      }
    }

    products.push({
      id,
      published: true,
      name,
      url,
      description: stripHtml(item.short_description || item.description, 700),
      brand,
      category,
      sku: typeof item.sku === 'string' ? item.sku.trim().slice(0, 100) : '',
      price,
      currency,
      availability,
      ...(image ? { image } : {}),
      attributes
    });
  }

  return { products, skipped, warnings };
}

function collectJsonLdProducts(node, out, ancestorPrivate = false) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdProducts(item, out, ancestorPrivate);
    return;
  }
  if (typeof node !== 'object') return;
  const isPrivate = ancestorPrivate || isExplicitlyPrivateOrUnpublished(node);
  if (Array.isArray(node['@graph'])) {
    collectJsonLdProducts(node['@graph'], out, isPrivate);
  }
  if (hasType(node, 'ItemList') && Array.isArray(node.itemListElement)) {
    for (const el of node.itemListElement) {
      if (el && typeof el === 'object') {
        const elPrivate = isPrivate || isExplicitlyPrivateOrUnpublished(el);
        collectJsonLdProducts(el.item || el, out, elPrivate);
      }
    }
    return;
  }
  if (hasType(node, 'Product')) {
    out.push({ item: node, ancestorPrivate });
  }
}

function extractOfferSummary(offers, fallbackCurrency) {
  const list = Array.isArray(offers) ? offers : (offers ? [offers] : []);
  const expanded = [];
  for (const offer of list) {
    if (!offer || typeof offer !== 'object' || isExplicitlyPrivateOrUnpublished(offer)) continue;
    if (hasType(offer, 'AggregateOffer')) {
      const price = parsePrice(offer.lowPrice ?? offer.price);
      const currency = normalizeCurrency(offer.priceCurrency, fallbackCurrency);
      const availability = normalizeSchemaAvailability(offer.availability);
      if (price !== null && currency && availability) {
        expanded.push({ price, currency, availability });
      }
      if (Array.isArray(offer.offers)) {
        for (const sub of offer.offers) {
          if (!sub || typeof sub !== 'object' || isExplicitlyPrivateOrUnpublished(sub)) continue;
          const sp = parsePrice(sub.price);
          const sc = normalizeCurrency(sub.priceCurrency, currency || fallbackCurrency);
          const sa = normalizeSchemaAvailability(sub.availability);
          if (sp !== null && sc && sa) {
            expanded.push({ price: sp, currency: sc, availability: sa });
          }
        }
      }
    } else {
      const price = parsePrice(offer.price);
      const currency = normalizeCurrency(offer.priceCurrency, fallbackCurrency);
      const availability = normalizeSchemaAvailability(offer.availability);
      if (price !== null && currency && availability) {
        expanded.push({ price, currency, availability });
      }
    }
  }
  if (expanded.length === 0) return null;

  // Never compare raw prices across different currencies.
  const currencies = new Set(expanded.map((o) => o.currency));
  if (currencies.size > 1) return { multiCurrencyConflict: true };

  // Keep price and availability internally consistent from the same representative offer.
  const chosen = pickRepresentativeOffer(expanded);
  return { price: chosen.price, currency: chosen.currency, availability: chosen.availability };
}

function normalizeJsonLd(raw, ctx) {
  const rawProducts = [];
  collectJsonLdProducts(raw, rawProducts, false);
  assert(rawProducts.length > 0, 'No Schema.org Product entries found in JSON-LD source');
  assert(rawProducts.length <= MAX_SOURCE_RECORDS, `Source catalog exceeds ${MAX_SOURCE_RECORDS} records`);

  const products = [];
  const skipped = [];
  const warnings = [];

  for (const [index, entry] of rawProducts.entries()) {
    const { item, ancestorPrivate } = entry;
    const rawUrl = typeof item.url === 'string' && item.url.trim()
      ? item.url
      : (typeof item.offers?.url === 'string' ? item.offers.url : null);
    const url = normalizeSameOriginPath(rawUrl, ctx.origin);
    const idSeed = item.sku || item.productID || item.mpn || item['@id'] || (url ? url.split('/').filter(Boolean).pop() : '') || item.name;
    const id = sanitizeId(idSeed);
    if (ancestorPrivate) {
      skipped.push({
        index,
        id: id || null,
        reason: 'Ancestor JSON-LD container is explicitly marked private, hidden, draft, or unpublished'
      });
      continue;
    }
    if (isExplicitlyPrivateOrUnpublished(item)) {
      skipped.push({
        index,
        id: id || null,
        reason: 'JSON-LD product is explicitly marked private, hidden, draft, or unpublished'
      });
      continue;
    }
    if (!id) {
      skipped.push({ index, id: null, reason: 'Missing safe product identifier' });
      continue;
    }
    const name = stripHtml(item.name, 250);
    if (!name) {
      skipped.push({ index, id, reason: 'Missing product name' });
      continue;
    }
    if (!url) {
      skipped.push({ index, id, reason: 'Product URL is missing or not same-origin' });
      continue;
    }
    const offer = extractOfferSummary(item.offers, ctx.defaultCurrency);
    if (!offer) {
      skipped.push({ index, id, reason: 'Missing valid public Schema.org Offer with price, currency, and recognized availability' });
      continue;
    }
    if (offer.multiCurrencyConflict) {
      skipped.push({ index, id, reason: 'Mixed offer currencies on one product are not supported without explicit conversion' });
      continue;
    }

    const rawImage = Array.isArray(item.image)
      ? (typeof item.image[0] === 'string' ? item.image[0] : item.image[0]?.url)
      : (typeof item.image === 'string' ? item.image : item.image?.url);
    let image;
    if (rawImage) {
      const safeImage = normalizeSameOriginPath(rawImage, ctx.origin);
      if (safeImage) image = safeImage;
      else warnings.push(`Omitted off-origin image for product ${id}`);
    }

    const brand = typeof item.brand === 'string'
      ? stripHtml(item.brand, 120)
      : stripHtml(item.brand?.name, 120);
    const category = typeof item.category === 'string' ? stripHtml(item.category, 120) : '';

    const attributes = {};
    if (typeof item.color === 'string' && item.color.trim()) {
      setSafeAttribute(attributes, 'color', item.color, ctx.allowedAttributes, warnings, `product ${id}`);
    }
    if (typeof item.material === 'string' && item.material.trim()) {
      setSafeAttribute(attributes, 'material', item.material, ctx.allowedAttributes, warnings, `product ${id}`);
    }
    if (Array.isArray(item.additionalProperty)) {
      for (const prop of item.additionalProperty) {
        if (!prop || typeof prop !== 'object') continue;
        setSafeAttribute(attributes, prop.name, prop.value, ctx.allowedAttributes, warnings, `product ${id}`);
      }
    }

    products.push({
      id,
      published: true,
      name,
      url,
      description: stripHtml(item.description, 700),
      brand,
      category,
      sku: typeof item.sku === 'string' ? item.sku.trim().slice(0, 100) : '',
      price: offer.price,
      currency: offer.currency,
      availability: offer.availability,
      ...(image ? { image } : {}),
      attributes
    });
  }

  return { products, skipped, warnings };
}

export function normalizeCatalog(raw, {
  format = 'auto',
  siteUrl,
  defaultCurrency,
  trustedPublicSource = false,
  allowedAttributes
} = {}) {
  assert(SUPPORTED_FORMATS.includes(format), `Unsupported format "${format}". Expected one of: ${SUPPORTED_FORMATS.join(', ')}`);
  const origin = canonicalSite(siteUrl);
  const currency = defaultCurrency !== undefined ? normalizeCurrency(defaultCurrency, null) : null;
  if (defaultCurrency !== undefined) {
    assert(currency !== null, 'defaultCurrency must be a valid ISO 4217 3-letter code');
  }
  const resolvedFormat = format === 'auto' ? detectCatalogFormat(raw) : format;
  const ctx = {
    origin,
    defaultCurrency: currency,
    trustedPublicSource: trustedPublicSource === true,
    allowedAttributes: resolveAllowedAttributes(allowedAttributes)
  };

  let result;
  if (resolvedFormat === 'shopify') result = normalizeShopify(raw, ctx);
  else if (resolvedFormat === 'woocommerce') result = normalizeWooCommerce(raw, ctx);
  else if (resolvedFormat === 'jsonld') result = normalizeJsonLd(raw, ctx);
  else throw new Error(`Unsupported format: ${resolvedFormat}`);

  const seenIds = new Set();
  const deduped = [];
  for (const product of result.products) {
    if (seenIds.has(product.id)) {
      result.skipped.push({ index: null, id: product.id, reason: `Duplicate normalized product id: ${product.id}` });
      continue;
    }
    seenIds.add(product.id);
    deduped.push(product);
  }
  deduped.sort((a, b) => a.id.localeCompare(b.id));

  return {
    format: resolvedFormat,
    origin,
    products: deduped,
    skipped: result.skipped,
    warnings: result.warnings
  };
}

export async function importCatalog(project, {
  source,
  format = 'auto',
  currency,
  force = false,
  trustedPublicSource = false,
  allowedAttributes
} = {}) {
  const root = path.resolve(project);
  const configPath = path.join(root, 'agentready.config.json');
  assert(await exists(configPath), `Missing agentready.config.json in ${root}. Run init first.`);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const sourcePath = safeLocalFile(root, source, 'source');
  const outputPath = safeLocalFile(root, config.publicProductsPath || 'data/agentready-products.json', 'publicProductsPath');

  const realRoot = await fs.realpath(root);
  const realSource = await fs.realpath(sourcePath);
  assert(realSource.startsWith(realRoot + path.sep), 'Source file must remain inside project (symlinks forbidden outside)');

  // Protect against symlink-based output escapes across ancestor directories and target file.
  await assertNoSymlinkEscape(root, outputPath, 'Output path');

  // Prevent destructive source/output path collisions (even when --force is passed).
  const outParent = path.dirname(outputPath);
  let resolvedOutput = outputPath;
  if (await exists(outputPath)) {
    resolvedOutput = await fs.realpath(outputPath);
  } else if (await exists(outParent)) {
    resolvedOutput = path.join(await fs.realpath(outParent), path.basename(outputPath));
  }
  assert(realSource !== resolvedOutput, 'Source and output paths must not resolve to the same file');
  assert(resolvedOutput !== await fs.realpath(configPath), 'Catalog output must not overwrite agentready.config.json');
  if (await exists(outputPath)) {
    const sourceStat = await fs.stat(realSource);
    const outputStat = await fs.stat(outputPath);
    const configStat = await fs.stat(configPath);
    assert(!(sourceStat.dev === outputStat.dev && sourceStat.ino === outputStat.ino), 'Source and output paths must not resolve to the same file');
    assert(!(configStat.dev === outputStat.dev && configStat.ino === outputStat.ino), 'Catalog output must not overwrite agentready.config.json');
  }

  if (!force && await exists(outputPath)) {
    throw new Error(`Refusing to overwrite ${outputPath}. Use --force to replace existing products file.`);
  }

  const raw = JSON.parse(await fs.readFile(realSource, 'utf8'));
  const normalized = normalizeCatalog(raw, {
    format,
    siteUrl: config.siteUrl,
    defaultCurrency: currency,
    trustedPublicSource,
    allowedAttributes
  });

  await fs.mkdir(outParent, { recursive: true });
  await assertNoSymlinkEscape(root, outputPath, 'Output path');
  const realOutDir = await fs.realpath(outParent);
  assert(realOutDir === realRoot || realOutDir.startsWith(realRoot + path.sep), 'Output directory must remain inside project');

  await fs.writeFile(outputPath, JSON.stringify(normalized.products, null, 2) + '\n', 'utf8');

  return {
    root,
    sourcePath: path.relative(root, sourcePath),
    outputPath: path.relative(root, outputPath),
    format: normalized.format,
    importedCount: normalized.products.length,
    skippedCount: normalized.skipped.length,
    skipped: normalized.skipped,
    warnings: normalized.warnings
  };
}
