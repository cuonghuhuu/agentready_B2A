/**
 * AgentReady B2A — Deterministic AI Readiness Scoring Model (v1.0.0)
 *
 * Categories (Total = 100):
 * - Discovery:          20
 * - Structured Data:    25
 * - Commerce Readiness: 20
 * - AI Readability:     20
 * - Agent Interaction:  15
 *
 * NOTE: This is an AgentReady-defined scoring model, not an official industry certification.
 */

export const SCORING_VERSION = '1.0.0';
export const SCORING_DISCLAIMER =
  'AgentReady-defined scoring model (v1.0.0), not an official industry certification.';

export const CATEGORY_DEFINITIONS = Object.freeze([
  { id: 'discovery', name: 'Discovery', maxScore: 20 },
  { id: 'structured_data', name: 'Structured Data', maxScore: 25 },
  { id: 'commerce_readiness', name: 'Commerce Readiness', maxScore: 20 },
  { id: 'ai_readability', name: 'AI Readability', maxScore: 20 },
  { id: 'agent_interaction', name: 'Agent Interaction', maxScore: 15 }
]);

export const CRITERION_STATUSES = Object.freeze([
  'PASS',
  'PARTIAL',
  'FAIL',
  'UNVERIFIED',
  'NOT_APPLICABLE'
]);

function criterion({
  id,
  category,
  title,
  maxPoints,
  awardedPoints,
  status,
  evidence,
  explanation,
  recommendedFix
}) {
  if (!CRITERION_STATUSES.includes(status)) {
    throw new Error(`Invalid criterion status: ${status}`);
  }
  const safeAwarded = Math.max(0, Math.min(maxPoints, Math.round(awardedPoints)));
  return {
    id,
    category,
    title,
    maxPoints,
    awardedPoints: safeAwarded,
    status,
    evidence: Array.isArray(evidence) ? evidence : [String(evidence)],
    explanation,
    recommendedFix
  };
}

function detectSiteProfile(observations, mode = 'auto') {
  const { homepage, structuredData, agentReady, html } = observations;
  if (!homepage.ok || !homepage.isHtml) {
    return 'unsupported';
  }
  if (mode === 'commerce') return 'commerce';
  if (mode === 'general') return 'non_commerce';

  const hasCommerceSignals =
    structuredData.productCount > 0 ||
    agentReady.catalogValid ||
    agentReady.manifestValid ||
    (html && html.commerceHints.length > 0);

  return hasCommerceSignals ? 'commerce' : 'non_commerce';
}

function gradeFromScore(score, applicableMax) {
  if (applicableMax <= 0) return 'N/A';
  const pct = (score / applicableMax) * 100;
  if (pct >= 85) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

/**
 * Evaluates all 19 deterministic criteria from observed scan evidence.
 */
export function evaluateReadiness(observations, { mode = 'auto' } = {}) {
  const siteProfile = detectSiteProfile(observations, mode);
  const isCommerce = siteProfile === 'commerce';
  const isUnsupported = siteProfile === 'unsupported';

  const {
    homepage,
    robots,
    sitemap,
    llms,
    agentReady,
    html,
    structuredData,
    webMcp
  } = observations;

  const criteria = [];

  // =========================================================================
  // 1. DISCOVERY (20 pts: 4 + 4 + 4 + 4 + 4)
  // =========================================================================

  // DISC-01: HTTP Accessibility & Response Status (4 pts)
  if (homepage.blockedByRobots) {
    criteria.push(criterion({
      id: 'DISC-01',
      category: 'discovery',
      title: 'HTTP Accessibility & Response Status',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'UNVERIFIED',
      evidence: [`robots.txt disallowed homepage path (${homepage.robotsRule || 'Disallow: /'}).`],
      explanation: 'The scanner respected robots.txt and did not fetch the target page.',
      recommendedFix: 'Allow public pages in robots.txt if you intend for AI agents to inspect your storefront.'
    }));
  } else if (homepage.ok && homepage.isHtml) {
    const hasRedirects = homepage.redirectCount > 0;
    const isHttps = homepage.finalUrl?.startsWith('https://');
    criteria.push(criterion({
      id: 'DISC-01',
      category: 'discovery',
      title: 'HTTP Accessibility & Response Status',
      maxPoints: 4,
      awardedPoints: isHttps ? 4 : 3,
      status: isHttps ? 'PASS' : 'PARTIAL',
      evidence: [
        `HTTP ${homepage.statusCode} (${homepage.contentType || 'unknown content-type'}) at ${homepage.finalUrl}`,
        hasRedirects ? `Followed ${homepage.redirectCount} validated redirect(s).` : 'Direct response with 0 redirects.'
      ],
      explanation: isHttps
        ? 'The target URL is publicly reachable over HTTPS and returns an HTML document.'
        : 'The target URL is reachable over plain HTTP rather than HTTPS.',
      recommendedFix: isHttps
        ? 'No action required.'
        : 'Serve the public storefront over HTTPS with a valid TLS certificate.'
    }));
  } else if (homepage.ok && !homepage.isHtml) {
    criteria.push(criterion({
      id: 'DISC-01',
      category: 'discovery',
      title: 'HTTP Accessibility & Response Status',
      maxPoints: 4,
      awardedPoints: 1,
      status: 'FAIL',
      evidence: [`HTTP ${homepage.statusCode} returned non-HTML content-type: ${homepage.contentType || 'unknown'}.`],
      explanation: 'The URL responded with HTTP 2xx, but it is not an HTML webpage supported by the AI Readiness Scanner.',
      recommendedFix: 'Scan a public HTML storefront or landing page URL.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DISC-01',
      category: 'discovery',
      title: 'HTTP Accessibility & Response Status',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: [homepage.error || `HTTP ${homepage.statusCode || 'no response'}`],
      explanation: 'The target URL could not be retrieved cleanly as a public HTTP 2xx document.',
      recommendedFix: 'Ensure the public URL returns HTTP 200 OK without server errors, timeouts, or auth walls.'
    }));
  }

  // DISC-02: robots.txt Presence & Crawlability (4 pts)
  if (robots.ok && robots.parsed?.present) {
    if (robots.parsed.blocksAll) {
      criteria.push(criterion({
        id: 'DISC-02',
        category: 'discovery',
        title: 'robots.txt Presence & Crawlability',
        maxPoints: 4,
        awardedPoints: 1,
        status: 'PARTIAL',
        evidence: [`HTTP ${robots.statusCode} at ${robots.url}`, `Root path blocked by rule: ${robots.parsed.rootRule}`],
        explanation: 'robots.txt exists, but it disallows crawling the root path for this user-agent.',
        recommendedFix: 'Update robots.txt to permit public product and discovery paths while keeping private endpoints disallowed.'
      }));
    } else {
      criteria.push(criterion({
        id: 'DISC-02',
        category: 'discovery',
        title: 'robots.txt Presence & Crawlability',
        maxPoints: 4,
        awardedPoints: 4,
        status: 'PASS',
        evidence: [
          `HTTP ${robots.statusCode} at ${robots.url}`,
          `Parsed ${robots.parsed.groupCount} user-agent group(s) and ${robots.parsed.sitemaps.length} Sitemap directive(s).`
        ],
        explanation: 'robots.txt is accessible and allows crawling of public pages.',
        recommendedFix: 'No action required.'
      }));
    }
  } else {
    criteria.push(criterion({
      id: 'DISC-02',
      category: 'discovery',
      title: 'robots.txt Presence & Crawlability',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: [robots.error || `HTTP ${robots.statusCode || 'unreachable'} at ${robots.url || '/robots.txt'}`],
      explanation: 'No readable robots.txt was found at the site root.',
      recommendedFix: 'Publish a /robots.txt file specifying allowed public paths and a Sitemap directive.'
    }));
  }

  // DISC-03: sitemap.xml Discovery (4 pts)
  if (sitemap.blockedByRobots) {
    criteria.push(criterion({
      id: 'DISC-03',
      category: 'discovery',
      title: 'sitemap.xml Discovery',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'UNVERIFIED',
      evidence: [`Sitemap fetch skipped due to robots.txt (${sitemap.robotsRule}).`],
      explanation: 'robots.txt prevented fetching the sitemap path.',
      recommendedFix: 'Allow /sitemap.xml in robots.txt and declare it with a Sitemap: directive.'
    }));
  } else if (sitemap.ok && sitemap.parsed?.valid) {
    criteria.push(criterion({
      id: 'DISC-03',
      category: 'discovery',
      title: 'sitemap.xml Discovery',
      maxPoints: 4,
      awardedPoints: 4,
      status: 'PASS',
      evidence: [
        `HTTP ${sitemap.statusCode} at ${sitemap.url}`,
        `Valid XML <${sitemap.parsed.type}> containing ${sitemap.parsed.urlCount} <loc> entry/entries.`
      ],
      explanation: 'A valid XML sitemap is publicly discoverable for URL indexing.',
      recommendedFix: 'No action required.'
    }));
  } else if (sitemap.ok && sitemap.parsed && !sitemap.parsed.valid) {
    criteria.push(criterion({
      id: 'DISC-03',
      category: 'discovery',
      title: 'sitemap.xml Discovery',
      maxPoints: 4,
      awardedPoints: 1,
      status: 'PARTIAL',
      evidence: [`HTTP ${sitemap.statusCode} at ${sitemap.url}`, `Parse error: ${sitemap.parsed.error}`],
      explanation: 'The sitemap endpoint responded with HTTP 200, but the payload was not a valid XML sitemap with URL entries.',
      recommendedFix: 'Serve valid XML conforming to sitemaps.org (<urlset> or <sitemapindex>) with <loc> entries.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DISC-03',
      category: 'discovery',
      title: 'sitemap.xml Discovery',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: [sitemap.error || `HTTP ${sitemap.statusCode || 'unreachable'} at ${sitemap.url || '/sitemap.xml'}`],
      explanation: 'No valid XML sitemap was discovered via robots.txt or /sitemap.xml.',
      recommendedFix: 'Generate /sitemap.xml listing public product and category URLs and reference it in /robots.txt.'
    }));
  }

  // DISC-04: llms.txt AI Discovery File (4 pts)
  if (llms.blockedByRobots) {
    criteria.push(criterion({
      id: 'DISC-04',
      category: 'discovery',
      title: 'llms.txt AI Discovery File',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'UNVERIFIED',
      evidence: [`/llms.txt skipped due to robots.txt (${llms.robotsRule}).`],
      explanation: 'robots.txt disallowed fetching /llms.txt.',
      recommendedFix: 'Allow /llms.txt in robots.txt if you publish an AI discovery overview.'
    }));
  } else if (llms.ok && llms.parsed?.valid) {
    const rich = Boolean(llms.parsed.title && llms.parsed.links.length > 0);
    criteria.push(criterion({
      id: 'DISC-04',
      category: 'discovery',
      title: 'llms.txt AI Discovery File',
      maxPoints: 4,
      awardedPoints: rich ? 4 : 2,
      status: rich ? 'PASS' : 'PARTIAL',
      evidence: [
        `HTTP ${llms.statusCode} at ${llms.url}`,
        `Title: "${llms.parsed.title || '(none)'}", Sections: ${llms.parsed.sections.length}, Links: ${llms.parsed.links.length}`
      ],
      explanation: rich
        ? '/llms.txt is present with structured Markdown heading and machine-readable links.'
        : '/llms.txt exists but lacks either a Markdown H1 title or resource links.',
      recommendedFix: rich
        ? 'No action required.'
        : 'Include a Markdown # title, > summary, and links to public documentation or /agentready/catalog.json in /llms.txt.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DISC-04',
      category: 'discovery',
      title: 'llms.txt AI Discovery File',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: [
        llms.parsed?.isHtmlFallback
          ? '/llms.txt returned HTML (SPA fallback) instead of plain Markdown text.'
          : llms.error || `HTTP ${llms.statusCode || 'unreachable'} at ${llms.url || '/llms.txt'}`
      ],
      explanation: 'No valid /llms.txt discovery file was found.',
      recommendedFix: 'Publish /llms.txt (or run `agentready generate`) with concise Markdown links to public catalog and documentation endpoints.'
    }));
  }

  // DISC-05: AgentReady Public Manifest & Catalog Discovery (4 pts)
  if (agentReady.blockedByRobots) {
    criteria.push(criterion({
      id: 'DISC-05',
      category: 'discovery',
      title: 'AgentReady Public Manifest & Catalog Discovery',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'UNVERIFIED',
      evidence: [`/agentready/* skipped due to robots.txt (${agentReady.robotsRule}).`],
      explanation: 'robots.txt disallowed probing /agentready/ endpoints.',
      recommendedFix: 'Allow /agentready/ in robots.txt if you publish AgentReady public catalog artifacts.'
    }));
  } else if (agentReady.manifestValid && agentReady.catalogValid) {
    criteria.push(criterion({
      id: 'DISC-05',
      category: 'discovery',
      title: 'AgentReady Public Manifest & Catalog Discovery',
      maxPoints: 4,
      awardedPoints: 4,
      status: 'PASS',
      evidence: [
        `Valid manifest at ${agentReady.manifestUrl}`,
        `Valid catalog at ${agentReady.catalogUrl} (${agentReady.productCount} public product(s))`
      ],
      explanation: 'Both AgentReady manifest.json and catalog.json were discovered and parsed cleanly.',
      recommendedFix: 'No action required.'
    }));
  } else if (agentReady.manifestValid || agentReady.catalogValid) {
    criteria.push(criterion({
      id: 'DISC-05',
      category: 'discovery',
      title: 'AgentReady Public Manifest & Catalog Discovery',
      maxPoints: 4,
      awardedPoints: 2,
      status: 'PARTIAL',
      evidence: [
        agentReady.manifestValid ? `Valid manifest at ${agentReady.manifestUrl}` : 'Manifest missing or invalid.',
        agentReady.catalogValid ? `Valid catalog at ${agentReady.catalogUrl}` : 'Catalog JSON missing or invalid.'
      ],
      explanation: 'Only part of the AgentReady discovery artifact set was found.',
      recommendedFix: 'Run `agentready generate` to publish both /agentready/manifest.json and /agentready/catalog.json.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DISC-05',
      category: 'discovery',
      title: 'AgentReady Public Manifest & Catalog Discovery',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['Neither /agentready/manifest.json nor /agentready/catalog.json returned valid JSON.'],
      explanation: 'No AgentReady public manifest or catalog endpoints were discovered.',
      recommendedFix: 'Use `agentready init` and `agentready generate` to publish public /agentready/manifest.json and /agentready/catalog.json.'
    }));
  }

  // =========================================================================
  // 2. STRUCTURED DATA (25 pts: 7 + 8 + 5 + 5)
  // =========================================================================

  // DATA-01: Schema.org JSON-LD Validity (7 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'DATA-01',
      category: 'structured_data',
      title: 'Schema.org JSON-LD Validity',
      maxPoints: 7,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'JSON-LD extraction requires a reachable HTML document.',
      recommendedFix: 'Ensure the target URL returns a valid public HTML page.'
    }));
  } else if (structuredData.validBlockCount > 0 && structuredData.invalidBlockCount === 0 && structuredData.schemaOrgContextDetected) {
    criteria.push(criterion({
      id: 'DATA-01',
      category: 'structured_data',
      title: 'Schema.org JSON-LD Validity',
      maxPoints: 7,
      awardedPoints: 7,
      status: 'PASS',
      evidence: [
        `Parsed ${structuredData.validBlockCount} valid JSON-LD block(s) with Schema.org @context.`,
        `Detected @type values: ${structuredData.entityTypes.join(', ') || 'none'}`
      ],
      explanation: 'All JSON-LD blocks are syntactically valid and reference Schema.org.',
      recommendedFix: 'No action required.'
    }));
  } else if (structuredData.validBlockCount > 0) {
    const reasons = [];
    if (structuredData.invalidBlockCount > 0) {
      reasons.push(`${structuredData.invalidBlockCount} malformed JSON-LD block(s): ${structuredData.invalidBlocks.map((b) => b.error).join('; ')}`);
    }
    if (!structuredData.schemaOrgContextDetected) {
      reasons.push('Valid JSON-LD found, but missing explicit https://schema.org @context.');
    }
    criteria.push(criterion({
      id: 'DATA-01',
      category: 'structured_data',
      title: 'Schema.org JSON-LD Validity',
      maxPoints: 7,
      awardedPoints: 3,
      status: 'PARTIAL',
      evidence: [`${structuredData.validBlockCount} valid block(s) parsed.`, ...reasons],
      explanation: 'Some JSON-LD is valid, but syntax errors or missing Schema.org context reduce machine reliability.',
      recommendedFix: 'Fix malformed JSON-LD syntax and declare "@context": "https://schema.org" on every JSON-LD block.'
    }));
  } else if (structuredData.invalidBlockCount > 0) {
    criteria.push(criterion({
      id: 'DATA-01',
      category: 'structured_data',
      title: 'Schema.org JSON-LD Validity',
      maxPoints: 7,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: structuredData.invalidBlocks.map((b) => `JSON-LD block #${b.index} invalid JSON: ${b.error}`),
      explanation: 'JSON-LD script blocks were present, but every block failed JSON parsing.',
      recommendedFix: 'Validate all <script type="application/ld+json"> blocks as strict JSON with no trailing commas or unescaped characters.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DATA-01',
      category: 'structured_data',
      title: 'Schema.org JSON-LD Validity',
      maxPoints: 7,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['Zero <script type="application/ld+json"> blocks found on page and no valid /agentready/products.jsonld.'],
      explanation: 'No Schema.org JSON-LD structured data was detected.',
      recommendedFix: 'Embed valid <script type="application/ld+json"> markup using https://schema.org.'
    }));
  }

  // DATA-02: Product Structured Data (8 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'DATA-02',
      category: 'structured_data',
      title: 'Product Structured Data',
      maxPoints: 8,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: [isUnsupported ? 'Target page was not an analyzable HTML page.' : 'No commerce or storefront signals detected on this page.'],
      explanation: 'Product structured data is evaluated as not applicable for non-commerce or unsupported pages.',
      recommendedFix: 'If this is an e-commerce page, add Schema.org Product JSON-LD or run the scanner in commerce mode.'
    }));
  } else if (structuredData.productCount > 0 && structuredData.productsWithCoreFields === structuredData.productCount) {
    criteria.push(criterion({
      id: 'DATA-02',
      category: 'structured_data',
      title: 'Product Structured Data',
      maxPoints: 8,
      awardedPoints: 8,
      status: 'PASS',
      evidence: [`${structuredData.productCount} Schema.org Product/ProductGroup entity/entities with core fields (name + description/sku/brand/image).`],
      explanation: 'Products are exposed as valid Schema.org entities with core descriptive metadata.',
      recommendedFix: 'No action required.'
    }));
  } else if (structuredData.productCount > 0) {
    criteria.push(criterion({
      id: 'DATA-02',
      category: 'structured_data',
      title: 'Product Structured Data',
      maxPoints: 8,
      awardedPoints: 4,
      status: 'PARTIAL',
      evidence: [`${structuredData.productCount} Product entity/entities found, but only ${structuredData.productsWithCoreFields} include core metadata.`],
      explanation: 'Product entities exist, but some are missing core fields such as name, description, brand, or SKU.',
      recommendedFix: 'Populate name, description, sku, brand, and image on all public Schema.org Product entities.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DATA-02',
      category: 'structured_data',
      title: 'Product Structured Data',
      maxPoints: 8,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['Commerce signals detected, but zero Schema.org Product entities were found in JSON-LD.'],
      explanation: 'Storefront pages without Product JSON-LD force AI agents to scrape unstructured HTML.',
      recommendedFix: 'Add Schema.org Product JSON-LD to product/catalog pages or publish /agentready/products.jsonld.'
    }));
  }

  // DATA-03: Core Site & Organization Metadata (5 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'DATA-03',
      category: 'structured_data',
      title: 'Core Site & Organization Metadata',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'Site metadata cannot be evaluated without an HTML document.',
      recommendedFix: 'Ensure the target URL returns a valid HTML document.'
    }));
  } else {
    const hasEntity = structuredData.siteEntityCount > 0;
    const hasBasicMeta = Boolean(html.title && html.metaDescription);
    if (hasEntity && hasBasicMeta) {
      criteria.push(criterion({
        id: 'DATA-03',
        category: 'structured_data',
        title: 'Core Site & Organization Metadata',
        maxPoints: 5,
        awardedPoints: 5,
        status: 'PASS',
        evidence: [
          `Detected ${structuredData.siteEntityCount} Organization/WebSite/Store JSON-LD entity/entities.`,
          `<title> ("${html.title.slice(0, 60)}") and <meta name="description"> present.`
        ],
        explanation: 'Both machine-readable site/organization JSON-LD and HTML head metadata are present.',
        recommendedFix: 'No action required.'
      }));
    } else if (hasEntity || hasBasicMeta) {
      criteria.push(criterion({
        id: 'DATA-03',
        category: 'structured_data',
        title: 'Core Site & Organization Metadata',
        maxPoints: 5,
        awardedPoints: 3,
        status: 'PARTIAL',
        evidence: [
          hasEntity ? 'Site/Organization JSON-LD present.' : 'No Organization/WebSite/Store JSON-LD entity found.',
          html.title ? `<title> present.` : 'Missing <title>.',
          html.metaDescription ? '<meta name="description"> present.' : 'Missing <meta name="description">.'
        ],
        explanation: 'Partial site identity metadata is present, but structured Organization/WebSite JSON-LD or head meta tags are incomplete.',
        recommendedFix: 'Include Organization or WebSite JSON-LD along with <title> and <meta name="description">.'
      }));
    } else {
      criteria.push(criterion({
        id: 'DATA-03',
        category: 'structured_data',
        title: 'Core Site & Organization Metadata',
        maxPoints: 5,
        awardedPoints: 0,
        status: 'FAIL',
        evidence: ['Missing Organization/WebSite JSON-LD, <title>, and/or <meta name="description">.'],
        explanation: 'AI agents cannot reliably identify the store or publisher identity.',
        recommendedFix: 'Add <title>, <meta name="description">, and an Organization/WebSite JSON-LD block.'
      }));
    }
  }

  // DATA-04: Structured Offer Schema Completeness (5 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'DATA-04',
      category: 'structured_data',
      title: 'Structured Offer Schema Completeness',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Not applicable to non-commerce or unsupported pages.'],
      explanation: 'Offer schema applies only to commerce pages.',
      recommendedFix: 'For commerce pages, attach Schema.org Offer/AggregateOffer objects to each Product.'
    }));
  } else if (structuredData.offersFound > 0 && structuredData.offersWithPriceAndCurrency > 0 && structuredData.offersWithAvailability > 0) {
    criteria.push(criterion({
      id: 'DATA-04',
      category: 'structured_data',
      title: 'Structured Offer Schema Completeness',
      maxPoints: 5,
      awardedPoints: 5,
      status: 'PASS',
      evidence: [
        `${structuredData.offersFound} Offer(s) found.`,
        `${structuredData.offersWithPriceAndCurrency} with valid numeric price+ISO currency; ${structuredData.offersWithAvailability} with availability.`
      ],
      explanation: 'Structured Offer objects include machine-readable price, currency, and availability.',
      recommendedFix: 'No action required.'
    }));
  } else if (structuredData.offersFound > 0) {
    criteria.push(criterion({
      id: 'DATA-04',
      category: 'structured_data',
      title: 'Structured Offer Schema Completeness',
      maxPoints: 5,
      awardedPoints: 2,
      status: 'PARTIAL',
      evidence: [
        `${structuredData.offersFound} Offer(s) found, ${structuredData.offersWithPriceAndCurrency} with price+currency, ${structuredData.offersWithAvailability} with availability.`
      ],
      explanation: 'Offer objects are present but missing complete price, currency, or availability properties.',
      recommendedFix: 'Populate numeric price, ISO 4217 priceCurrency, and Schema.org availability URL on every Offer.'
    }));
  } else {
    criteria.push(criterion({
      id: 'DATA-04',
      category: 'structured_data',
      title: 'Structured Offer Schema Completeness',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['Zero Schema.org Offer or AggregateOffer objects detected.'],
      explanation: 'Products lack structured Offer schemas for automated price and stock parsing.',
      recommendedFix: 'Attach Schema.org Offer objects with price, priceCurrency, and availability to every Product.'
    }));
  }

  // =========================================================================
  // 3. COMMERCE READINESS (20 pts: 6 + 5 + 5 + 4)
  // =========================================================================

  // COMM-01: Public Pricing & Currency (6 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'COMM-01',
      category: 'commerce_readiness',
      title: 'Public Pricing & Currency',
      maxPoints: 6,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['No commerce signals detected; pricing check marked not applicable.'],
      explanation: 'Public pricing and currency evaluation applies to commerce storefronts.',
      recommendedFix: 'For storefronts, publish explicit numeric prices and ISO 4217 currency codes in JSON-LD and catalog.json.'
    }));
  } else {
    const structuredPricingCount = structuredData.offersWithPriceAndCurrency + agentReady.withPriceAndCurrency;
    const currencies = Array.from(new Set([...structuredData.currencies, ...agentReady.currencies]));
    if (structuredPricingCount > 0) {
      criteria.push(criterion({
        id: 'COMM-01',
        category: 'commerce_readiness',
        title: 'Public Pricing & Currency',
        maxPoints: 6,
        awardedPoints: 6,
        status: 'PASS',
        evidence: [
          `Machine-readable price + ISO currency found in ${structuredData.offersWithPriceAndCurrency} JSON-LD offer(s) and ${agentReady.withPriceAndCurrency} AgentReady product(s).`,
          `Currencies observed: ${currencies.join(', ')}`
        ],
        explanation: 'Public numeric pricing and ISO 4217 currency codes are exposed in machine-readable formats.',
        recommendedFix: 'No action required.'
      }));
    } else if (html.commerceHints.includes('currency-price-text-detected')) {
      criteria.push(criterion({
        id: 'COMM-01',
        category: 'commerce_readiness',
        title: 'Public Pricing & Currency',
        maxPoints: 6,
        awardedPoints: 2,
        status: 'PARTIAL',
        evidence: ['Price text appears in unstructured HTML, but no machine-readable price+currency was found in JSON-LD or AgentReady catalog.'],
        explanation: 'Prices are only visible as raw text, increasing extraction errors for AI agents.',
        recommendedFix: 'Expose numeric price and ISO 4217 priceCurrency in Schema.org Offer JSON-LD and /agentready/catalog.json.'
      }));
    } else {
      criteria.push(criterion({
        id: 'COMM-01',
        category: 'commerce_readiness',
        title: 'Public Pricing & Currency',
        maxPoints: 6,
        awardedPoints: 0,
        status: 'FAIL',
        evidence: ['No structured pricing or ISO currency metadata found.'],
        explanation: 'Public pricing and currency are not machine-readable.',
        recommendedFix: 'Add explicit numeric prices and ISO 4217 currency codes to Offer JSON-LD and public catalog feeds.'
      }));
    }
  }

  // COMM-02: Public Stock Availability (5 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'COMM-02',
      category: 'commerce_readiness',
      title: 'Public Stock Availability',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Not applicable to non-commerce or unsupported pages.'],
      explanation: 'Stock availability applies only to commerce storefronts.',
      recommendedFix: 'For storefronts, publish explicit InStock/OutOfStock/PreOrder values.'
    }));
  } else {
    const availCount = structuredData.offersWithAvailability + agentReady.withAvailability;
    if (availCount > 0) {
      criteria.push(criterion({
        id: 'COMM-02',
        category: 'commerce_readiness',
        title: 'Public Stock Availability',
        maxPoints: 5,
        awardedPoints: 5,
        status: 'PASS',
        evidence: [
          `Machine-readable availability found in ${structuredData.offersWithAvailability} JSON-LD offer(s) and ${agentReady.withAvailability} AgentReady product(s).`
        ],
        explanation: 'Explicit public availability states (e.g., InStock, OutOfStock, PreOrder) are exposed.',
        recommendedFix: 'No action required.'
      }));
    } else {
      criteria.push(criterion({
        id: 'COMM-02',
        category: 'commerce_readiness',
        title: 'Public Stock Availability',
        maxPoints: 5,
        awardedPoints: 0,
        status: 'FAIL',
        evidence: ['No structured availability fields detected in JSON-LD or AgentReady catalog.'],
        explanation: 'AI agents cannot determine whether products are currently in stock without explicit availability values.',
        recommendedFix: 'Include Schema.org availability (https://schema.org/InStock, OutOfStock, PreOrder) on every public offer.'
      }));
    }
  }

  // COMM-03: Product Variants & Multi-Offer Structure (5 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'COMM-03',
      category: 'commerce_readiness',
      title: 'Product Variants & Multi-Offer Structure',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Not applicable to non-commerce or unsupported pages.'],
      explanation: 'Variant modeling applies only to commerce storefronts.',
      recommendedFix: 'For multi-variant products, publish explicit variant offers or ProductGroup hasVariant records.'
    }));
  } else if (structuredData.productsWithVariants > 0 || agentReady.withVariants > 0) {
    criteria.push(criterion({
      id: 'COMM-03',
      category: 'commerce_readiness',
      title: 'Product Variants & Multi-Offer Structure',
      maxPoints: 5,
      awardedPoints: 5,
      status: 'PASS',
      evidence: [
        `Variant structures detected in ${structuredData.productsWithVariants} JSON-LD product(s) and ${agentReady.withVariants} AgentReady catalog product(s).`
      ],
      explanation: 'Product variants (SKUs, sizes, colors, or multi-offer pricing) are modeled explicitly.',
      recommendedFix: 'No action required.'
    }));
  } else if (structuredData.productCount > 0 || agentReady.productCount > 0) {
    criteria.push(criterion({
      id: 'COMM-03',
      category: 'commerce_readiness',
      title: 'Product Variants & Multi-Offer Structure',
      maxPoints: 5,
      awardedPoints: 3,
      status: 'PARTIAL',
      evidence: ['Single-offer products detected, with no explicit variant arrays or ProductGroup hasVariant definitions.'],
      explanation: 'Flat single-SKU products are represented, though variant-level modeling is not present (acceptable if products truly have no variants).',
      recommendedFix: 'If products have sizes, colors, or editions, model them with Schema.org hasVariant / multiple Offers and AgentReady variants.'
    }));
  } else {
    criteria.push(criterion({
      id: 'COMM-03',
      category: 'commerce_readiness',
      title: 'Product Variants & Multi-Offer Structure',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['No structured products or variant offers detected.'],
      explanation: 'Variant pricing and SKU attributes are not exposed in machine-readable form.',
      recommendedFix: 'Publish structured product and variant offers via Schema.org JSON-LD or AgentReady catalog.json.'
    }));
  }

  // COMM-04: Public Machine-Readable Catalog Feed (4 pts)
  if (!isCommerce) {
    criteria.push(criterion({
      id: 'COMM-04',
      category: 'commerce_readiness',
      title: 'Public Machine-Readable Catalog Feed',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Not applicable to non-commerce or unsupported pages.'],
      explanation: 'Catalog feeds apply to commerce storefronts.',
      recommendedFix: 'For commerce sites, publish /agentready/catalog.json and /agentready/catalog.md.'
    }));
  } else if (agentReady.catalogValid && agentReady.productCount > 0) {
    criteria.push(criterion({
      id: 'COMM-04',
      category: 'commerce_readiness',
      title: 'Public Machine-Readable Catalog Feed',
      maxPoints: 4,
      awardedPoints: 4,
      status: 'PASS',
      evidence: [`/agentready/catalog.json exposes ${agentReady.productCount} public product record(s).`],
      explanation: 'A dedicated public JSON catalog feed is available for deterministic agent consumption.',
      recommendedFix: 'No action required.'
    }));
  } else if (structuredData.productCount > 0) {
    criteria.push(criterion({
      id: 'COMM-04',
      category: 'commerce_readiness',
      title: 'Public Machine-Readable Catalog Feed',
      maxPoints: 4,
      awardedPoints: 2,
      status: 'PARTIAL',
      evidence: ['Page-level Product JSON-LD is present, but no unified /agentready/catalog.json feed was found.'],
      explanation: 'Agents can read products per page, but lack a consolidated public catalog endpoint.',
      recommendedFix: 'Generate /agentready/catalog.json and /agentready/catalog.md using the AgentReady CLI.'
    }));
  } else {
    criteria.push(criterion({
      id: 'COMM-04',
      category: 'commerce_readiness',
      title: 'Public Machine-Readable Catalog Feed',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['No public catalog JSON feed or Product JSON-LD collection discovered.'],
      explanation: 'No machine-readable public catalog feed is exposed.',
      recommendedFix: 'Publish /agentready/catalog.json with allowlisted, explicitly published public products.'
    }));
  }

  // =========================================================================
  // 4. AI READABILITY (20 pts: 6 + 7 + 4 + 3)
  // =========================================================================

  // READ-01: Semantic HTML Structure (6 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'READ-01',
      category: 'ai_readability',
      title: 'Semantic HTML Structure',
      maxPoints: 6,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'Semantic HTML cannot be evaluated without an HTML document.',
      recommendedFix: 'Scan a reachable HTML page.'
    }));
  } else {
    const landmarkCount = Object.values(html.landmarks).filter(Boolean).length;
    const hasMain = html.landmarks.main;
    const hasSingleH1 = html.headingCounts.h1 === 1;
    const hasLang = Boolean(html.lang);

    let pts = 0;
    if (hasMain) pts += 2;
    if (landmarkCount >= 3) pts += 2;
    else if (landmarkCount >= 1) pts += 1;
    if (hasSingleH1) pts += 1;
    if (hasLang) pts += 1;

    const status = pts >= 5 ? 'PASS' : pts >= 2 ? 'PARTIAL' : 'FAIL';
    const presentLandmarks = Object.entries(html.landmarks).filter(([, v]) => v).map(([k]) => `<${k}>`);
    criteria.push(criterion({
      id: 'READ-01',
      category: 'ai_readability',
      title: 'Semantic HTML Structure',
      maxPoints: 6,
      awardedPoints: pts,
      status,
      evidence: [
        `Landmarks found (${landmarkCount}): ${presentLandmarks.join(', ') || 'none'}`,
        `<h1> count: ${html.headingCounts.h1}, <html lang>: ${html.lang || 'missing'}`
      ],
      explanation:
        status === 'PASS'
          ? 'The page uses clear semantic landmarks, heading hierarchy, and document language.'
          : 'Semantic HTML landmarks, <html lang>, or a single <h1> heading are incomplete.',
      recommendedFix:
        status === 'PASS'
          ? 'No action required.'
          : 'Use <header>, <nav>, <main>, <article>/<section>, a single <h1>, and <html lang="..."> for clean semantic parsing.'
    }));
  }

  // READ-02: Readable Textual Content (7 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'READ-02',
      category: 'ai_readability',
      title: 'Readable Textual Content',
      maxPoints: 7,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'Textual readability requires an HTML document.',
      recommendedFix: 'Scan a reachable HTML page.'
    }));
  } else {
    const { wordCount, textToHtmlRatio, isLikelyJsShell } = html.readability;
    if (wordCount >= 80 && !isLikelyJsShell) {
      criteria.push(criterion({
        id: 'READ-02',
        category: 'ai_readability',
        title: 'Readable Textual Content',
        maxPoints: 7,
        awardedPoints: 7,
        status: 'PASS',
        evidence: [`Extracted ${wordCount} readable words from initial HTML (text-to-HTML ratio: ${textToHtmlRatio}).`],
        explanation: 'Substantial human- and AI-readable text is available directly in the initial HTTP HTML response.',
        recommendedFix: 'No action required.'
      }));
    } else if (wordCount >= 25 && !isLikelyJsShell) {
      criteria.push(criterion({
        id: 'READ-02',
        category: 'ai_readability',
        title: 'Readable Textual Content',
        maxPoints: 7,
        awardedPoints: 4,
        status: 'PARTIAL',
        evidence: [`Extracted ${wordCount} readable words from initial HTML (text-to-HTML ratio: ${textToHtmlRatio}).`],
        explanation: 'Some readable text is present, though key product or page content may still rely on client-side rendering.',
        recommendedFix: 'Server-render core product descriptions, titles, and navigation so HTTP-based AI agents can read them without executing JavaScript.'
      }));
    } else {
      criteria.push(criterion({
        id: 'READ-02',
        category: 'ai_readability',
        title: 'Readable Textual Content',
        maxPoints: 7,
        awardedPoints: 0,
        status: 'FAIL',
        evidence: [
          `Only ${wordCount} readable word(s) extracted from initial HTML.`,
          isLikelyJsShell ? 'Page matches a JavaScript-only SPA shell pattern.' : 'Insufficient server-rendered textual content.'
        ],
        explanation: 'The initial HTML contains minimal readable text, preventing non-JS AI agents from understanding the page.',
        recommendedFix: 'Enable SSR/SSG for public pages or expose an authoritative /llms.txt and /agentready/catalog.md.'
      }));
    }
  }

  // READ-03: Document Metadata & Canonical Clarity (4 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'READ-03',
      category: 'ai_readability',
      title: 'Document Metadata & Canonical Clarity',
      maxPoints: 4,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'HTML head metadata cannot be evaluated without an HTML document.',
      recommendedFix: 'Scan a reachable HTML page.'
    }));
  } else {
    let pts = 0;
    if (html.title) pts += 2;
    if (html.metaDescription) pts += 1;
    if (html.canonicalUrl) pts += 1;
    const status = pts === 4 ? 'PASS' : pts >= 2 ? 'PARTIAL' : 'FAIL';
    criteria.push(criterion({
      id: 'READ-03',
      category: 'ai_readability',
      title: 'Document Metadata & Canonical Clarity',
      maxPoints: 4,
      awardedPoints: pts,
      status,
      evidence: [
        `Title: ${html.title ? `"${html.title.slice(0, 70)}"` : 'missing'}`,
        `Meta description: ${html.metaDescription ? 'present' : 'missing'}`,
        `Canonical link: ${html.canonicalUrl || 'missing'}`
      ],
      explanation:
        status === 'PASS'
          ? 'Title, meta description, and canonical URL are all cleanly declared.'
          : 'One or more core head metadata tags (<title>, meta description, canonical URL) are missing.',
      recommendedFix:
        status === 'PASS'
          ? 'No action required.'
          : 'Add <title>, <meta name="description">, and <link rel="canonical" href="..."> to every public page.'
    }));
  }

  // READ-04: AI-Friendly Text/Markdown Alternative (3 pts)
  if (agentReady.catalogMdOk || (llms.ok && llms.parsed?.valid)) {
    criteria.push(criterion({
      id: 'READ-04',
      category: 'ai_readability',
      title: 'AI-Friendly Text/Markdown Alternative',
      maxPoints: 3,
      awardedPoints: 3,
      status: 'PASS',
      evidence: [
        agentReady.catalogMdOk ? `Markdown catalog accessible at ${agentReady.catalogMdUrl}` : null,
        llms.ok && llms.parsed?.valid ? `Structured Markdown overview accessible at ${llms.url}` : null
      ].filter(Boolean),
      explanation: 'Clean plain-text or Markdown documentation is available for low-token AI ingestion.',
      recommendedFix: 'No action required.'
    }));
  } else {
    criteria.push(criterion({
      id: 'READ-04',
      category: 'ai_readability',
      title: 'AI-Friendly Text/Markdown Alternative',
      maxPoints: 3,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['Neither /llms.txt nor /agentready/catalog.md was available as plain text/Markdown.'],
      explanation: 'No lightweight Markdown/text summary endpoint is published for AI agents.',
      recommendedFix: 'Publish /llms.txt and/or /agentready/catalog.md to give agents concise Markdown context.'
    }));
  }

  // =========================================================================
  // 5. AGENT INTERACTION (15 pts: 5 + 5 + 5)
  // =========================================================================

  // AGNT-01: WebMCP Static Implementation Signals (5 pts)
  if (isUnsupported) {
    criteria.push(criterion({
      id: 'AGNT-01',
      category: 'agent_interaction',
      title: 'WebMCP Static Implementation Signals',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['Target did not return an analyzable HTML document.'],
      explanation: 'WebMCP signal inspection requires an HTML document.',
      recommendedFix: 'Scan a reachable HTML page.'
    }));
  } else if (webMcp.signals.length > 0) {
    criteria.push(criterion({
      id: 'AGNT-01',
      category: 'agent_interaction',
      title: 'WebMCP Static Implementation Signals',
      maxPoints: 5,
      awardedPoints: 5,
      status: 'PASS',
      evidence: [
        ...webMcp.signals,
        'Note: Static signal detection only; runtime execution in a WebMCP browser is evaluated separately under AGNT-02.'
      ],
      explanation: 'Static WebMCP integration signals (scripts, manifest references, or declarative attributes) were detected.',
      recommendedFix: 'Verify actual tool registration and responses in a WebMCP-capable browser using webmcp-evals.json.'
    }));
  } else {
    criteria.push(criterion({
      id: 'AGNT-01',
      category: 'agent_interaction',
      title: 'WebMCP Static Implementation Signals',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['No WebMCP scripts, manifest declarations, modelContext references, or declarative tool attributes detected.'],
      explanation: 'No WebMCP browser tool signals were detected on the page or in the AgentReady manifest.',
      recommendedFix: 'Optionally integrate read-only WebMCP tools (e.g., /agentready/webmcp-products.js) for compatible browsers.'
    }));
  }

  // AGNT-02: WebMCP Runtime Capability Verification (5 pts)
  // CRITICAL RULE: Never treat an unverified WebMCP implementation as working!
  if (webMcp.runtimeVerified === true) {
    // Only possible if an external browser harness explicitly supplied verified runtime results.
    criteria.push(criterion({
      id: 'AGNT-02',
      category: 'agent_interaction',
      title: 'WebMCP Runtime Capability Verification',
      maxPoints: 5,
      awardedPoints: 5,
      status: 'PASS',
      evidence: webMcp.runtimeEvidence || ['Verified via real browser WebMCP runtime harness.'],
      explanation: 'WebMCP tool registration and read-only execution were verified in a browser runtime.',
      recommendedFix: 'No action required.'
    }));
  } else if (webMcp.signals.length > 0) {
    criteria.push(criterion({
      id: 'AGNT-02',
      category: 'agent_interaction',
      title: 'WebMCP Runtime Capability Verification',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'UNVERIFIED',
      evidence: [
        `Static WebMCP signal(s) detected (${webMcp.signals.length}), but HTTP-only scanning does not execute browser JavaScript or invoke navigator/document.modelContext.`,
        'Zero runtime points awarded until verified in a real WebMCP-capable browser.'
      ],
      explanation: 'Detected WebMCP signals are NOT treated as working runtime capabilities. Browser-level execution was not run.',
      recommendedFix: 'Run a real compatible-browser evaluation (e.g., Chrome Labs WebMCP Evals) to verify live tool registration and read-only behavior.'
    }));
  } else {
    criteria.push(criterion({
      id: 'AGNT-02',
      category: 'agent_interaction',
      title: 'WebMCP Runtime Capability Verification',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'NOT_APPLICABLE',
      evidence: ['No WebMCP signals detected; runtime verification is not applicable.'],
      explanation: 'Runtime WebMCP verification only applies when WebMCP signals are present.',
      recommendedFix: 'Add read-only WebMCP tool integration first, then run browser-based runtime verification.'
    }));
  }

  // AGNT-03: Public Read-Only Agent Interface & Safety Signals (5 pts)
  if (agentReady.manifestValid && agentReady.catalogValid) {
    criteria.push(criterion({
      id: 'AGNT-03',
      category: 'agent_interaction',
      title: 'Public Read-Only Agent Interface & Safety Signals',
      maxPoints: 5,
      awardedPoints: 5,
      status: 'PASS',
      evidence: [
        'Public read-only AgentReady manifest and catalog JSON are accessible without authentication.',
        agentReady.manifestWebMcpRef ? 'Manifest declares WebMCP adapter reference.' : 'Manifest declares public static catalog endpoints.'
      ],
      explanation: 'The site exposes a clear, unauthenticated, read-only public interface for AI agents.',
      recommendedFix: 'No action required.'
    }));
  } else if (agentReady.catalogValid || (llms.ok && llms.parsed?.valid && llms.parsed.links.length > 0)) {
    criteria.push(criterion({
      id: 'AGNT-03',
      category: 'agent_interaction',
      title: 'Public Read-Only Agent Interface & Safety Signals',
      maxPoints: 5,
      awardedPoints: 3,
      status: 'PARTIAL',
      evidence: [
        agentReady.catalogValid
          ? 'Public /agentready/catalog.json found without /agentready/manifest.json.'
          : '/llms.txt provides public discovery links, but no structured AgentReady JSON manifest/catalog was found.'
      ],
      explanation: 'Partial read-only agent discovery is available, but a complete structured manifest + catalog pair is missing.',
      recommendedFix: 'Publish both /agentready/manifest.json and /agentready/catalog.json with read-only public endpoints.'
    }));
  } else {
    criteria.push(criterion({
      id: 'AGNT-03',
      category: 'agent_interaction',
      title: 'Public Read-Only Agent Interface & Safety Signals',
      maxPoints: 5,
      awardedPoints: 0,
      status: 'FAIL',
      evidence: ['No public AgentReady manifest/catalog or structured llms.txt interface found.'],
      explanation: 'No dedicated read-only agent discovery interface was detected.',
      recommendedFix: 'Generate /llms.txt, /agentready/manifest.json, and /agentready/catalog.json for safe read-only agent access.'
    }));
  }

  // =========================================================================
  // AGGREGATION
  // =========================================================================
  const statusCounts = {
    PASS: 0,
    PARTIAL: 0,
    FAIL: 0,
    UNVERIFIED: 0,
    NOT_APPLICABLE: 0
  };

  for (const c of criteria) {
    statusCounts[c.status] += 1;
  }

  const categories = CATEGORY_DEFINITIONS.map((cat) => {
    const items = criteria.filter((c) => c.category === cat.id);
    const awardedScore = items.reduce((sum, c) => sum + c.awardedPoints, 0);
    const applicableMaxScore = items
      .filter((c) => c.status !== 'NOT_APPLICABLE')
      .reduce((sum, c) => sum + c.maxPoints, 0);
    const verifiedMaxScore = items
      .filter((c) => c.status === 'PASS' || c.status === 'PARTIAL' || c.status === 'FAIL')
      .reduce((sum, c) => sum + c.maxPoints, 0);

    return {
      id: cat.id,
      name: cat.name,
      maxScore: cat.maxScore,
      applicableMaxScore,
      verifiedMaxScore,
      awardedScore,
      percentageOfApplicable: applicableMaxScore > 0 ? Math.round((awardedScore / applicableMaxScore) * 100) : null
    };
  });

  const totalMaxScore = CATEGORY_DEFINITIONS.reduce((sum, c) => sum + c.maxScore, 0);
  const awardedScore = categories.reduce((sum, c) => sum + c.awardedScore, 0);
  const applicableMaxScore = categories.reduce((sum, c) => sum + c.applicableMaxScore, 0);
  const verifiedMaxScore = categories.reduce((sum, c) => sum + c.verifiedMaxScore, 0);
  const normalizedApplicableScore =
    applicableMaxScore > 0 ? Math.round((awardedScore / applicableMaxScore) * 100) : 0;
  const verificationCoveragePercent =
    applicableMaxScore > 0 ? Math.round((verifiedMaxScore / applicableMaxScore) * 100) : 0;

  // Distinguish detected signals vs verified capabilities vs unverified capabilities
  const detectedSignals = [];
  const verifiedCapabilities = [];
  const unverifiedCapabilities = [];

  if (homepage.ok) verifiedCapabilities.push('http_public_accessibility');
  if (robots.ok && robots.parsed?.present) verifiedCapabilities.push('robots_txt_readable');
  if (sitemap.ok && sitemap.parsed?.valid) verifiedCapabilities.push('sitemap_xml_valid');
  if (llms.ok && llms.parsed?.valid) verifiedCapabilities.push('llms_txt_valid');
  if (structuredData.validBlockCount > 0 && structuredData.schemaOrgContextDetected) {
    verifiedCapabilities.push('schema_org_jsonld_valid');
  }
  if (structuredData.productCount > 0) verifiedCapabilities.push('schema_org_product_present');
  if (agentReady.manifestValid) verifiedCapabilities.push('agentready_manifest_valid');
  if (agentReady.catalogValid) verifiedCapabilities.push('agentready_catalog_valid');

  if (html && html.commerceHints.length > 0) detectedSignals.push(...html.commerceHints);
  if (webMcp.signals.length > 0) {
    detectedSignals.push('webmcp_static_signals_detected');
    if (webMcp.runtimeVerified === true) {
      verifiedCapabilities.push('webmcp_runtime_verified');
    } else {
      unverifiedCapabilities.push('webmcp_runtime_execution');
    }
  }
  if (homepage.blockedByRobots) unverifiedCapabilities.push('homepage_blocked_by_robots');
  if (sitemap.blockedByRobots) unverifiedCapabilities.push('sitemap_blocked_by_robots');
  if (llms.blockedByRobots) unverifiedCapabilities.push('llms_txt_blocked_by_robots');
  if (agentReady.blockedByRobots) unverifiedCapabilities.push('agentready_endpoints_blocked_by_robots');

  return {
    scoringVersion: SCORING_VERSION,
    disclaimer: SCORING_DISCLAIMER,
    siteProfile,
    summary: {
      awardedScore,
      totalMaxScore,
      applicableMaxScore,
      verifiedMaxScore,
      normalizedApplicableScore,
      verificationCoveragePercent,
      grade: gradeFromScore(awardedScore, applicableMaxScore),
      statusCounts
    },
    categories,
    criteria,
    capabilities: {
      detectedSignals: Array.from(new Set(detectedSignals)),
      verifiedCapabilities: Array.from(new Set(verifiedCapabilities)),
      unverifiedCapabilities: Array.from(new Set(unverifiedCapabilities))
    }
  };
}
