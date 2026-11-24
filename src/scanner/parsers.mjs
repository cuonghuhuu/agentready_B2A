/**
 * Zero-dependency parsers for untrusted remote website content:
 * robots.txt, sitemap.xml, llms.txt, HTML semantics/readability,
 * Schema.org JSON-LD, AgentReady artifacts, and WebMCP static signals.
 */

const HTML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  copy: '(c)',
  reg: '(R)'
};

function decodeHtmlEntities(text) {
  return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const code = parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    if (lower.startsWith('#')) {
      const code = parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return HTML_ENTITIES[lower] ?? ' ';
  });
}

function parseAttributes(tagText) {
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = attrRegex.exec(tagText)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = decodeHtmlEntities(val).trim();
  }
  return attrs;
}

/**
 * Parses robots.txt according to RFC 9309 essentials.
 */
export function parseRobotsTxt(rawText) {
  const text = String(rawText || '');
  const lines = text.split(/\r?\n/);
  const groups = [];
  const sitemaps = [];
  let currentGroup = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const sepIdx = line.indexOf(':');
    if (sepIdx <= 0) continue;

    const field = line.slice(0, sepIdx).trim().toLowerCase();
    const value = line.slice(sepIdx + 1).trim();

    if (field === 'user-agent') {
      if (!currentGroup || currentGroup.rules.length > 0) {
        currentGroup = { agents: [], rules: [], crawlDelay: null };
        groups.push(currentGroup);
      }
      currentGroup.agents.push(value.toLowerCase());
    } else if (field === 'disallow' || field === 'allow') {
      if (!currentGroup) {
        currentGroup = { agents: ['*'], rules: [], crawlDelay: null };
        groups.push(currentGroup);
      }
      currentGroup.rules.push({ type: field, path: value });
    } else if (field === 'crawl-delay') {
      const delay = Number(value);
      if (currentGroup && Number.isFinite(delay) && delay >= 0) {
        currentGroup.crawlDelay = delay;
      }
    } else if (field === 'sitemap' && value) {
      sitemaps.push(value);
    }
  }

  function matchPattern(pathname, pattern) {
    if (pattern === '') return false;
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regexStr = pattern.endsWith('$')
      ? `^${escaped.slice(0, -2)}$`
      : `^${escaped}`;
    try {
      return new RegExp(regexStr).test(pathname);
    } catch {
      return pathname.startsWith(pattern);
    }
  }

  function isPathAllowed(pathname, userAgent = 'agentreadyscanner') {
    const targetUa = userAgent.toLowerCase();
    const specificGroups = groups.filter((g) => g.agents.some((a) => a !== '*' && targetUa.includes(a)));
    const wildcardGroups = groups.filter((g) => g.agents.includes('*'));
    const applicable = specificGroups.length > 0 ? specificGroups : wildcardGroups;

    if (applicable.length === 0) {
      return { allowed: true, matchedRule: null };
    }

    let bestMatch = null;
    for (const group of applicable) {
      for (const rule of group.rules) {
        if (!rule.path) continue; // empty Disallow means allow all
        if (matchPattern(pathname, rule.path)) {
          if (
            !bestMatch ||
            rule.path.length > bestMatch.path.length ||
            (rule.path.length === bestMatch.path.length && rule.type === 'allow')
          ) {
            bestMatch = rule;
          }
        }
      }
    }

    if (!bestMatch) {
      return { allowed: true, matchedRule: null };
    }
    return {
      allowed: bestMatch.type === 'allow',
      matchedRule: `${bestMatch.type === 'allow' ? 'Allow' : 'Disallow'}: ${bestMatch.path}`
    };
  }

  const rootCheck = isPathAllowed('/');
  return {
    present: text.trim().length > 0,
    groupCount: groups.length,
    sitemaps: Array.from(new Set(sitemaps)),
    blocksAll: !rootCheck.allowed,
    rootRule: rootCheck.matchedRule,
    isPathAllowed
  };
}

/**
 * Parses sitemap.xml (<urlset> or <sitemapindex>).
 */
export function parseSitemapXml(rawXml) {
  const xml = String(rawXml || '').trim();
  if (!xml) {
    return { valid: false, type: null, urlCount: 0, sampleUrls: [], error: 'Empty sitemap response.' };
  }

  const isUrlset = /<(?:\w+:)?urlset\b/i.test(xml);
  const isIndex = /<(?:\w+:)?sitemapindex\b/i.test(xml);
  if (!isUrlset && !isIndex) {
    return { valid: false, type: null, urlCount: 0, sampleUrls: [], error: 'Missing <urlset> or <sitemapindex> root element.' };
  }

  const locs = [];
  const locRegex = /<(?:\w+:)?loc\b[^>]*>([\s\S]*?)<\/(?:\w+:)?loc>/gi;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const loc = decodeHtmlEntities(match[1]).trim();
    if (loc) locs.push(loc);
  }

  return {
    valid: locs.length > 0,
    type: isIndex ? 'sitemapindex' : 'urlset',
    urlCount: locs.length,
    sampleUrls: locs.slice(0, 10),
    error: locs.length === 0 ? 'Sitemap XML contains zero <loc> entries.' : null
  };
}

/**
 * Parses llms.txt Markdown structure (title, summary, sections, links).
 */
export function parseLlmsTxt(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return { valid: false, title: null, summary: null, sections: [], links: [], mentionsAgentReady: false };
  }

  // Reject HTML pages accidentally returned with 200 OK for /llms.txt (SPA fallback)
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(text)) {
    return {
      valid: false,
      isHtmlFallback: true,
      title: null,
      summary: null,
      sections: [],
      links: [],
      mentionsAgentReady: false
    };
  }

  const lines = text.split(/\r?\n/);
  let title = null;
  let summary = null;
  const sections = [];
  const links = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!title && /^#\s+(.+)/.test(trimmed)) {
      title = trimmed.replace(/^#\s+/, '').trim();
    } else if (!summary && /^>\s+(.+)/.test(trimmed)) {
      summary = trimmed.replace(/^>\s+/, '').trim();
    } else if (/^##\s+(.+)/.test(trimmed)) {
      sections.push(trimmed.replace(/^##\s+/, '').trim());
    }

    const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let m;
    while ((m = linkRegex.exec(trimmed)) !== null) {
      links.push({ label: m[1].trim(), url: m[2].trim() });
    }
  }

  const mentionsAgentReady =
    /agentready/i.test(text) ||
    links.some((l) => /\/agentready\/|catalog\.json|manifest\.json/i.test(l.url));

  return {
    valid: Boolean(title || links.length > 0),
    isHtmlFallback: false,
    title,
    summary,
    sections,
    links,
    mentionsAgentReady
  };
}

/**
 * Extracts HTML metadata, semantic structure, readable text, JSON-LD blocks,
 * commerce page hints, and static WebMCP signals.
 */
export function parseHtmlDocument(rawHtml) {
  const html = String(rawHtml || '');

  // <html lang="...">
  const htmlTagMatch = html.match(/<html\b([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? parseAttributes(htmlTagMatch[1]) : {};
  const lang = htmlAttrs.lang || null;

  // <title>
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : null;

  // <meta> tags
  let metaDescription = null;
  const metaWebMcpSignals = [];
  const metaRegex = /<meta\b([^>]*)>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const attrs = parseAttributes(metaMatch[1]);
    const name = (attrs.name || attrs.property || '').toLowerCase();
    if (name === 'description' && attrs.content && !metaDescription) {
      metaDescription = attrs.content;
    }
    if (name.includes('webmcp') || name.includes('agentready')) {
      metaWebMcpSignals.push(`${name}=${attrs.content || ''}`);
    }
  }

  // <link> tags
  let canonicalUrl = null;
  const alternateLinks = [];
  const linkRegex = /<link\b([^>]*)>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const attrs = parseAttributes(linkMatch[1]);
    const rel = (attrs.rel || '').toLowerCase();
    if (rel.split(/\s+/).includes('canonical') && attrs.href && !canonicalUrl) {
      canonicalUrl = attrs.href;
    }
    if (rel.split(/\s+/).includes('alternate') && attrs.href) {
      alternateLinks.push({ href: attrs.href, type: attrs.type || '', title: attrs.title || '' });
    }
  }

  // <script> tags: JSON-LD and WebMCP signals
  const jsonLdBlocks = [];
  const scriptSrcs = [];
  const webMcpSignals = [...metaWebMcpSignals];

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let blockIndex = 0;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const attrs = parseAttributes(scriptMatch[1]);
    const content = scriptMatch[2] || '';
    const type = (attrs.type || '').toLowerCase().split(';')[0].trim();

    if (attrs.src) {
      scriptSrcs.push(attrs.src);
      if (/webmcp/i.test(attrs.src)) {
        webMcpSignals.push(`script[src="${attrs.src}"]`);
      }
    }

    if (type === 'application/ld+json') {
      blockIndex += 1;
      const trimmed = content.trim();
      try {
        const parsed = JSON.parse(trimmed);
        jsonLdBlocks.push({ index: blockIndex, valid: true, data: parsed, error: null });
      } catch (err) {
        jsonLdBlocks.push({
          index: blockIndex,
          valid: false,
          data: null,
          error: err.message,
          snippet: trimmed.slice(0, 140)
        });
      }
    } else if (content) {
      if (/\b(?:navigator|document)\.modelContext\b/.test(content)) {
        webMcpSignals.push('inline script references modelContext API');
      }
      if (/\bregisterTool\s*\(/.test(content)) {
        webMcpSignals.push('inline script calls registerTool()');
      }
      if (/\bcreateToolScope\s*\(/.test(content)) {
        webMcpSignals.push('inline script calls createToolScope()');
      }
    }
  }

  // Declarative WebMCP HTML attributes (toolname / tooldescription)
  if (/\btoolname\s*=\s*["'][^"']+["']/i.test(html)) {
    webMcpSignals.push('declarative HTML toolname attribute detected');
  }
  if (/\btooldescription\s*=\s*["'][^"']+["']/i.test(html)) {
    webMcpSignals.push('declarative HTML tooldescription attribute detected');
  }

  // Semantic HTML landmarks
  const landmarks = {
    main: /<main\b/i.test(html),
    header: /<header\b/i.test(html),
    nav: /<nav\b/i.test(html),
    article: /<article\b/i.test(html),
    section: /<section\b/i.test(html),
    footer: /<footer\b/i.test(html)
  };
  const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi) || [];

  // Images alt coverage
  const imgRegex = /<img\b([^>]*)>/gi;
  let imgCount = 0;
  let imgWithAlt = 0;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    imgCount += 1;
    const attrs = parseAttributes(imgMatch[1]);
    if (Object.hasOwn(attrs, 'alt') && attrs.alt.length > 0) {
      imgWithAlt += 1;
    }
  }

  // Readable textual content extraction
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const stripped = bodyHtml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const readableText = decodeHtmlEntities(stripped).replace(/\s+/g, ' ').trim();
  const words = readableText ? readableText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const textToHtmlRatio = html.length > 0 ? Number((readableText.length / html.length).toFixed(3)) : 0;

  const isLikelyJsShell =
    wordCount < 25 &&
    /(?:id=["'](?:root|app|__next|__nuxt)["']|enable javascript|javascript is required)/i.test(html);

  // Heuristic commerce signals on page
  const commerceHints = [];
  if (/(?:add to cart|buy now|shop now|checkout|thêm vào giỏ|mua ngay|sản phẩm|catalog)/i.test(readableText)) {
    commerceHints.push('commerce-copy-detected');
  }
  if (/(?:\$|€|£|¥|₫|USD|EUR|GBP|VND)\s?\d|\d[\d.,]*\s?(?:USD|EUR|GBP|VND|₫)/i.test(readableText)) {
    commerceHints.push('currency-price-text-detected');
  }
  if (/\/agentready\/catalog\.json/i.test(html)) {
    commerceHints.push('agentready-catalog-link-in-html');
  }

  return {
    lang,
    title,
    metaDescription,
    canonicalUrl,
    alternateLinks,
    scriptSrcs,
    jsonLdBlocks,
    webMcpSignals: Array.from(new Set(webMcpSignals)),
    landmarks,
    headingCounts: { h1: h1Matches.length, h2: h2Matches.length },
    images: { total: imgCount, withAlt: imgWithAlt },
    readability: {
      wordCount,
      charCount: readableText.length,
      textToHtmlRatio,
      isLikelyJsShell,
      excerpt: readableText.slice(0, 280)
    },
    commerceHints
  };
}

function normalizeTypes(rawType) {
  if (!rawType) return [];
  const arr = Array.isArray(rawType) ? rawType : [rawType];
  return arr.map((t) => String(t).replace(/^https?:\/\/schema\.org\//i, '').trim()).filter(Boolean);
}

function isSchemaOrgContext(ctx) {
  if (!ctx) return false;
  if (typeof ctx === 'string') return /schema\.org/i.test(ctx);
  if (Array.isArray(ctx)) return ctx.some((entry) => isSchemaOrgContext(entry));
  if (typeof ctx === 'object') {
    return Object.values(ctx).some((v) => typeof v === 'string' && /schema\.org/i.test(v));
  }
  return false;
}

/**
 * Analyzes Schema.org JSON-LD blocks (from HTML and/or /agentready/products.jsonld).
 */
export function analyzeStructuredData(jsonLdBlocks = [], externalJsonLd = null) {
  const validBlocks = jsonLdBlocks.filter((b) => b.valid && b.data);
  const invalidBlocks = jsonLdBlocks.filter((b) => !b.valid);

  const sources = validBlocks.map((b) => ({ source: 'html', data: b.data }));
  if (externalJsonLd && externalJsonLd.valid && externalJsonLd.data) {
    sources.push({ source: 'agentready-jsonld', data: externalJsonLd.data });
  }

  const entities = [];
  const schemaOrgContextDetected = sources.some((s) => isSchemaOrgContext(s.data?.['@context']));

  function collect(node, source, inheritedContext = false) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) collect(item, source, inheritedContext);
      return;
    }

    const hasCtx = inheritedContext || isSchemaOrgContext(node['@context']);
    const types = normalizeTypes(node['@type']);
    if (types.length > 0) {
      entities.push({ types, node, source, hasSchemaContext: hasCtx });
    }

    if (Array.isArray(node['@graph'])) {
      collect(node['@graph'], source, hasCtx);
    }
    if (Array.isArray(node.itemListElement)) {
      for (const el of node.itemListElement) {
        if (el && typeof el === 'object') {
          if (el.item) collect(el.item, source, hasCtx);
          else collect(el, source, hasCtx);
        }
      }
    }
  }

  for (const s of sources) {
    collect(s.data, s.source, isSchemaOrgContext(s.data?.['@context']));
  }

  const products = entities.filter((e) =>
    e.types.some((t) => t === 'Product' || t === 'ProductGroup' || t === 'ProductModel')
  );
  const siteEntities = entities.filter((e) =>
    e.types.some((t) => ['WebSite', 'Organization', 'Store', 'OnlineStore', 'LocalBusiness'].includes(t))
  );

  let productsWithCoreFields = 0;
  let offersFound = 0;
  let offersWithPriceAndCurrency = 0;
  let offersWithAvailability = 0;
  let productsWithVariants = 0;
  const currencies = new Set();

  for (const p of products) {
    const node = p.node;
    if (node.name && (node.description || node.sku || node.brand || node.image)) {
      productsWithCoreFields += 1;
    }

    const rawOffers = node.offers
      ? Array.isArray(node.offers)
        ? node.offers
        : [node.offers]
      : [];

    const hasVariants =
      (Array.isArray(node.hasVariant) && node.hasVariant.length > 0) ||
      rawOffers.length > 1 ||
      rawOffers.some((o) => Array.isArray(o?.offers) && o.offers.length > 1) ||
      p.types.includes('ProductGroup');
    if (hasVariants) productsWithVariants += 1;

    const flatOffers = [];
    for (const o of rawOffers) {
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o.offers)) {
        flatOffers.push(...o.offers);
      }
      flatOffers.push(o);
    }

    for (const offer of flatOffers) {
      if (!offer || typeof offer !== 'object') continue;
      offersFound += 1;
      const priceVal = offer.price ?? offer.lowPrice ?? offer.highPrice;
      const numericPrice = priceVal !== undefined && priceVal !== null && priceVal !== '' && Number.isFinite(Number(priceVal));
      const currency = typeof offer.priceCurrency === 'string' && /^[A-Z]{3}$/i.test(offer.priceCurrency.trim())
        ? offer.priceCurrency.trim().toUpperCase()
        : null;
      if (numericPrice && currency) {
        offersWithPriceAndCurrency += 1;
        currencies.add(currency);
      }
      if (typeof offer.availability === 'string' && /instock|outofstock|preorder|backorder|discontinued|limitedavailability/i.test(offer.availability)) {
        offersWithAvailability += 1;
      }
    }
  }

  return {
    totalBlocks: jsonLdBlocks.length + (externalJsonLd?.valid ? 1 : 0),
    validBlockCount: validBlocks.length + (externalJsonLd?.valid ? 1 : 0),
    invalidBlockCount: invalidBlocks.length + (externalJsonLd && !externalJsonLd.valid && externalJsonLd.attempted ? 1 : 0),
    invalidBlocks: invalidBlocks.map((b) => ({ index: b.index, error: b.error })),
    schemaOrgContextDetected,
    entityTypes: Array.from(new Set(entities.flatMap((e) => e.types))),
    productCount: products.length,
    productsWithCoreFields,
    siteEntityCount: siteEntities.length,
    offersFound,
    offersWithPriceAndCurrency,
    offersWithAvailability,
    productsWithVariants,
    currencies: Array.from(currencies)
  };
}

/**
 * Analyzes discovered AgentReady public manifest and catalog JSON files.
 */
export function analyzeAgentReadyCatalog(manifestData, catalogData) {
  const manifestValid = Boolean(
    manifestData &&
    typeof manifestData === 'object' &&
    (manifestData.catalog || manifestData.resources || manifestData.name || manifestData.siteName || manifestData.version)
  );

  const products = Array.isArray(catalogData?.products) ? catalogData.products : [];
  const catalogValid = Boolean(catalogData && typeof catalogData === 'object' && Array.isArray(catalogData.products));

  let withPriceAndCurrency = 0;
  let withAvailability = 0;
  let withVariants = 0;
  const currencies = new Set();

  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    const hasPrice = Number.isFinite(Number(p.price)) && typeof p.currency === 'string' && /^[A-Z]{3}$/i.test(p.currency);
    if (hasPrice) {
      withPriceAndCurrency += 1;
      currencies.add(p.currency.toUpperCase());
    }
    if (typeof p.availability === 'string' && p.availability.trim().length > 0) {
      withAvailability += 1;
    }
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      withVariants += 1;
    }
  }

  const manifestWebMcpRef = Boolean(
    manifestData &&
    (
      (typeof manifestData.webmcp === 'string' && manifestData.webmcp.length > 0) ||
      (manifestData.webmcp && typeof manifestData.webmcp === 'object') ||
      (typeof manifestData.resources?.webmcp === 'string') ||
      JSON.stringify(manifestData).toLowerCase().includes('webmcp')
    )
  );

  return {
    manifestValid,
    catalogValid,
    productCount: products.length,
    withPriceAndCurrency,
    withAvailability,
    withVariants,
    currencies: Array.from(currencies),
    manifestWebMcpRef
  };
}
