import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { DEFAULT_SECURITY_POLICY } from '../src/scanner/network-security.mjs';
import { scanWebsite } from '../src/scanner/engine.mjs';
import { formatReportJson, formatReportMarkdown } from '../src/scanner/report.mjs';

function startSiteFixture(t, routes) {
  return new Promise((resolve) => {
    const requestedPaths = [];
    const server = http.createServer((req, res) => {
      requestedPaths.push(req.url);
      const handler = routes[req.url];
      if (!handler) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const out = typeof handler === 'function' ? handler(req) : handler;
      res.writeHead(out.status || 200, { 'content-type': out.contentType || 'text/html; charset=utf-8' });
      res.end(out.body || '');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      t.after(() => new Promise((done) => server.close(done)));
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        requestedPaths,
        testPolicy: {
          ...DEFAULT_SECURITY_POLICY,
          blockPrivateNetworks: false,
          allowedPorts: [port]
        }
      });
    });
  });
}

test('full AgentReady commerce fixture produces evidence-backed high score while keeping WebMCP runtime UNVERIFIED', async (t) => {
  const words = Array.from({ length: 95 }, (_, i) => `product${i}`).join(' ');
  const fixture = await startSiteFixture(t, {
    '/robots.txt': {
      contentType: 'text/plain',
      body: 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n'
    },
    '/sitemap.xml': {
      contentType: 'application/xml',
      body: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://shop.example/p/1</loc></url></urlset>'
    },
    '/llms.txt': {
      contentType: 'text/plain',
      body: '# Demo Store\n> Public commerce catalog.\n## Resources\n- [Catalog](/agentready/catalog.json)\n'
    },
    '/agentready/manifest.json': {
      contentType: 'application/json',
      body: JSON.stringify({
        version: '0.3.0',
        siteName: 'Demo Store',
        catalog: '/agentready/catalog.json',
        webmcp: '/agentready/webmcp-products.js'
      })
    },
    '/agentready/catalog.json': {
      contentType: 'application/json',
      body: JSON.stringify({
        products: [
          {
            id: 'tee-1',
            name: 'Organic Cotton Tee',
            price: 29,
            currency: 'USD',
            availability: 'InStock',
            variants: [{ id: 'tee-1-m', label: 'M', price: 29, currency: 'USD', availability: 'InStock' }]
          }
        ]
      })
    },
    '/agentready/catalog.md': {
      contentType: 'text/markdown',
      body: '# Demo Store Catalog\n- Organic Cotton Tee — 29 USD (InStock)\n'
    },
    '/': {
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en"><head>
        <title>Demo Store</title>
        <meta name="description" content="Public commerce store" />
        <link rel="canonical" href="https://shop.example/" />
        <script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', name: 'Demo Store' },
            {
              '@type': 'Product',
              name: 'Organic Cotton Tee',
              sku: 'TEE-1',
              offers: [
                { '@type': 'Offer', price: 29, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
                { '@type': 'Offer', price: 32, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }
              ]
            }
          ]
        })}</script>
      </head><body>
        <header><nav><a href="/">Home</a></nav></header>
        <main><h1>Demo Store</h1><article><p>Shop our catalog $29 USD ${words}</p></article></main>
        <script type="module" src="/agentready/webmcp-products.js"></script>
      </body></html>`
    }
  });

  const progressSteps = [];
  const result = await scanWebsite(fixture.baseUrl, {
    securityPolicy: fixture.testPolicy,
    onProgress: (ev) => progressSteps.push(`${ev.step}:${ev.status}`)
  });

  assert.equal(result.siteProfile, 'commerce');
  // HTTP (not HTTPS) gives DISC-01 3/4, AGNT-02 is UNVERIFIED 0/5 -> 94/100
  assert.equal(result.summary.awardedScore, 94);
  assert.equal(result.summary.applicableMaxScore, 100);
  assert.equal(result.summary.verificationCoveragePercent, 95);
  assert.equal(result.criteria.find((c) => c.id === 'AGNT-01').status, 'PASS');
  assert.equal(result.criteria.find((c) => c.id === 'AGNT-02').status, 'UNVERIFIED');
  assert(progressSteps.includes('validate_url:done'));
  assert(progressSteps.includes('fetch_homepage:done'));
  assert(progressSteps.includes('evaluate_score:done'));

  // Verify JSON and Markdown report exporters
  const jsonText = formatReportJson(result);
  assert.equal(JSON.parse(jsonText).scanId, result.scanId);
  const mdEn = formatReportMarkdown(result, 'en');
  assert.match(mdEn, /AgentReady B2A — AI Readiness Scan Report/);
  assert.match(mdEn, /AGNT-02/);
  const mdVi = formatReportMarkdown(result, 'vi');
  assert.match(mdVi, /Báo cáo Đánh giá AI Readiness/);
});

test('missing metadata and JS-only empty shell produce accurate FAIL statuses and fixes', async (t) => {
  const fixture = await startSiteFixture(t, {
    '/': {
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><head></head><body><div id="root"></div><noscript>Enable JavaScript</noscript></body></html>'
    }
  });

  const result = await scanWebsite(fixture.baseUrl, {
    mode: 'commerce',
    securityPolicy: fixture.testPolicy
  });

  assert.equal(result.criteria.find((c) => c.id === 'DISC-02').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'DISC-03').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'DISC-04').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'DATA-01').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'READ-02').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'READ-03').status, 'FAIL');
  assert(result.summary.awardedScore < 15);
});

test('malformed JSON-LD structured data fails DATA-01 with parse error evidence without crashing', async (t) => {
  const fixture = await startSiteFixture(t, {
    '/': {
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en"><head>
        <title>Broken JSON-LD Store</title>
        <script type="application/ld+json">{ "@context": "https://schema.org", "@type": "Product", "name": "Broken", }</script>
      </head><body><main><h1>Store</h1><p>Add to cart $19.99 USD</p></main></body></html>`
    }
  });

  const result = await scanWebsite(fixture.baseUrl, { securityPolicy: fixture.testPolicy });
  const data01 = result.criteria.find((c) => c.id === 'DATA-01');
  assert.equal(data01.status, 'FAIL');
  assert.equal(data01.awardedPoints, 0);
  assert(data01.evidence.some((e) => /invalid JSON/i.test(e)));
});

test('unsupported non-HTML website is handled honestly without fabricated checks', async (t) => {
  const fixture = await startSiteFixture(t, {
    '/': {
      contentType: 'application/pdf',
      body: '%PDF-1.4 fake binary content'
    }
  });

  const result = await scanWebsite(fixture.baseUrl, { securityPolicy: fixture.testPolicy });
  assert.equal(result.siteProfile, 'unsupported');
  assert.equal(result.criteria.find((c) => c.id === 'DISC-01').status, 'FAIL');
  assert.equal(result.criteria.find((c) => c.id === 'DATA-01').status, 'NOT_APPLICABLE');
  assert.equal(result.criteria.find((c) => c.id === 'READ-01').status, 'NOT_APPLICABLE');
  assert.equal(result.criteria.find((c) => c.id === 'READ-02').status, 'NOT_APPLICABLE');
});

test('scanner respects robots.txt Disallow directives and marks skipped probes UNVERIFIED', async (t) => {
  const fixture = await startSiteFixture(t, {
    '/robots.txt': {
      contentType: 'text/plain',
      body: 'User-agent: *\nDisallow: /llms.txt\nDisallow: /agentready/\n'
    },
    '/': {
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="en"><head><title>Robots Restricted</title></head><body><main><h1>Hello</h1></main></body></html>'
    },
    '/llms.txt': {
      contentType: 'text/plain',
      body: '# Should never be fetched'
    }
  });

  const result = await scanWebsite(fixture.baseUrl, { securityPolicy: fixture.testPolicy });
  assert(!fixture.requestedPaths.includes('/llms.txt'), 'Scanner must not fetch disallowed /llms.txt');
  assert(!fixture.requestedPaths.includes('/agentready/manifest.json'), 'Scanner must not fetch disallowed /agentready/');
  assert.equal(result.criteria.find((c) => c.id === 'DISC-04').status, 'UNVERIFIED');
  assert.equal(result.criteria.find((c) => c.id === 'DISC-05').status, 'UNVERIFIED');
});
