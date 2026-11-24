# AgentReady B2A — AI Readiness Scanner Architecture (v0.4)

## 1. Overview & Design Principles

The **AgentReady B2A AI Readiness Scanner** extends the existing zero-dependency Node.js (ESM) toolkit with a local-first, read-only website analysis engine and responsive developer dashboard. Conceptually similar to Lighthouse, it inspects a public website over HTTP/HTTPS for AI-agent discovery, Schema.org commerce data, semantic readability, and WebMCP integration signals.

Design principles:
- **Reuse existing Node.js architecture:** Pure Node.js ESM built-ins (`node:http`, `node:https`, `node:dns/promises`, `node:net`, `node:crypto`, `node:fs/promises`) — zero third-party runtime dependencies and zero microservices.
- **Preserve all V0.3 capabilities:** Existing CLI commands (`inspect`, `init`, `import`, `generate`, `verify`), adapters, canonical variant model, WebMCP runtime, fictional storefront demo (`serve:demo` and `/demo`), and all 31 V0.3 automated tests remain intact.
- **Evidence-only reporting:** Every score and status is derived deterministically from real HTTP responses. Missing, blocked, or unverified capabilities are never fabricated.
- **Local-first security:** The scanner server binds strictly to `127.0.0.1` by default and enforces SSRF, DNS-rebinding, redirect, timeout, size, crawl, and rate-limit protections.

## 2. Module Boundaries

```text
bin/
├── agentready.mjs            # CLI entry point (V0.3 commands + V0.4 `scan` command)
├── serve-demo.mjs            # Preserved V0.3 standalone fictional storefront server (127.0.0.1:4173)
└── serve-scanner.mjs         # Local AI Readiness Scanner dashboard server (127.0.0.1:4174)

src/scanner/
├── index.mjs                 # Public barrel export (`agentready-b2a/scanner`)
├── network-security.mjs      # URL/protocol/port/credential validation, IPv4/IPv6 CIDR blocking,
│                             # DNS resolution + IP pinning, manual redirect revalidation,
│                             # timeouts, streaming byte limits, ScanRateLimiter
├── parsers.mjs               # Untrusted-input parsers: robots.txt, sitemap.xml, llms.txt,
│                             # HTML landmarks/readability/WebMCP signals, Schema.org JSON-LD,
│                             # AgentReady manifest & catalog analyzers
├── scoring.mjs               # Deterministic v1.0.0 scoring model (5 categories, 100 pts, 19 criteria)
├── engine.mjs                # Real HTTP scan orchestrator with live progress callbacks
├── report.mjs                # JSON and bilingual (EN/VI) Markdown report formatters
├── server.mjs                # Local HTTP + SSE server (`/`, `/demo`, `/api/scan`, `/api/scan/stream`, `/api/health`)
└── dashboard/
    ├── index.html            # Responsive Scanner UI (CSP-compliant, zero inline JS/CSS)
    ├── styles.css            # Dark/light developer-tool theme
    └── app.js                # Live SSE client, SVG gauge, filters, EN/VI i18n, JSON/MD download
```

## 3. Scan Execution Data Flow

```text
User (Dashboard UI or CLI `agentready scan`)
  │
  ▼
1. validate_url       ──► Protocol (http/https), port (80/443), no credentials, SSRF host/IP check
  │
  ▼
2. fetch_robots       ──► GET /robots.txt (pinned IP, 512 KiB cap) → parse RFC 9309 rules & Sitemap
  │
  ▼
3. fetch_homepage     ──► Check robots.txt → GET target URL (manual redirect revalidation, 2 MiB cap)
  │                       → parse HTML semantics, readable text, JSON-LD blocks, WebMCP static signals
  ▼
4. fetch_sitemap      ──► Check robots.txt → GET robots Sitemap or /sitemap.xml → parse XML <loc>
  │
  ▼
5. fetch_llms         ──► Check robots.txt → GET /llms.txt (512 KiB cap) → parse Markdown structure
  │
  ▼
6. fetch_agentready   ──► Check robots.txt → probe /agentready/manifest.json, catalog.json,
  │                       (and catalog.md / products.jsonld when AgentReady hints are present)
  ▼
7. evaluate_score     ──► Deterministic scoring engine → Scan Result JSON (v1.0.0)
                          → SSE `result` event / CLI stdout / JSON & Markdown export
```

## 4. Scan Result JSON Schema (`schemaVersion: "1.0.0"`)

```json
{
  "schemaVersion": "1.0.0",
  "scannerVersion": "0.4.0-alpha.1",
  "scanId": "uuid-v4",
  "targetUrl": "https://example.com/",
  "finalUrl": "https://example.com/",
  "origin": "https://example.com",
  "mode": "auto | commerce | general",
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "durationMs": 412,
  "scoringVersion": "1.0.0",
  "disclaimer": "AgentReady-defined scoring model (v1.0.0), not an official industry certification.",
  "siteProfile": "commerce | non_commerce | unsupported",
  "summary": {
    "awardedScore": 94,
    "totalMaxScore": 100,
    "applicableMaxScore": 100,
    "verifiedMaxScore": 95,
    "normalizedApplicableScore": 94,
    "verificationCoveragePercent": 95,
    "grade": "A | B | C | D | F | N/A",
    "statusCounts": {
      "PASS": 17,
      "PARTIAL": 1,
      "FAIL": 0,
      "UNVERIFIED": 1,
      "NOT_APPLICABLE": 0
    }
  },
  "categories": [
    {
      "id": "discovery | structured_data | commerce_readiness | ai_readability | agent_interaction",
      "name": "Discovery",
      "maxScore": 20,
      "applicableMaxScore": 20,
      "verifiedMaxScore": 20,
      "awardedScore": 19,
      "percentageOfApplicable": 95
    }
  ],
  "criteria": [
    {
      "id": "DISC-01",
      "category": "discovery",
      "title": "HTTP Accessibility & Response Status",
      "maxPoints": 4,
      "awardedPoints": 4,
      "status": "PASS | PARTIAL | FAIL | UNVERIFIED | NOT_APPLICABLE",
      "evidence": ["HTTP 200 (text/html; charset=utf-8) at https://example.com/"],
      "explanation": "Human-readable rationale.",
      "recommendedFix": "Concrete developer action."
    }
  ],
  "capabilities": {
    "detectedSignals": ["webmcp_static_signals_detected"],
    "verifiedCapabilities": ["http_public_accessibility", "schema_org_jsonld_valid"],
    "unverifiedCapabilities": ["webmcp_runtime_execution"]
  },
  "metadata": {
    "pageTitle": "Example Store",
    "pageLanguage": "en",
    "httpStatus": 200,
    "contentType": "text/html; charset=utf-8",
    "wordCount": 140,
    "jsonLdBlockCount": 2,
    "productCount": 2,
    "requestsExecuted": 7,
    "maxRequestsBudget": 12
  },
  "probes": [
    {
      "url": "https://example.com/robots.txt",
      "ok": true,
      "statusCode": 200,
      "finalUrl": "https://example.com/robots.txt",
      "contentType": "text/plain",
      "byteLength": 64,
      "durationMs": 12,
      "redirectCount": 0,
      "errorCode": null,
      "error": null
    }
  ]
}
```

## 5. Acceptance Criteria

1. **Real HTTP scanning:** Entering a public URL executes real HTTP probes (no mocked/fabricated results or fake progress timers).
2. **Deterministic 100-point scoring:** Categories sum strictly to 100 (20 + 25 + 20 + 20 + 15); every criterion emits ID, max/awarded points, status, evidence, explanation, and fix.
3. **Honest verification boundaries:** Unverified WebMCP runtime capabilities receive `UNVERIFIED` and `0` points; non-commerce pages mark commerce-only checks `NOT_APPLICABLE` and report `applicableMaxScore` and `verificationCoveragePercent`.
4. **Defense-in-depth security:** Blocks private/loopback/link-local/reserved IPv4 & IPv6, pins DNS-resolved IPs, revalidates every redirect hop, enforces ports/protocols/no-credentials/timeouts/size limits/rate limits, and respects `robots.txt`.
5. **Responsive local dashboard:** Supports URL input, live SSE progress, circular score gauge, category breakdown, filterable criteria, EN/VI language switching, dark/light mode, JSON & Markdown export, and preserves V0.3 fictional storefront demo on `/demo` and `npm run serve:demo`.
6. **Verification:** All 31 existing V0.3 tests preserved; comprehensive V0.4 unit/integration/security tests pass against controlled local fixtures without weakening production defaults.

## 6. Implementation & Testing Plan

- **Phase 1:** Repository inspection, module boundaries, JSON schema, scoring spec, and threat model.
- **Phase 2:** `network-security.mjs`, `parsers.mjs`, `engine.mjs`, `report.mjs`, CLI `scan`.
- **Phase 3:** `scoring.mjs` deterministic evaluator and capability separation.
- **Phase 4:** `server.mjs`, `serve-scanner.mjs`, and `dashboard/` UI.
- **Phase 5:** Automated test suites (`scanner-security`, `scanner-scoring`, `scanner-engine`, `scanner-server`) using controlled local HTTP fixtures and mock DNS lookups, followed by full documentation and patch/archive packaging.
