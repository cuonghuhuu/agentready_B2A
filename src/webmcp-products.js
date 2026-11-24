/* AgentReady read-only WebMCP adapter.
 * Uses the WebMCPify runtime for feature detection and scoped registration.
 * Loads only the explicitly PUBLIC catalog snapshot; no cart or checkout access.
 * Load as a module after deploying the catalog and webmcpify-runtime.js.
 */
import { createToolScope } from './webmcpify-runtime.js';

if (typeof document !== 'undefined' && document.modelContext && !window.__agentreadyWebMcpRegistered) {
  window.__agentreadyWebMcpRegistered = true;
  const VALID_AVAILABILITY = new Set(['InStock', 'OutOfStock', 'PreOrder']);
  const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const failure = message => ({ isError: true, content: [{ type: 'text', text: message }] });
  const pickRepresentativeOffer = list => {
    const inStock = list.filter(v => v.availability === 'InStock');
    const preOrder = list.filter(v => v.availability === 'PreOrder');
    const pool = [...(inStock.length ? inStock : preOrder.length ? preOrder : list)];
    pool.sort((a, b) => a.price - b.price);
    return pool[0];
  };
  const summarizeOffer = v => ({
    id: v.id,
    ...(v.label ? { label: v.label } : {}),
    ...(v.sku ? { sku: v.sku } : {}),
    price: v.price,
    currency: v.currency,
    availability: v.availability
  });
  const simplify = (p, { details = false, matchingVariants = null } = {}) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const activePool = (!details && Array.isArray(matchingVariants) && matchingVariants.length > 0)
      ? matchingVariants
      : variants;
    const representative = activePool.length ? pickRepresentativeOffer(activePool) : null;
    const price = representative ? representative.price : p.price;
    const available = representative ? representative.availability : p.availability;
    return {
      id: p.id, name: p.name, brand: p.brand, category: p.category,
      price, currency: p.currency, availability: available,
      url: p.url, description: (p.description || '').slice(0, 250),
      attributes: p.attributes || {},
      ...(variants.length ? {
        variantCount: variants.length,
        priceRange: {
          min: Math.min(...activePool.map(v => v.price)),
          max: Math.max(...activePool.map(v => v.price))
        }
      } : {}),
      ...(!details && Array.isArray(matchingVariants) && matchingVariants.length ? {
        matchingOffers: matchingVariants.slice(0, 5).map(summarizeOffer)
      } : {}),
      ...(details && variants.length ? { variants } : {})
    };
  };

  async function catalog() {
    const response = await fetch('/agentready/catalog.json', { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('The public catalog is unavailable.');
    const body = await response.json();
    if (body.schemaVersion !== 'agentready.catalog.v0.1' || !Array.isArray(body.products)) {
      throw new Error('Unexpected AgentReady catalog schema.');
    }
    return body.products;
  }

  const guarded = handler => async args => {
    try { return await handler(args || {}); }
    catch { return failure('Unable to access the public product catalog.'); }
  };

  const scope = createToolScope('agentready-product-catalog', [
    {
      name: 'agentready_search_products',
      description: 'Search the website public product snapshot by name, brand, category, description, or variant details. Applies query, maxPrice, currency, and availability to the same matching variant and returns compact summaries (up to 10). Recheck live price and inventory before a purchase.',
      inputSchema: { type: 'object', properties: {
        query: { type: 'string', description: 'Search text (1-100 characters)' },
        maxPrice: { type: 'number', description: 'Optional maximum public price >= 0' },
        currency: { type: 'string', description: 'Optional ISO 4217 3-letter currency code; required when filtering by maxPrice in a multi-currency catalog' },
        availability: { type: 'string', enum: ['InStock', 'OutOfStock', 'PreOrder'], description: 'Optional availability filter' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Number of results, default 5' }
      }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: guarded(async ({ query, maxPrice, currency, availability, limit }) => {
        if (typeof query !== 'string' || query.trim().length < 1 || query.length > 100) return failure('Invalid search query.');
        if (maxPrice !== undefined && (typeof maxPrice !== 'number' || !Number.isFinite(maxPrice) || maxPrice < 0)) return failure('Invalid maxPrice.');
        let targetCurrency;
        if (currency !== undefined) {
          if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency.trim())) return failure('Invalid currency.');
          targetCurrency = currency.trim().toUpperCase();
        }
        if (availability !== undefined && (typeof availability !== 'string' || !VALID_AVAILABILITY.has(availability))) {
          return failure('Invalid availability.');
        }

        const max = Number.isInteger(limit) ? Math.min(10, Math.max(1, limit)) : 5;
        const terms = query.trim().toLocaleLowerCase().split(/\s+/);
        const products = await catalog();

        if (maxPrice !== undefined && targetCurrency === undefined) {
          const currencies = new Set();
          for (const p of products) {
            if (typeof p.currency === 'string' && p.currency) currencies.add(p.currency.toUpperCase());
            if (Array.isArray(p.variants)) {
              for (const v of p.variants) {
                if (typeof v.currency === 'string' && v.currency) currencies.add(v.currency.toUpperCase());
              }
            }
          }
          if (currencies.size > 1) {
            return failure('Catalog contains multiple currencies. Specify currency (ISO 4217) when filtering by maxPrice.');
          }
        }

        const matches = [];
        for (const p of products) {
          if (Array.isArray(p.variants) && p.variants.length > 0) {
            // Separate shared product-level fields from variant-specific attribute keys and sibling SKUs.
            const variantAttrKeys = new Set();
            const variantEntries = p.variants.map(v => {
              for (const key of Object.keys(v.attributes || {})) variantAttrKeys.add(key);
              const ownText = [v.label, v.sku, ...Object.values(v.attributes || {})]
                .join(' ')
                .toLocaleLowerCase();
              return { variant: v, ownText };
            });
            const sharedAttrs = Object.entries(p.attributes || {})
              .filter(([k]) => !variantAttrKeys.has(k))
              .map(([, val]) => val);
            const sharedParentText = [p.name, p.brand, p.category, p.description, ...sharedAttrs]
              .join(' ')
              .toLocaleLowerCase();

            // Terms that discriminate between variants (match some variants' own label/SKU/attributes
            // but not all) must match the candidate variant's own fields, preventing parent descriptions
            // like "Available in Black and Blue" from matching the wrong variant.
            const discriminatingTerms = new Set(
              terms.filter(t =>
                variantEntries.some(e => e.ownText.includes(t)) &&
                !variantEntries.every(e => e.ownText.includes(t))
              )
            );

            const matchingVariants = variantEntries
              .filter(({ variant: v, ownText }) => {
                const combinedText = `${sharedParentText} ${ownText}`;
                const matchesTerms = terms.every(t =>
                  discriminatingTerms.has(t) ? ownText.includes(t) : combinedText.includes(t)
                );
                const matchesCurrency = targetCurrency === undefined || v.currency === targetCurrency;
                const matchesPrice = maxPrice === undefined || v.price <= maxPrice;
                const matchesAvailability = availability === undefined || v.availability === availability;
                return matchesTerms && matchesCurrency && matchesPrice && matchesAvailability;
              })
              .map(e => e.variant);

            if (matchingVariants.length > 0) {
              matches.push({ product: p, matchingVariants });
            }
          } else {
            const flatText = [p.name, p.brand, p.category, p.sku, p.description, ...Object.values(p.attributes || {})]
              .join(' ')
              .toLocaleLowerCase();
            const matchesTerms = terms.every(t => flatText.includes(t));
            const matchesCurrency = targetCurrency === undefined || p.currency === targetCurrency;
            const matchesPrice = maxPrice === undefined || p.price <= maxPrice;
            const matchesAvailability = availability === undefined || p.availability === availability;
            if (matchesTerms && matchesCurrency && matchesPrice && matchesAvailability) {
              matches.push({ product: p, matchingVariants: null });
            }
          }
        }

        return result({
          totalMatches: matches.length,
          items: matches.slice(0, max).map(({ product, matchingVariants }) => simplify(product, { matchingVariants })),
          mode: 'public_snapshot'
        });
      })
    },
    {
      name: 'agentready_get_product',
      description: 'Get one public product by its exact id, using a published catalog snapshot. This is not a live stock or price confirmation.',
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Public product id' } }, required: ['id'], additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: guarded(async ({ id }) => {
        if (typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,120}$/.test(id)) return failure('Invalid id.');
        const products = await catalog();
        const product = products.find(p => p.id === id);
        return product ? result({ item: simplify(product, { details: true }), mode: 'public_snapshot' }) : failure('Product not found.');
      })
    }
  ], { validate: false, onError: () => { window.__agentreadyWebMcpRegistered = false; } });

  scope.ready.then(ready => {
    if (!ready) window.__agentreadyWebMcpRegistered = false;
  });
  window.addEventListener('pagehide', () => {
    scope();
    window.__agentreadyWebMcpRegistered = false;
  }, { once: true });
}
