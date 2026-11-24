/**
 * Public commerce variant normalization (experimental v0.3 building block).
 * This deliberately does NOT accept arbitrary host-product fields.
 * Variant publication must be explicit, even when the parent is published.
 */
const MAX_VARIANTS = 100;
const MAX_ATTRIBUTES = 30;
const AVAILABILITY = new Set(['InStock', 'OutOfStock', 'PreOrder']);

function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

function text(value, name, maxLength) {
  assert(typeof value === 'string' && value.trim().length > 0,
    name + ' must be non-empty text');
  const normalized = value.trim();
  assert(normalized.length <= maxLength, name + ' is too long');
  return normalized;
}

function optionalText(value, name, maxLength) {
  return value === undefined || value === null || value === ''
    ? undefined
    : text(value, name, maxLength);
}

function publicUrl(value, origin, name) {
  const source = text(value, name, 2048);
  const parsed = new URL(source, origin + '/');
  assert(['https:', 'http:'].includes(parsed.protocol), name + ' must be http(s)');
  assert(parsed.origin === origin, name + ' must be same-origin');
  assert(!parsed.username && !parsed.password, name + ' cannot contain credentials');
  assert(!parsed.hash, name + ' cannot include a fragment');
  return parsed.pathname + parsed.search;
}

function publicAttributes(raw, label) {
  if (raw === undefined) return {};
  assert(raw && typeof raw === 'object' && !Array.isArray(raw),
    label + '.attributes must be an object');
  const fields = Object.entries(raw);
  assert(fields.length <= MAX_ATTRIBUTES, label + ' has too many attributes');
  const attributes = Object.create(null);
  for (const [key, value] of fields) {
    assert(/^[A-Za-z0-9_-]{1,50}$/.test(key) &&
      !['__proto__', 'constructor', 'prototype'].includes(key),
      label + ' has invalid attribute key');
    assert(['string', 'number', 'boolean'].includes(typeof value) &&
      (typeof value !== 'number' || Number.isFinite(value)),
      label + ' has invalid attribute value');
    const stringValue = String(value);
    assert(stringValue.length <= 200, label + ' attribute value is too long');
    attributes[key] = stringValue;
  }
  return attributes;
}

/**
 * Normalize an explicitly-public list of sellable variants.
 * Returns undefined if the parent has no variant input.
 * Prices are per-variant; only the same currency as the product is accepted
 * until multi-currency offer selection is implemented.
 */
export function normalizePublicVariants(raw, context) {
  if (raw === undefined) return undefined;
  const {origin, parentId, parentCurrency, parentUrl} = context;
  assert(Array.isArray(raw) && raw.length <= MAX_VARIANTS,
    'Product ' + parentId + ': variants must be an array of at most ' + MAX_VARIANTS);
  const variants = [];
  const ids = new Set();
  const skus = new Set();
  for (const [index, original] of raw.entries()) {
    assert(original && typeof original === 'object' && !Array.isArray(original),
      'Product ' + parentId + ': variant[' + index + '] must be an object');
    // A variant is never public solely because its parent is public.
    if (original.published !== true) continue;
    const label = 'Product ' + parentId + ': variant[' + index + ']';
    const id = text(original.id, label + '.id', 120);
    assert(/^[A-Za-z0-9._-]+$/.test(id), label + '.id contains invalid characters');
    assert(!ids.has(id), 'Duplicate public variant id: ' + parentId + '/' + id);
    ids.add(id);
    const sku = optionalText(original.sku, label + '.sku', 100);
    if (sku) {
      assert(!skus.has(sku), 'Duplicate public variant SKU: ' + parentId + '/' + sku);
      skus.add(sku);
    }
    const variantLabel = optionalText(original.label, label + '.label', 180);
    assert(typeof original.price === 'number' && Number.isFinite(original.price) &&
      original.price >= 0, label + '.price must be a nonnegative finite number');
    const currency = text(original.currency, label + '.currency', 3).toUpperCase();
    assert(/^[A-Z]{3}$/.test(currency), label + '.currency must be a 3-letter currency');
    assert(currency === parentCurrency,
      label + '.currency must match parent currency until multi-currency is supported');
    const availability = text(original.availability, label + '.availability', 25);
    assert(AVAILABILITY.has(availability), label + '.availability is invalid');
    const url = original.url === undefined
      ? parentUrl
      : publicUrl(original.url, origin, label + '.url');
    const attributes = publicAttributes(original.attributes, label);
    variants.push({
      id,
      ...(sku ? {sku} : {}),
      ...(variantLabel ? {label:variantLabel} : {}),
      price:original.price,
      currency,
      availability,
      url,
      attributes
    });
  }
  return variants;
}
