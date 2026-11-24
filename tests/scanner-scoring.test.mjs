import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_DEFINITIONS,
  CRITERION_STATUSES,
  SCORING_DISCLAIMER,
  SCORING_VERSION,
  evaluateReadiness
} from '../src/scanner/scoring.mjs';

test('category maximum scores sum deterministically to 100', () => {
  const total = CATEGORY_DEFINITIONS.reduce((sum, c) => sum + c.maxScore, 0);
  assert.equal(total, 100);
  assert.deepEqual(
    CATEGORY_DEFINITIONS.map((c) => [c.id, c.maxScore]),
    [
      ['discovery', 20],
      ['structured_data', 25],
      ['commerce_readiness', 20],
      ['ai_readability', 20],
      ['agent_interaction', 15]
    ]
  );
});

test('unverified WebMCP capabilities are never treated as working and reduce verification coverage', () => {
  const observations = {
    homepage: { ok: true, isHtml: true, statusCode: 200, finalUrl: 'https://shop.example.com/', redirectCount: 0, contentType: 'text/html', blockedByRobots: false },
    robots: { ok: true, statusCode: 200, url: 'https://shop.example.com/robots.txt', parsed: { present: true, blocksAll: false, groupCount: 1, sitemaps: ['https://shop.example.com/sitemap.xml'] } },
    sitemap: { ok: true, statusCode: 200, url: 'https://shop.example.com/sitemap.xml', blockedByRobots: false, parsed: { valid: true, type: 'urlset', urlCount: 5 } },
    llms: { ok: true, statusCode: 200, url: 'https://shop.example.com/llms.txt', blockedByRobots: false, parsed: { valid: true, title: 'Shop', sections: ['Catalog'], links: [{ label: 'Catalog', url: '/agentready/catalog.json' }] } },
    agentReady: {
      blockedByRobots: false,
      manifestValid: true,
      catalogValid: true,
      manifestUrl: 'https://shop.example.com/agentready/manifest.json',
      catalogUrl: 'https://shop.example.com/agentready/catalog.json',
      catalogMdUrl: 'https://shop.example.com/agentready/catalog.md',
      catalogMdOk: true,
      productCount: 2,
      withPriceAndCurrency: 2,
      withAvailability: 2,
      withVariants: 1,
      currencies: ['USD'],
      manifestWebMcpRef: true
    },
    html: {
      lang: 'en',
      title: 'Example Commerce Store',
      metaDescription: 'Public catalog store',
      canonicalUrl: 'https://shop.example.com/',
      landmarks: { main: true, header: true, nav: true, article: true, section: false, footer: true },
      headingCounts: { h1: 1, h2: 2 },
      readability: { wordCount: 120, charCount: 800, textToHtmlRatio: 0.35, isLikelyJsShell: false },
      commerceHints: ['commerce-copy-detected', 'currency-price-text-detected']
    },
    structuredData: {
      totalBlocks: 2,
      validBlockCount: 2,
      invalidBlockCount: 0,
      invalidBlocks: [],
      schemaOrgContextDetected: true,
      entityTypes: ['Organization', 'Product', 'Offer'],
      productCount: 2,
      productsWithCoreFields: 2,
      siteEntityCount: 1,
      offersFound: 2,
      offersWithPriceAndCurrency: 2,
      offersWithAvailability: 2,
      productsWithVariants: 1,
      currencies: ['USD']
    },
    webMcp: {
      signals: ['script[src="/agentready/webmcp-products.js"]', 'AgentReady manifest declares WebMCP integration'],
      runtimeVerified: false,
      runtimeEvidence: []
    }
  };

  const result = evaluateReadiness(observations);
  assert.equal(result.scoringVersion, SCORING_VERSION);
  assert.equal(result.disclaimer, SCORING_DISCLAIMER);
  assert.equal(result.siteProfile, 'commerce');

  const agnt01 = result.criteria.find((c) => c.id === 'AGNT-01');
  const agnt02 = result.criteria.find((c) => c.id === 'AGNT-02');
  assert.equal(agnt01.status, 'PASS');
  assert.equal(agnt01.awardedPoints, 5);
  assert.equal(agnt02.status, 'UNVERIFIED');
  assert.equal(agnt02.awardedPoints, 0);

  // Max score is 100, all 100 applicable, 95 awarded (AGNT-02 is 5 unverified pts)
  assert.equal(result.summary.totalMaxScore, 100);
  assert.equal(result.summary.applicableMaxScore, 100);
  assert.equal(result.summary.verifiedMaxScore, 95);
  assert.equal(result.summary.awardedScore, 95);
  assert.equal(result.summary.verificationCoveragePercent, 95);
  assert(result.capabilities.detectedSignals.includes('webmcp_static_signals_detected'));
  assert(result.capabilities.unverifiedCapabilities.includes('webmcp_runtime_execution'));
  assert(!result.capabilities.verifiedCapabilities.includes('webmcp_runtime_verified'));

  // Every criterion has required fields
  for (const c of result.criteria) {
    assert(typeof c.id === 'string' && c.id.length > 0);
    assert(Number.isInteger(c.maxPoints) && c.maxPoints > 0);
    assert(Number.isInteger(c.awardedPoints) && c.awardedPoints >= 0 && c.awardedPoints <= c.maxPoints);
    assert(CRITERION_STATUSES.includes(c.status));
    assert(Array.isArray(c.evidence) && c.evidence.length > 0);
    assert(typeof c.explanation === 'string' && c.explanation.length > 0);
    assert(typeof c.recommendedFix === 'string' && c.recommendedFix.length > 0);
  }
});

test('non-commerce website marks commerce-only criteria NOT_APPLICABLE and adjusts applicableMaxScore', () => {
  const observations = {
    homepage: { ok: true, isHtml: true, statusCode: 200, finalUrl: 'https://docs.example.com/', redirectCount: 0, contentType: 'text/html', blockedByRobots: false },
    robots: { ok: true, statusCode: 200, url: 'https://docs.example.com/robots.txt', parsed: { present: true, blocksAll: false, groupCount: 1, sitemaps: [] } },
    sitemap: { ok: false, statusCode: 404, url: 'https://docs.example.com/sitemap.xml', blockedByRobots: false, parsed: null },
    llms: { ok: false, statusCode: 404, url: 'https://docs.example.com/llms.txt', blockedByRobots: false, parsed: null },
    agentReady: { blockedByRobots: false, manifestValid: false, catalogValid: false, catalogMdOk: false, productCount: 0, withPriceAndCurrency: 0, withAvailability: 0, withVariants: 0, currencies: [], manifestWebMcpRef: false },
    html: {
      lang: 'en',
      title: 'Engineering Documentation',
      metaDescription: 'Technical reference guides',
      canonicalUrl: 'https://docs.example.com/',
      landmarks: { main: true, header: true, nav: true, article: true, section: false, footer: false },
      headingCounts: { h1: 1, h2: 3 },
      readability: { wordCount: 150, charCount: 1000, textToHtmlRatio: 0.4, isLikelyJsShell: false },
      commerceHints: []
    },
    structuredData: {
      totalBlocks: 0,
      validBlockCount: 0,
      invalidBlockCount: 0,
      invalidBlocks: [],
      schemaOrgContextDetected: false,
      entityTypes: [],
      productCount: 0,
      productsWithCoreFields: 0,
      siteEntityCount: 0,
      offersFound: 0,
      offersWithPriceAndCurrency: 0,
      offersWithAvailability: 0,
      productsWithVariants: 0,
      currencies: []
    },
    webMcp: { signals: [], runtimeVerified: false, runtimeEvidence: [] }
  };

  const result = evaluateReadiness(observations);
  assert.equal(result.siteProfile, 'non_commerce');
  for (const id of ['DATA-02', 'DATA-04', 'COMM-01', 'COMM-02', 'COMM-03', 'COMM-04', 'AGNT-02']) {
    const item = result.criteria.find((c) => c.id === id);
    assert.equal(item.status, 'NOT_APPLICABLE', `Expected ${id} to be NOT_APPLICABLE`);
  }
  // 100 - (8 + 5 + 6 + 5 + 5 + 4 + 5) = 62 applicable max points
  assert.equal(result.summary.applicableMaxScore, 62);
  assert.equal(result.summary.verificationCoveragePercent, 100);
});
