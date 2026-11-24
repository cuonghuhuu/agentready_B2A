import crypto from 'node:crypto';
import {
  DEFAULT_SECURITY_POLICY,
  FetchError,
  SecurityError,
  safeFetch,
  validateTargetUrl
} from './network-security.mjs';
import {
  analyzeAgentReadyCatalog,
  analyzeStructuredData,
  parseHtmlDocument,
  parseLlmsTxt,
  parseRobotsTxt,
  parseSitemapXml
} from './parsers.mjs';
import { evaluateReadiness } from './scoring.mjs';

export const SCAN_SCHEMA_VERSION = '1.0.0';
export const SCANNER_VERSION = '0.4.0-alpha.1';

function isHtmlContentType(ct) {
  const lower = String(ct || '').toLowerCase();
  return lower.includes('text/html') || lower.includes('application/xhtml+xml');
}

function safeJsonParse(text) {
  try {
    return { ok: true, data: JSON.parse(text), error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

/**
 * Executes a real, SSRF-hardened HTTP-based AI Readiness scan of a public website URL.
 */
export async function scanWebsite(rawUrl, options = {}) {
  const scanId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const mode = options.mode || 'auto';
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};

  const policy = {
    ...DEFAULT_SECURITY_POLICY,
    ...(options.securityPolicy || {})
  };
  const maxRequests = policy.maxRequestsPerScan || DEFAULT_SECURITY_POLICY.maxRequestsPerScan;
  let requestCount = 0;

  const emit = (step, status, detail = '') => {
    try {
      onProgress({
        scanId,
        step,
        status,
        detail,
        timestamp: new Date().toISOString(),
        requestCount
      });
    } catch {
      // Never let progress listener failures abort a scan
    }
  };

  // Step 1: Validate target URL
  emit('validate_url', 'running', 'Validating URL protocol, port, credentials, and SSRF rules...');
  const validated = validateTargetUrl(rawUrl, policy);
  const origin = validated.url.origin;
  emit('validate_url', 'done', `Validated origin ${origin}`);

  const probes = [];

  async function budgetedFetch(targetUrl, fetchOpts = {}) {
    if (requestCount >= maxRequests) {
      throw new FetchError(
        'CRAWL_LIMIT_EXCEEDED',
        `Scan request budget exceeded (${maxRequests} requests).`,
        { maxRequests, url: targetUrl }
      );
    }
    requestCount += 1;
    const probeRecord = {
      url: targetUrl,
      ok: false,
      statusCode: null,
      finalUrl: null,
      contentType: null,
      byteLength: 0,
      durationMs: 0,
      redirectCount: 0,
      errorCode: null,
      error: null
    };
    try {
      const res = await safeFetch(targetUrl, {
        securityPolicy: policy,
        dnsLookup: options.dnsLookup,
        timeoutMs: fetchOpts.timeoutMs ?? policy.timeoutMs,
        maxBytes: fetchOpts.maxBytes ?? policy.maxBytes,
        headers: fetchOpts.headers
      });
      probeRecord.ok = res.statusCode >= 200 && res.statusCode < 300;
      probeRecord.statusCode = res.statusCode;
      probeRecord.finalUrl = res.finalUrl;
      probeRecord.contentType = String(res.headers['content-type'] || '');
      probeRecord.byteLength = res.byteLength;
      probeRecord.durationMs = res.durationMs;
      probeRecord.redirectCount = res.redirectChain.length;
      probes.push(probeRecord);
      return { res, probe: probeRecord };
    } catch (err) {
      probeRecord.errorCode = err.code || err.name || 'FETCH_ERROR';
      probeRecord.error = err.message;
      probes.push(probeRecord);
      if (err instanceof SecurityError && fetchOpts.rethrowSecurity !== false) {
        throw err;
      }
      return { res: null, probe: probeRecord, error: err };
    }
  }

  // Step 2: Fetch robots.txt first so we can respect crawl restrictions
  emit('fetch_robots', 'running', `Fetching ${origin}/robots.txt`);
  const robotsUrl = `${origin}/robots.txt`;
  const robotsFetch = await budgetedFetch(robotsUrl, {
    maxBytes: Math.min(policy.maxBytes, 512 * 1024),
    rethrowSecurity: true
  });
  const robotsParsed =
    robotsFetch.res && robotsFetch.probe.ok && !/^\s*(?:<!doctype\s+html|<html\b)/i.test(robotsFetch.res.body)
      ? parseRobotsTxt(robotsFetch.res.body)
      : null;

  const robotsObs = {
    url: robotsUrl,
    ok: Boolean(robotsFetch.probe.ok && robotsParsed),
    statusCode: robotsFetch.probe.statusCode,
    parsed: robotsParsed,
    error: robotsFetch.probe.error
  };
  emit(
    'fetch_robots',
    'done',
    robotsObs.ok ? `robots.txt retrieved (${robotsParsed.groupCount} group(s))` : 'robots.txt unavailable or absent'
  );

  const checkRobots = (pathname) => {
    if (!robotsParsed) return { allowed: true, matchedRule: null };
    return robotsParsed.isPathAllowed(pathname);
  };

  // Step 3: Fetch target homepage / URL (respecting robots.txt)
  const targetPath = validated.url.pathname || '/';
  const homeRobots = checkRobots(targetPath);
  let homepageObs;
  let htmlParsed = null;

  if (!homeRobots.allowed) {
    emit('fetch_homepage', 'skipped', `Disallowed by robots.txt (${homeRobots.matchedRule})`);
    homepageObs = {
      url: validated.href,
      finalUrl: validated.href,
      ok: false,
      isHtml: false,
      blockedByRobots: true,
      robotsRule: homeRobots.matchedRule,
      statusCode: null,
      contentType: null,
      redirectCount: 0,
      error: `Blocked by robots.txt (${homeRobots.matchedRule})`
    };
  } else {
    emit('fetch_homepage', 'running', `Fetching ${validated.href}`);
    const homeFetch = await budgetedFetch(validated.href, { rethrowSecurity: true });
    const isHtml = Boolean(homeFetch.res && isHtmlContentType(homeFetch.probe.contentType));
    if (homeFetch.res && homeFetch.probe.ok && isHtml) {
      htmlParsed = parseHtmlDocument(homeFetch.res.body);
    }
    homepageObs = {
      url: validated.href,
      finalUrl: homeFetch.probe.finalUrl || validated.href,
      ok: homeFetch.probe.ok,
      isHtml,
      blockedByRobots: false,
      robotsRule: null,
      statusCode: homeFetch.probe.statusCode,
      contentType: homeFetch.probe.contentType,
      redirectCount: homeFetch.probe.redirectCount,
      byteLength: homeFetch.probe.byteLength,
      durationMs: homeFetch.probe.durationMs,
      error: homeFetch.probe.error
    };
    emit(
      'fetch_homepage',
      'done',
      homepageObs.ok ? `HTTP ${homepageObs.statusCode} (${homepageObs.byteLength} bytes)` : homepageObs.error || `HTTP ${homepageObs.statusCode}`
    );
  }

  // Use the final origin after any validated homepage redirects for well-known probes
  const effectiveOrigin = homepageObs.finalUrl ? new URL(homepageObs.finalUrl).origin : origin;

  // Step 4: Fetch sitemap.xml (prefer Sitemap directive from robots.txt if same-origin)
  let sitemapCandidate = `${effectiveOrigin}/sitemap.xml`;
  if (robotsParsed?.sitemaps?.length > 0) {
    try {
      const candidateUrl = new URL(robotsParsed.sitemaps[0], effectiveOrigin);
      if (candidateUrl.origin === effectiveOrigin) {
        sitemapCandidate = candidateUrl.href;
      }
    } catch {
      // ignore invalid sitemap URL in robots.txt
    }
  }
  const sitemapPath = new URL(sitemapCandidate).pathname;
  const sitemapRobots = checkRobots(sitemapPath);
  let sitemapObs;

  if (!sitemapRobots.allowed) {
    emit('fetch_sitemap', 'skipped', `Disallowed by robots.txt (${sitemapRobots.matchedRule})`);
    sitemapObs = {
      url: sitemapCandidate,
      ok: false,
      blockedByRobots: true,
      robotsRule: sitemapRobots.matchedRule,
      statusCode: null,
      parsed: null,
      error: null
    };
  } else {
    emit('fetch_sitemap', 'running', `Fetching ${sitemapCandidate}`);
    const smFetch = await budgetedFetch(sitemapCandidate, { rethrowSecurity: false });
    const parsedSm = smFetch.res && smFetch.probe.ok ? parseSitemapXml(smFetch.res.body) : null;
    sitemapObs = {
      url: sitemapCandidate,
      ok: smFetch.probe.ok,
      blockedByRobots: false,
      robotsRule: null,
      statusCode: smFetch.probe.statusCode,
      parsed: parsedSm,
      error: smFetch.probe.error
    };
    emit(
      'fetch_sitemap',
      'done',
      parsedSm?.valid ? `Found ${parsedSm.urlCount} URL(s) in sitemap` : 'No valid sitemap found'
    );
  }

  // Step 5: Fetch /llms.txt
  const llmsUrl = `${effectiveOrigin}/llms.txt`;
  const llmsRobots = checkRobots('/llms.txt');
  let llmsObs;

  if (!llmsRobots.allowed) {
    emit('fetch_llms', 'skipped', `Disallowed by robots.txt (${llmsRobots.matchedRule})`);
    llmsObs = {
      url: llmsUrl,
      ok: false,
      blockedByRobots: true,
      robotsRule: llmsRobots.matchedRule,
      statusCode: null,
      parsed: null,
      error: null
    };
  } else {
    emit('fetch_llms', 'running', `Fetching ${llmsUrl}`);
    const llmsFetch = await budgetedFetch(llmsUrl, {
      maxBytes: Math.min(policy.maxBytes, 512 * 1024),
      rethrowSecurity: false
    });
    const parsedLlms = llmsFetch.res && llmsFetch.probe.ok ? parseLlmsTxt(llmsFetch.res.body) : null;
    llmsObs = {
      url: llmsUrl,
      ok: llmsFetch.probe.ok,
      blockedByRobots: false,
      robotsRule: null,
      statusCode: llmsFetch.probe.statusCode,
      parsed: parsedLlms,
      error: llmsFetch.probe.error
    };
    emit(
      'fetch_llms',
      'done',
      parsedLlms?.valid ? `/llms.txt parsed (${parsedLlms.links.length} link(s))` : '/llms.txt not found'
    );
  }

  // Step 6: Probe AgentReady public discovery endpoints
  const arRobots = checkRobots('/agentready/manifest.json');
  const manifestUrl = `${effectiveOrigin}/agentready/manifest.json`;
  const catalogUrl = `${effectiveOrigin}/agentready/catalog.json`;
  const catalogMdUrl = `${effectiveOrigin}/agentready/catalog.md`;
  const productsJsonLdUrl = `${effectiveOrigin}/agentready/products.jsonld`;

  let manifestData = null;
  let catalogData = null;
  let catalogMdOk = false;
  let externalJsonLd = { attempted: false, valid: false, data: null, error: null };

  if (!arRobots.allowed) {
    emit('fetch_agentready', 'skipped', `Disallowed by robots.txt (${arRobots.matchedRule})`);
  } else {
    emit('fetch_agentready', 'running', `Probing ${effectiveOrigin}/agentready/ endpoints`);
    const manifestFetch = await budgetedFetch(manifestUrl, { rethrowSecurity: false });
    if (manifestFetch.res && manifestFetch.probe.ok) {
      const parsed = safeJsonParse(manifestFetch.res.body);
      if (parsed.ok) manifestData = parsed.data;
    }

    const catalogFetch = await budgetedFetch(catalogUrl, { rethrowSecurity: false });
    if (catalogFetch.res && catalogFetch.probe.ok) {
      const parsed = safeJsonParse(catalogFetch.res.body);
      if (parsed.ok) catalogData = parsed.data;
    }

    // Only fetch catalog.md and products.jsonld if manifest/catalog or llms.txt hints at AgentReady (saves requests on non-AgentReady sites)
    const shouldProbeExtra = Boolean(manifestData || catalogData || llmsObs.parsed?.mentionsAgentReady);
    if (shouldProbeExtra && requestCount < maxRequests) {
      const mdFetch = await budgetedFetch(catalogMdUrl, { rethrowSecurity: false });
      if (mdFetch.res && mdFetch.probe.ok && !/^\s*(?:<!doctype\s+html|<html\b)/i.test(mdFetch.res.body)) {
        catalogMdOk = mdFetch.res.body.trim().length > 0;
      }
    }
    if (shouldProbeExtra && requestCount < maxRequests) {
      externalJsonLd.attempted = true;
      const jldFetch = await budgetedFetch(productsJsonLdUrl, { rethrowSecurity: false });
      if (jldFetch.res && jldFetch.probe.ok) {
        const parsed = safeJsonParse(jldFetch.res.body);
        externalJsonLd = {
          attempted: true,
          valid: parsed.ok,
          data: parsed.data,
          error: parsed.error
        };
      } else {
        externalJsonLd.attempted = false;
      }
    }
    emit(
      'fetch_agentready',
      'done',
      manifestData || catalogData ? 'AgentReady public artifacts discovered' : 'No AgentReady endpoints found'
    );
  }

  const agentReadyAnalysis = analyzeAgentReadyCatalog(manifestData, catalogData);
  const agentReadyObs = {
    ...agentReadyAnalysis,
    blockedByRobots: !arRobots.allowed,
    robotsRule: arRobots.matchedRule,
    manifestUrl,
    catalogUrl,
    catalogMdUrl,
    catalogMdOk
  };

  // Combine HTML JSON-LD + optional /agentready/products.jsonld
  const structuredData = analyzeStructuredData(htmlParsed?.jsonLdBlocks || [], externalJsonLd);

  // Combine static WebMCP signals (HTML + AgentReady manifest)
  const combinedWebMcpSignals = [
    ...(htmlParsed?.webMcpSignals || []),
    ...(agentReadyAnalysis.manifestWebMcpRef ? ['AgentReady manifest declares WebMCP integration'] : [])
  ];

  const webMcpObs = {
    signals: Array.from(new Set(combinedWebMcpSignals)),
    runtimeVerified: false, // HTTP scanner never executes browser JS or verifies WebMCP runtime
    runtimeEvidence: []
  };

  // Step 7: Score deterministically
  emit('evaluate_score', 'running', 'Computing deterministic AI Readiness score...');
  const evaluation = evaluateReadiness(
    {
      homepage: homepageObs,
      robots: robotsObs,
      sitemap: sitemapObs,
      llms: llmsObs,
      agentReady: agentReadyObs,
      html: htmlParsed,
      structuredData,
      webMcp: webMcpObs
    },
    { mode }
  );
  emit('evaluate_score', 'done', `Score ${evaluation.summary.awardedScore}/${evaluation.summary.applicableMaxScore} applicable (${evaluation.summary.verificationCoveragePercent}% verified)`);

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startedMs;

  return {
    schemaVersion: SCAN_SCHEMA_VERSION,
    scannerVersion: SCANNER_VERSION,
    scanId,
    targetUrl: validated.href,
    finalUrl: homepageObs.finalUrl,
    origin: effectiveOrigin,
    mode,
    startedAt,
    finishedAt,
    durationMs,
    ...evaluation,
    metadata: {
      pageTitle: htmlParsed?.title || null,
      pageLanguage: htmlParsed?.lang || null,
      httpStatus: homepageObs.statusCode,
      contentType: homepageObs.contentType,
      wordCount: htmlParsed?.readability?.wordCount ?? 0,
      jsonLdBlockCount: structuredData.totalBlocks,
      productCount: Math.max(structuredData.productCount, agentReadyObs.productCount),
      requestsExecuted: requestCount,
      maxRequestsBudget: maxRequests
    },
    probes
  };
}
