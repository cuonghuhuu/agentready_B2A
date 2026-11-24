import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { init, generate, verify } from '../src/core.mjs';
import { detectCatalogFormat, normalizeCatalog, importCatalog } from '../src/adapters.mjs';

const CLI_PATH = fileURLToPath(new URL('../bin/agentready.mjs', import.meta.url));

async function makeProject(t, siteUrl = 'https://store.example') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentready-adapter-'));
  t.after(() => fs.rm(dir, { force: true, recursive: true }));
  await init(dir, { siteName: 'Adapter Test Store', siteUrl });
  return dir;
}

async function loadWebMcpAdapter(t, catalogProvider, tag) {
  const regs = [];
  const listeners = new Map();
  globalThis.document = { modelContext: { registerTool: (tool, opts) => { regs.push({ tool, opts }); return Promise.resolve(); } } };
  globalThis.window = {
    addEventListener: (event, fn) => { listeners.set(event, fn); }
  };
  globalThis.fetch = async (uri) => {
    assert.equal(uri, '/agentready/catalog.json');
    return { ok: true, json: async () => catalogProvider() };
  };
  t.after(() => {
    listeners.get('pagehide')?.();
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.fetch;
  });
  await import(`${pathToFileURL(path.resolve('src/webmcp-products.js')).href}?${tag}=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return regs;
}

test('auto-detects Shopify, WooCommerce, and Schema.org JSON-LD exports', () => {
  assert.equal(detectCatalogFormat({ products: [{ handle: 'tee', title: 'Tee', variants: [] }] }), 'shopify');
  assert.equal(detectCatalogFormat([{ id: 10, name: 'Mug', prices: { price: '1200', currency_code: 'USD', currency_minor_unit: 2 } }]), 'woocommerce');
  assert.equal(detectCatalogFormat({ '@context': 'https://schema.org', '@type': 'Product', name: 'Lamp' }), 'jsonld');
  assert.throws(() => detectCatalogFormat({ unknown: true }), /Unable to detect/);
});

test('Shopify requires reliable publication evidence and never fabricates availability', () => {
  const result = normalizeCatalog(
    {
      products: [
        {
          id: 1,
          handle: 'missing-publication',
          title: 'Unverified Product',
          variants: [{ id: 11, sku: 'U-1', price: '25.00', available: true, published: true }]
        },
        {
          id: 2,
          handle: 'future-scheduled',
          title: 'Future Launch',
          published_at: '2099-01-01T00:00:00Z',
          variants: [{ id: 12, sku: 'F-1', price: '25.00', available: true, published: true }]
        },
        {
          id: 3,
          handle: 'draft-status',
          title: 'Draft Status Product',
          status: 'draft',
          published_at: '2026-01-01T00:00:00Z',
          variants: [{ id: 13, sku: 'D-1', price: '25.00', available: true, published: true }]
        },
        {
          id: 4,
          handle: 'missing-availability',
          title: 'Unknown Availability Product',
          published_at: '2026-01-01T00:00:00Z',
          variants: [{ id: 14, sku: 'M-1', price: '25.00', published: true }]
        }
      ]
    },
    { format: 'shopify', siteUrl: 'https://shop.example', defaultCurrency: 'USD' }
  );

  assert.equal(result.products.length, 0);
  assert.equal(result.skipped.length, 4);
  assert.match(result.skipped[0].reason, /publication evidence/i);
  assert.match(result.skipped[1].reason, /publication evidence/i);
  assert.match(result.skipped[2].reason, /publication evidence/i);
  assert.match(result.skipped[3].reason, /availability/i);
});

test('Shopify maps variant title to canonical label, respects commerce-model limits & duplicate SKU/currency checks, and passes generate+verify', async (t) => {
  const dir = await makeProject(t, 'https://shop.example');
  const overLimitVariants = Array.from({ length: 101 }, (_, idx) => ({
    id: 9000 + idx,
    title: `Variant ${idx}`,
    sku: `OVER-${idx}`,
    price: '10.00',
    available: true,
    published: true
  }));

  const shopifyExport = {
    products: [
      {
        id: 101,
        handle: 'linen-shirt',
        title: 'Linen Shirt',
        body_html: '<p>Breathable <strong>summer</strong> shirt &amp; relaxed fit.</p><script>alert(1)</script>',
        vendor: 'Atelier Demo',
        product_type: 'Apparel',
        published_at: '2026-01-10T00:00:00Z',
        customerEmail: 'leak@example.com',
        costPrice: 12,
        admin_graphql_api_id: 'gid://shopify/Product/101',
        options: [
          { name: 'Size', values: ['S', 'M', 'L'] },
          { name: 'Color', values: ['Sand', 'Navy'] }
        ],
        images: [{ src: 'https://cdn.shopify.com/s/files/linen-shirt.jpg' }],
        variants: [
          { id: 1, title: 'S / Sand', sku: 'LINEN-S-SAND', price: '49.00', available: false, published: true, option1: 'S', option2: 'Sand', cost_price: 8, inventory_quantity: 0 },
          { id: 2, title: 'M / Navy', sku: 'LINEN-M-NAVY', price: '54.50', available: true, published: true, option1: 'M', option2: 'Navy', cost_price: 9, inventory_quantity: 42 },
          { id: 3, title: 'M / Duplicate SKU', sku: 'LINEN-M-NAVY', price: '56.00', available: true, published: true, option1: 'M', option2: 'Navy' },
          { id: 4, title: 'L / Wrong Currency', sku: 'LINEN-L-EUR', price: '59.00', price_currency: 'EUR', available: true, published: true, option1: 'L', option2: 'Navy' },
          { id: 5, title: 'Hidden Staff Variant', sku: 'LINEN-STAFF', price: '1.00', available: true, published: false }
        ]
      },
      {
        id: 102,
        handle: 'too-many-variants',
        title: 'Over Limit Product',
        published_at: '2026-01-10T00:00:00Z',
        variants: overLimitVariants
      }
    ]
  };
  await fs.writeFile(path.join(dir, 'data/shopify-export.json'), JSON.stringify(shopifyExport));

  const res = await importCatalog(dir, {
    source: 'data/shopify-export.json',
    currency: 'USD',
    force: true
  });
  assert.equal(res.format, 'shopify');
  assert.equal(res.importedCount, 1);
  assert.equal(res.skippedCount, 1);
  assert.match(res.skipped[0].reason, /exceeding the canonical limit of 100/);
  assert.match(res.warnings.join('\n'), /Omitted off-origin image/);
  assert.match(res.warnings.join('\n'), /Skipped duplicate variant SKU LINEN-M-NAVY/);
  assert.match(res.warnings.join('\n'), /currency EUR differs from parent currency USD/);
  assert.match(res.warnings.join('\n'), /Skipped variant 5/);

  const imported = JSON.parse(await fs.readFile(path.join(dir, 'data/agentready-products.json'), 'utf8'));
  assert.equal(imported.length, 1);
  assert.equal(imported[0].id, 'linen-shirt');
  assert.deepEqual(imported[0].attributes, {});
  assert.equal(imported[0].variants.length, 2);
  assert.equal(imported[0].variants[0].label, 'S / Sand');
  assert.equal(imported[0].variants[0].title, undefined);
  assert.equal(imported[0].variants[1].label, 'M / Navy');
  assert.equal(imported[0].variants[1].attributes.size, 'M');
  assert.equal(imported[0].variants[1].attributes.color, 'Navy');
  assert.equal(imported[0].variants.every((v) => v.published === true), true);

  await generate(dir);
  assert.equal((await verify(dir)).ok, true);

  const catalogRaw = await fs.readFile(path.join(dir, 'public/agentready/catalog.json'), 'utf8');
  assert(!catalogRaw.includes('leak@example.com'));
  assert(!catalogRaw.includes('costPrice'));
  assert(!catalogRaw.includes('cost_price'));
  assert(!catalogRaw.includes('inventory_quantity'));
  assert(!catalogRaw.includes('admin_graphql_api_id'));
  assert(!catalogRaw.includes('LINEN-STAFF'));

  const markdown = await fs.readFile(path.join(dir, 'public/agentready/catalog.md'), 'utf8');
  assert(markdown.includes('S / Sand'));
  assert(markdown.includes('M / Navy'));
});

test('WooCommerce Store API adapter scales minor units accurately, rejects missing minor unit/availability, and passes generate+verify', async (t) => {
  const dir = await makeProject(t, 'https://woo.example');
  const wooExport = [
    {
      id: 201,
      name: 'Pour-Over Kettle',
      slug: 'pour-over-kettle',
      permalink: 'https://woo.example/product/pour-over-kettle',
      short_description: '<p>Precision gooseneck kettle.</p>',
      sku: 'KETTLE-01',
      prices: { price: '850000', currency_code: 'VND', currency_minor_unit: 0 },
      is_in_stock: true,
      categories: [{ name: 'Coffee Gear' }],
      brands: [{ name: 'BrewCo' }],
      images: [{ src: 'https://woo.example/wp-content/uploads/kettle.jpg' }],
      attributes: [{ name: 'Capacity', terms: [{ name: '600ml' }] }],
      internal_supplier_cost: 300000
    },
    {
      id: 202,
      name: 'Ceramic Dripper',
      slug: 'ceramic-dripper',
      permalink: 'https://woo.example/product/ceramic-dripper',
      short_description: 'Handcrafted dripper',
      sku: 'DRIP-02',
      prices: { price: '2499', currency_code: 'USD', currency_minor_unit: 2 },
      is_in_stock: false,
      is_on_backorder: true
    },
    {
      id: 203,
      name: 'Bahraini Spice Tin',
      slug: 'spice-tin',
      permalink: 'https://woo.example/product/spice-tin',
      prices: { price: '12345', currency_code: 'BHD', currency_minor_unit: 3 },
      is_in_stock: true
    },
    {
      id: 204,
      name: 'Missing Minor Unit',
      slug: 'bad-minor-unit',
      permalink: 'https://woo.example/product/bad-minor-unit',
      prices: { price: '1999', currency_code: 'USD' },
      is_in_stock: true
    },
    {
      id: 205,
      name: 'Missing Availability',
      slug: 'missing-availability',
      permalink: 'https://woo.example/product/missing-availability',
      prices: { price: '1999', currency_code: 'USD', currency_minor_unit: 2 }
    },
    {
      id: 206,
      name: 'Hidden Private Item',
      slug: 'hidden-item',
      permalink: 'https://woo.example/product/hidden-item',
      catalog_visibility: 'hidden',
      prices: { price: '1000', currency_code: 'USD', currency_minor_unit: 2 },
      is_in_stock: true
    },
    {
      id: 207,
      name: 'External Phishing Link',
      slug: 'evil-item',
      permalink: 'https://evil.example/steal',
      prices: { price: '1000', currency_code: 'USD', currency_minor_unit: 2 },
      is_in_stock: true
    }
  ];
  await fs.writeFile(path.join(dir, 'data/woo-export.json'), JSON.stringify(wooExport));

  const res = await importCatalog(dir, { source: 'data/woo-export.json', force: true });
  assert.equal(res.format, 'woocommerce');
  assert.equal(res.importedCount, 3);
  assert.equal(res.skippedCount, 4);

  const imported = JSON.parse(await fs.readFile(path.join(dir, 'data/agentready-products.json'), 'utf8'));
  assert.equal(imported.find((p) => p.id === 'pour-over-kettle').price, 850000);
  assert.equal(imported.find((p) => p.id === 'ceramic-dripper').price, 24.99);
  assert.equal(imported.find((p) => p.id === 'ceramic-dripper').availability, 'PreOrder');
  assert.equal(imported.find((p) => p.id === 'spice-tin').price, 12.345);

  await generate(dir);
  assert.equal((await verify(dir)).ok, true);
});

test('Schema.org JSON-LD rejects missing availability, mixed offer currencies, and unsafe URLs', async (t) => {
  const dir = await makeProject(t, 'https://catalog.example');
  const jsonLdExport = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@type': 'Product',
          sku: 'DESK-LAMP-1',
          name: 'Minimal Desk Lamp',
          url: 'https://catalog.example/products/desk-lamp',
          description: 'Warm LED task lamp.',
          brand: { '@type': 'Brand', name: 'LumenWorks' },
          color: 'Matte Black',
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: '79.00',
            highPrice: '99.00',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock'
          }
        }
      },
      {
        '@type': 'ListItem',
        position: 2,
        item: {
          '@type': 'Product',
          sku: 'NO-AVAIL',
          name: 'Missing Availability Item',
          url: 'https://catalog.example/products/no-avail',
          offers: { '@type': 'Offer', price: 29, priceCurrency: 'USD' }
        }
      },
      {
        '@type': 'ListItem',
        position: 3,
        item: {
          '@type': 'Product',
          sku: 'MIXED-CURR',
          name: 'Mixed Currency Offers',
          url: 'https://catalog.example/products/mixed-curr',
          offers: [
            { '@type': 'Offer', price: 20, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
            { '@type': 'Offer', price: 500000, priceCurrency: 'VND', availability: 'https://schema.org/InStock' }
          ]
        }
      },
      {
        '@type': 'ListItem',
        position: 4,
        item: {
          '@type': 'Product',
          sku: 'BAD-URL',
          name: 'Malicious Scheme Item',
          url: 'javascript:alert(1)',
          offers: { '@type': 'Offer', price: 10, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        }
      }
    ]
  };
  await fs.writeFile(path.join(dir, 'data/jsonld-export.json'), JSON.stringify(jsonLdExport));

  const res = await importCatalog(dir, { source: 'data/jsonld-export.json', force: true });
  assert.equal(res.format, 'jsonld');
  assert.equal(res.importedCount, 1);
  assert.equal(res.skippedCount, 3);
  assert.match(res.skipped.map((s) => s.reason).join('\n'), /Mixed offer currencies/);

  await generate(dir);
  assert.equal((await verify(dir)).ok, true);
});

test('safe: blocks source/output collision, overwrite without --force, path traversal, and output symlink escapes', async (t) => {
  const dir = await makeProject(t, 'https://safe.example');
  const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentready-outside-'));
  t.after(() => fs.rm(outsideDir, { force: true, recursive: true }));

  const outsideFile = path.join(outsideDir, 'secret.json');
  await fs.writeFile(outsideFile, JSON.stringify({ products: [] }));
  await fs.symlink(outsideFile, path.join(dir, 'data/escape-in.json'));

  const validSource = path.join(dir, 'data/valid-shopify.json');
  await fs.writeFile(validSource, JSON.stringify({
    products: [{ handle: 'item-1', title: 'Item 1', published_at: '2026-01-01T00:00:00Z', variants: [{ id: 1, price: '10.00', available: true, published: true }] }]
  }));

  await assert.rejects(
    () => importCatalog(dir, { source: 'data/valid-shopify.json', currency: 'USD', force: false }),
    /Refusing to overwrite/
  );
  await assert.rejects(
    () => importCatalog(dir, { source: 'data/agentready-products.json', currency: 'USD', force: true }),
    /must not resolve to the same file/
  );
  await assert.rejects(
    () => importCatalog(dir, { source: '../secret.json', currency: 'USD', force: true }),
    /must remain inside project/
  );
  await assert.rejects(
    () => importCatalog(dir, { source: 'data/escape-in.json', currency: 'USD', force: true }),
    /symlinks forbidden outside/
  );

  // Output symlink escape in importCatalog
  await fs.rm(path.join(dir, 'data/agentready-products.json'));
  await fs.symlink(path.join(outsideDir, 'pwned.json'), path.join(dir, 'data/agentready-products.json'));
  await assert.rejects(
    () => importCatalog(dir, { source: 'data/valid-shopify.json', currency: 'USD', force: true }),
    /cannot traverse or target a symlink/
  );

  // Output symlink escape in core generate()
  await fs.rm(path.join(dir, 'data/agentready-products.json'));
  await importCatalog(dir, { source: 'data/valid-shopify.json', currency: 'USD', force: true });
  await fs.symlink(outsideDir, path.join(dir, 'public'));
  await assert.rejects(() => generate(dir, { force: true }), /Refusing to write through symlink/);
});

test('WebMCP search applies query, price, currency, and availability to the same matching variant and returns compact summaries', async (t) => {
  const dir = await makeProject(t, 'https://cli-shop.example');
  await fs.writeFile(
    path.join(dir, 'data/shopify.json'),
    JSON.stringify({
      products: [
        {
          handle: 'canvas-tote',
          title: 'Canvas Tote',
          vendor: 'Demo Co',
          product_type: 'Bags',
          published_at: '2026-01-01T00:00:00Z',
          options: [{ name: 'Color', values: ['Natural', 'Olive'] }],
          variants: [
            { id: 501, title: 'Natural', sku: 'TOTE-NAT', price: '28.00', available: true, option1: 'Natural' },
            { id: 502, title: 'Olive', sku: 'TOTE-OLV', price: '32.00', available: false, option1: 'Olive' }
          ]
        }
      ]
    })
  );

  const importOut = JSON.parse(
    execFileSync(process.execPath, [
      CLI_PATH, 'import',
      '--project', dir,
      '--source', 'data/shopify.json',
      '--currency', 'USD',
      '--trusted-public-source',
      '--force'
    ], { encoding: 'utf8' })
  );
  assert.equal(importOut.format, 'shopify');
  assert.equal(importOut.importedCount, 1);

  const genOut = JSON.parse(
    execFileSync(process.execPath, [CLI_PATH, 'generate', '--project', dir], { encoding: 'utf8' })
  );
  assert.equal(genOut.productCount, 1);

  const verifyOut = JSON.parse(
    execFileSync(process.execPath, [CLI_PATH, 'verify', '--project', dir], { encoding: 'utf8' })
  );
  assert.equal(verifyOut.ok, true);

  const catalog = JSON.parse(await fs.readFile(path.join(dir, 'public/agentready/catalog.json'), 'utf8'));
  let activeCatalog = catalog;
  const regs = await loadWebMcpAdapter(t, () => activeCatalog, 'v3');

  assert.equal(regs.length, 2);
  assert(regs.every((r) => r.tool.annotations.readOnlyHint === true));
  const search = regs.find((r) => r.tool.name === 'agentready_search_products').tool;
  const get = regs.find((r) => r.tool.name === 'agentready_get_product').tool;

  const tooExpensive = JSON.parse((await search.execute({ query: 'TOTE-OLV', maxPrice: 30 })).content[0].text);
  assert.equal(tooExpensive.totalMatches, 0);

  const wrongAvail = JSON.parse((await search.execute({ query: 'TOTE-OLV', availability: 'InStock' })).content[0].text);
  assert.equal(wrongAvail.totalMatches, 0);

  const matched = JSON.parse((await search.execute({ query: 'TOTE-OLV', maxPrice: 35, currency: 'USD' })).content[0].text);
  assert.equal(matched.totalMatches, 1);
  assert.equal(matched.items[0].price, 32);
  assert.equal(matched.items[0].availability, 'OutOfStock');
  assert.equal(matched.items[0].variantCount, 2);
  assert.equal(Object.hasOwn(matched.items[0], 'variants'), false);
  assert.equal(matched.items[0].matchingOffers.length, 1);
  assert.equal(matched.items[0].matchingOffers[0].sku, 'TOTE-OLV');

  const details = JSON.parse((await get.execute({ id: 'canvas-tote' })).content[0].text).item;
  assert.equal(details.variants.length, 2);
  assert.equal(details.variants[0].label, 'Natural');
  assert.equal(details.variants[1].label, 'Olive');

  activeCatalog = {
    ...catalog,
    products: [
      ...catalog.products,
      {
        id: 'vnd-mug',
        name: 'Ceramic Mug',
        brand: 'Demo Co',
        category: 'Home',
        sku: 'MUG-VND',
        price: 150000,
        currency: 'VND',
        availability: 'InStock',
        url: 'https://cli-shop.example/products/ceramic-mug',
        description: 'Demo VND item',
        attributes: {}
      }
    ]
  };
  const mixedError = await search.execute({ query: 'Demo', maxPrice: 50 });
  assert.equal(mixedError.isError, true);
  assert.match(mixedError.content[0].text, /multiple currencies/i);

  const scopedUsd = JSON.parse((await search.execute({ query: 'Demo', maxPrice: 30, currency: 'USD' })).content[0].text);
  assert.equal(scopedUsd.totalMatches, 1);
  assert.equal(scopedUsd.items[0].id, 'canvas-tote');
  assert.equal(scopedUsd.items[0].matchingOffers.length, 1);
  assert.equal(scopedUsd.items[0].matchingOffers[0].sku, 'TOTE-NAT');
});

test('BUG-001: Shopify variants without explicit publication evidence are rejected unless trustedPublicSource is declared', () => {
  const shopifyPayload = {
    products: [
      {
        id: 701,
        handle: 'unverified-variant-shirt',
        title: 'Unverified Variant Shirt',
        published_at: '2026-01-10T00:00:00Z',
        variants: [
          { id: 7001, title: 'Black', sku: 'UV-BLK', price: '20.00', available: true }
        ]
      }
    ]
  };
  const untrusted = normalizeCatalog(shopifyPayload, {
    format: 'shopify',
    siteUrl: 'https://shop.example',
    defaultCurrency: 'USD'
  });
  assert.equal(untrusted.products.length, 0);
  assert.equal(untrusted.skipped.length, 1);

  const trusted = normalizeCatalog(shopifyPayload, {
    format: 'shopify',
    siteUrl: 'https://shop.example',
    defaultCurrency: 'USD',
    trustedPublicSource: true
  });
  assert.equal(trusted.products.length, 1);
  assert.equal(trusted.products[0].variants.length, 1);
});

test('BUG-002: sensitive attributes (supplier_cost, customer_email, nested objects) are blocked by default public attribute allowlist', () => {
  const shopifyPayload = {
    products: [
      {
        id: 702,
        handle: 'allowlist-shirt',
        title: 'Allowlist Shirt',
        published_at: '2026-01-10T00:00:00Z',
        options: [
          { name: 'Color', values: ['Black'] },
          { name: 'supplier_cost', values: ['4.50'] }
        ],
        variants: [
          { id: 7002, title: 'Black / 4.50', sku: 'AL-BLK', price: '20.00', available: true, published: true, option1: 'Black', option2: '4.50' }
        ]
      }
    ]
  };
  const shopRes = normalizeCatalog(shopifyPayload, {
    format: 'shopify',
    siteUrl: 'https://shop.example',
    defaultCurrency: 'USD'
  });
  assert.equal(shopRes.products.length, 1);
  assert.equal(shopRes.products[0].variants[0].attributes.color, 'Black');
  assert.equal(shopRes.products[0].variants[0].attributes.supplier_cost, undefined);
  assert(!JSON.stringify(shopRes.products).includes('supplier_cost'));
  assert(!JSON.stringify(shopRes.products[0].variants[0].attributes).includes('4.50'));

  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    sku: 'LD-SAFE-1',
    name: 'Safe Lamp',
    url: 'https://shop.example/products/safe-lamp',
    offers: { '@type': 'Offer', price: 45, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'material', value: 'Brass' },
      { '@type': 'PropertyValue', name: 'customer_email', value: 'vip@customer.example' },
      { '@type': 'PropertyValue', name: 'internal_meta', value: { cost: 12, owner: 'secret' } }
    ]
  };
  const ldRes = normalizeCatalog(jsonLdPayload, {
    format: 'jsonld',
    siteUrl: 'https://shop.example'
  });
  assert.equal(ldRes.products.length, 1);
  assert.equal(ldRes.products[0].attributes.material, 'Brass');
  assert.equal(ldRes.products[0].attributes.customer_email, undefined);
  assert.equal(ldRes.products[0].attributes.internal_meta, undefined);
  assert(!JSON.stringify(ldRes.products).includes('vip@customer.example'));

  // Custom developer-approved allowlist permits explicitly opted-in safe merchandising key.
  const customRes = normalizeCatalog(
    {
      ...jsonLdPayload,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'warranty_months', value: 24 },
        { '@type': 'PropertyValue', name: 'customer_email', value: 'vip@customer.example' }
      ]
    },
    { format: 'jsonld', siteUrl: 'https://shop.example', allowedAttributes: ['warranty_months'] }
  );
  assert.equal(customRes.products[0].attributes.warranty_months, '24');
  assert.equal(customRes.products[0].attributes.customer_email, undefined);
});

test('BUG-003: cross-variant search does not leak parent aggregated color or sibling attributes, and reports matched variant summary', async (t) => {
  const catalog = {
    schemaVersion: 'agentready.catalog.v0.1',
    siteName: 'Variant Search QA',
    siteUrl: 'https://qa.example',
    generatedAt: '2026-11-24T00:00:00.000Z',
    mode: 'snapshot',
    products: [
      {
        id: 'color-tee',
        name: 'Essential Tee',
        brand: 'QA Brand',
        category: 'Apparel',
        sku: 'TEE-BLK',
        price: 20,
        currency: 'USD',
        availability: 'InStock',
        url: 'https://qa.example/products/essential-tee',
        description: 'Everyday tee.',
        attributes: { color: 'Black, Blue', material: 'Cotton' },
        variants: [
          { id: 'v-blk', label: 'Black', sku: 'TEE-BLK', price: 20, currency: 'USD', availability: 'InStock', url: 'https://qa.example/products/essential-tee?v=blk', attributes: { color: 'Black' } },
          { id: 'v-blu', label: 'Blue', sku: 'TEE-BLU', price: 35, currency: 'USD', availability: 'OutOfStock', url: 'https://qa.example/products/essential-tee?v=blu', attributes: { color: 'Blue' } }
        ]
      }
    ]
  };

  const regs = await loadWebMcpAdapter(t, () => catalog, 'bug003');
  const search = regs.find((r) => r.tool.name === 'agentready_search_products').tool;

  const contaminated = JSON.parse((await search.execute({ query: 'Blue', maxPrice: 25, availability: 'InStock' })).content[0].text);
  assert.equal(contaminated.totalMatches, 0);

  const blueOnly = JSON.parse((await search.execute({ query: 'Blue' })).content[0].text);
  assert.equal(blueOnly.totalMatches, 1);
  assert.equal(blueOnly.items[0].price, 35);
  assert.equal(blueOnly.items[0].availability, 'OutOfStock');
  assert.equal(blueOnly.items[0].matchingOffers.length, 1);
  assert.equal(blueOnly.items[0].matchingOffers[0].id, 'v-blu');
});

test('BUG-004: explicitly private, unpublished, or hidden JSON-LD products are rejected', () => {
  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@type': 'Product',
          sku: 'PRIV-1',
          name: 'Private Product',
          published: false,
          url: 'https://shop.example/products/private-1',
          offers: { '@type': 'Offer', price: 10, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        }
      },
      {
        '@type': 'ListItem',
        position: 2,
        item: {
          '@type': 'Product',
          sku: 'HID-2',
          name: 'Hidden Product',
          visibility: 'hidden',
          url: 'https://shop.example/products/hidden-2',
          offers: { '@type': 'Offer', price: 10, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        }
      },
      {
        '@type': 'ListItem',
        position: 3,
        item: {
          '@type': 'Product',
          sku: 'DRAFT-3',
          name: 'Draft Product',
          status: 'draft',
          url: 'https://shop.example/products/draft-3',
          offers: { '@type': 'Offer', price: 10, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        }
      }
    ]
  };
  const res = normalizeCatalog(jsonLdPayload, { format: 'jsonld', siteUrl: 'https://shop.example' });
  assert.equal(res.products.length, 0);
  assert.equal(res.skipped.length, 3);
  assert(res.skipped.every((s) => /private|unpublished|hidden/i.test(s.reason)));
});

test('QA-EDGE-1: rejected Shopify option values do not leak through variant label or anywhere in exported product', () => {
  const shopifyPayload = {
    products: [
      {
        id: 801,
        handle: 'clean-label-shirt',
        title: 'Clean Label Shirt',
        published_at: '2026-01-10T00:00:00Z',
        options: [
          { name: 'Color', values: ['Black'] },
          { name: 'supplier_cost', values: ['4.50'] }
        ],
        variants: [
          {
            id: 8001,
            title: 'Black / 4.50',
            sku: 'CL-BLK',
            price: '20.00',
            available: true,
            published: true,
            option1: 'Black',
            option2: '4.50'
          }
        ]
      }
    ]
  };
  const res = normalizeCatalog(shopifyPayload, {
    format: 'shopify',
    siteUrl: 'https://shop.example',
    defaultCurrency: 'USD'
  });
  assert.equal(res.products.length, 1);
  assert.equal(res.products[0].variants[0].label, 'Black');
  assert(!JSON.stringify(res.products[0]).includes('4.50'));
  assert(!JSON.stringify(res.products[0]).includes('supplier_cost'));
});

test('QA-EDGE-2: parent description mentioning sibling variant color does not contaminate variant search', async (t) => {
  const catalog = {
    schemaVersion: 'agentready.catalog.v0.1',
    siteName: 'Description Isolation QA',
    siteUrl: 'https://qa.example',
    generatedAt: '2026-11-24T00:00:00.000Z',
    mode: 'snapshot',
    products: [
      {
        id: 'desc-tee',
        name: 'Classic Tee',
        brand: 'QA Brand',
        category: 'Apparel',
        sku: 'CT-BLK',
        price: 20,
        currency: 'USD',
        availability: 'InStock',
        url: 'https://qa.example/products/classic-tee',
        description: 'Available in Black and Blue.',
        attributes: { material: 'Cotton' },
        variants: [
          { id: 'v-blk', label: 'Black', sku: 'CT-BLK', price: 20, currency: 'USD', availability: 'InStock', url: 'https://qa.example/products/classic-tee?v=blk', attributes: { color: 'Black' } },
          { id: 'v-blu', label: 'Blue', sku: 'CT-BLU', price: 35, currency: 'USD', availability: 'OutOfStock', url: 'https://qa.example/products/classic-tee?v=blu', attributes: { color: 'Blue' } }
        ]
      }
    ]
  };

  const regs = await loadWebMcpAdapter(t, () => catalog, 'qaedge2');
  const search = regs.find((r) => r.tool.name === 'agentready_search_products').tool;

  const contaminated = JSON.parse((await search.execute({ query: 'Blue', maxPrice: 25, availability: 'InStock' })).content[0].text);
  assert.equal(contaminated.totalMatches, 0);

  const validBlue = JSON.parse((await search.execute({ query: 'Classic Blue', maxPrice: 40 })).content[0].text);
  assert.equal(validBlue.totalMatches, 1);
  assert.equal(validBlue.items[0].price, 35);
  assert.equal(validBlue.items[0].availability, 'OutOfStock');
});

test('QA-EDGE-3: WebMCP and JSON-LD representative offer price and availability come from the same offer', async (t) => {
  // 1. WebMCP: $20 OutOfStock + $35 InStock must report representative offer price=35, availability=InStock, with priceRange={min:20,max:35}.
  const catalog = {
    schemaVersion: 'agentready.catalog.v0.1',
    siteName: 'Offer Consistency QA',
    siteUrl: 'https://qa.example',
    generatedAt: '2026-11-24T00:00:00.000Z',
    mode: 'snapshot',
    products: [
      {
        id: 'jacket-1',
        name: 'Field Jacket',
        brand: 'QA Brand',
        category: 'Outerwear',
        sku: 'FJ-35',
        price: 35,
        currency: 'USD',
        availability: 'InStock',
        url: 'https://qa.example/products/field-jacket',
        description: 'Durable jacket.',
        attributes: {},
        variants: [
          { id: 'v-oos', label: 'Small', sku: 'FJ-S', price: 20, currency: 'USD', availability: 'OutOfStock', url: 'https://qa.example/products/field-jacket?v=s', attributes: { size: 'S' } },
          { id: 'v-in', label: 'Large', sku: 'FJ-L', price: 35, currency: 'USD', availability: 'InStock', url: 'https://qa.example/products/field-jacket?v=l', attributes: { size: 'L' } }
        ]
      }
    ]
  };

  const regs = await loadWebMcpAdapter(t, () => catalog, 'qaedge3');
  const search = regs.find((r) => r.tool.name === 'agentready_search_products').tool;
  const get = regs.find((r) => r.tool.name === 'agentready_get_product').tool;

  const searchRes = JSON.parse((await search.execute({ query: 'Field Jacket' })).content[0].text);
  assert.equal(searchRes.totalMatches, 1);
  assert.equal(searchRes.items[0].price, 35);
  assert.equal(searchRes.items[0].availability, 'InStock');
  assert.deepEqual(searchRes.items[0].priceRange, { min: 20, max: 35 });

  const detailRes = JSON.parse((await get.execute({ id: 'jacket-1' })).content[0].text).item;
  assert.equal(detailRes.price, 35);
  assert.equal(detailRes.availability, 'InStock');
  assert.deepEqual(detailRes.priceRange, { min: 20, max: 35 });

  // 2. JSON-LD: $20 OutOfStock + $35 PreOrder must select the $35 PreOrder offer (not price=20 with availability=PreOrder).
  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    sku: 'PRE-1',
    name: 'PreOrder Camera',
    url: 'https://qa.example/products/preorder-camera',
    offers: [
      { '@type': 'Offer', price: 20, priceCurrency: 'USD', availability: 'https://schema.org/OutOfStock' },
      { '@type': 'Offer', price: 35, priceCurrency: 'USD', availability: 'https://schema.org/PreOrder' }
    ]
  };
  const ldRes = normalizeCatalog(jsonLdPayload, { format: 'jsonld', siteUrl: 'https://qa.example' });
  assert.equal(ldRes.products.length, 1);
  assert.equal(ldRes.products[0].price, 35);
  assert.equal(ldRes.products[0].availability, 'PreOrder');
});

test('QA-EDGE-4: JSON-LD ItemList marked published:false prevents exporting nested Products', () => {
  const jsonLdPayload = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    published: false,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@type': 'Product',
          sku: 'NESTED-1',
          name: 'Nested Under Private List',
          url: 'https://shop.example/products/nested-1',
          offers: { '@type': 'Offer', price: 25, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
        }
      }
    ]
  };
  const res = normalizeCatalog(jsonLdPayload, { format: 'jsonld', siteUrl: 'https://shop.example' });
  assert.equal(res.products.length, 0);
  assert.equal(res.skipped.length, 1);
  assert.match(res.skipped[0].reason, /ancestor|private|unpublished/i);
});

test('safe: force import cannot overwrite the AgentReady configuration', async t => {
  const dir = await makeProject(t, 'https://shop.example');
  const configPath = path.join(dir, 'agentready.config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  config.publicProductsPath = 'agentready.config.json';
  const original = JSON.stringify(config);
  await fs.writeFile(configPath, original);
  await fs.writeFile(path.join(dir, 'data/export.json'), JSON.stringify({ products: [] }));
  await assert.rejects(() => importCatalog(dir, { source: 'data/export.json', format: 'shopify', force: true }), /must not overwrite agentready.config.json/);
  assert.equal(await fs.readFile(configPath, 'utf8'), original);
});
