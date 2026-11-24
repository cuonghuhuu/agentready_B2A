# AgentReady B2A — AI Readiness Scoring Methodology (`v1.0.0`)

> **Disclaimer:** This is an **AgentReady-defined scoring model (`v1.0.0`)**, not an official industry certification or third-party compliance standard.

## 1. Category Weights (Total = 100 Points)

| Category | ID | Maximum Score | Criteria |
| --- | --- | ---: | --- |
| Discovery | `discovery` | **20** | `DISC-01` .. `DISC-05` |
| Structured Data | `structured_data` | **25** | `DATA-01` .. `DATA-04` |
| Commerce Readiness | `commerce_readiness` | **20** | `COMM-01` .. `COMM-04` |
| AI Readability | `ai_readability` | **20** | `READ-01` .. `READ-04` |
| Agent Interaction | `agent_interaction` | **15** | `AGNT-01` .. `AGNT-03` |
| **Total** | | **100** | **19 criteria** |

## 2. Criterion Status Definitions

Every criterion emits one of five deterministic statuses along with `id`, `maxPoints`, `awardedPoints`, `evidence`, `explanation`, and `recommendedFix`:

| Status | Meaning | Counts in `applicableMaxScore`? | Counts in `verifiedMaxScore`? |
| --- | --- | --- | --- |
| `PASS` | Capability verified via real HTTP evidence | Yes | Yes |
| `PARTIAL` | Partially implemented or minor gaps detected | Yes | Yes |
| `FAIL` | Applicable capability missing, invalid, or broken | Yes | Yes |
| `UNVERIFIED` | Could not be verified (e.g., WebMCP browser runtime not run, or `robots.txt` disallowed probe) | Yes | **No** |
| `NOT_APPLICABLE` | Not relevant to the detected site profile (e.g., product offers on a non-commerce page) | **No** | **No** |

## 3. Applicable Maximum Points & Verification Coverage

To avoid penalizing non-commerce sites for missing e-commerce schemas or inflating scores with unverified runtime claims, the scanner reports four explicit summary metrics:

- **`awardedScore`:** Sum of `awardedPoints` across all 19 criteria (`0..100`).
- **`applicableMaxScore`:** Sum of `maxPoints` for criteria where `status !== 'NOT_APPLICABLE'`.
- **`verifiedMaxScore`:** Sum of `maxPoints` for criteria where `status` is `PASS`, `PARTIAL`, or `FAIL`.
- **`normalizedApplicableScore`:** `Math.round((awardedScore / applicableMaxScore) * 100)` (used for grade bands: `A >= 85`, `B >= 70`, `C >= 55`, `D >= 40`, `F < 40`, `N/A` when `applicableMaxScore === 0`).
- **`verificationCoveragePercent`:** `Math.round((verifiedMaxScore / applicableMaxScore) * 100)`.

## 4. Detailed Criteria Reference

### Discovery (20 points)
| ID | Criterion | Max | Scoring Rules |
| --- | --- | ---: | --- |
| `DISC-01` | HTTP Accessibility & Response Status | 4 | `PASS` (4): HTTPS 2xx HTML; `PARTIAL` (3): HTTP 2xx HTML; `FAIL` (1): 2xx non-HTML; `FAIL` (0): non-2xx/network error; `UNVERIFIED` (0): disallowed by `robots.txt`. |
| `DISC-02` | `robots.txt` Presence & Crawlability | 4 | `PASS` (4): readable `robots.txt` permitting `/`; `PARTIAL` (1): exists but blocks `/`; `FAIL` (0): absent/unreadable. |
| `DISC-03` | `sitemap.xml` Discovery | 4 | `PASS` (4): valid `<urlset>`/`<sitemapindex>` with `<loc>` entries; `PARTIAL` (1): HTTP 200 but invalid XML/empty; `FAIL` (0): missing; `UNVERIFIED` (0): disallowed by `robots.txt`. |
| `DISC-04` | `llms.txt` AI Discovery File | 4 | `PASS` (4): Markdown `#` title + links (not HTML fallback); `PARTIAL` (2): valid plain text missing title or links; `FAIL` (0): missing or HTML SPA fallback; `UNVERIFIED` (0): disallowed by `robots.txt`. |
| `DISC-05` | AgentReady Public Manifest & Catalog Discovery | 4 | `PASS` (4): valid `/agentready/manifest.json` AND `/agentready/catalog.json`; `PARTIAL` (2): one of the two; `FAIL` (0): neither; `UNVERIFIED` (0): disallowed by `robots.txt`. |

### Structured Data (25 points)
| ID | Criterion | Max | Scoring Rules |
| --- | --- | ---: | --- |
| `DATA-01` | Schema.org JSON-LD Validity | 7 | `PASS` (7): ≥1 valid JSON-LD block with Schema.org `@context` and 0 malformed blocks; `PARTIAL` (3): valid block(s) alongside malformed block(s) or missing Schema.org `@context`; `FAIL` (0): all malformed or none; `NOT_APPLICABLE` on unsupported non-HTML targets. |
| `DATA-02` | `Product` Structured Data | 8 | Commerce profile only (`NOT_APPLICABLE` for non-commerce). `PASS` (8): all `Product`/`ProductGroup` entities include core metadata (`name` + `description`/`sku`/`brand`/`image`); `PARTIAL` (4): some missing core fields; `FAIL` (0): none. |
| `DATA-03` | Core Site & Organization Metadata | 5 | `PASS` (5): `Organization`/`WebSite`/`Store` JSON-LD + `<title>` + `<meta name="description">`; `PARTIAL` (3): either JSON-LD or head meta; `FAIL` (0): neither. |
| `DATA-04` | Structured Offer Schema Completeness | 5 | Commerce profile only. `PASS` (5): `Offer`/`AggregateOffer` with valid numeric price+ISO currency and availability; `PARTIAL` (2): offers present but incomplete; `FAIL` (0): none. |

### Commerce Readiness (20 points)
All four criteria apply to detected `commerce` profiles (or explicit `--mode commerce`) and are marked `NOT_APPLICABLE` for `non_commerce` / `unsupported` sites.

| ID | Criterion | Max | Scoring Rules |
| --- | --- | ---: | --- |
| `COMM-01` | Public Pricing & Currency | 6 | `PASS` (6): numeric price + ISO 4217 currency in JSON-LD Offer or AgentReady catalog; `PARTIAL` (2): unstructured price text only; `FAIL` (0): none. |
| `COMM-02` | Public Stock Availability | 5 | `PASS` (5): explicit Schema.org or AgentReady availability (`InStock`, `OutOfStock`, `PreOrder`, etc.); `FAIL` (0): absent. |
| `COMM-03` | Product Variants & Multi-Offer Structure | 5 | `PASS` (5): explicit `variants`, `hasVariant`, `ProductGroup`, or multi-offer array; `PARTIAL` (3): flat single-SKU products only; `FAIL` (0): none. |
| `COMM-04` | Public Machine-Readable Catalog Feed | 4 | `PASS` (4): valid `/agentready/catalog.json` with ≥1 product; `PARTIAL` (2): page-level Product JSON-LD only; `FAIL` (0): neither. |

### AI Readability (20 points)
| ID | Criterion | Max | Scoring Rules |
| --- | --- | ---: | --- |
| `READ-01` | Semantic HTML Structure | 6 | Additive up to 6 pts: `<main>` (+2), ≥3 landmarks (+2) or ≥1 (+1), single `<h1>` (+1), `<html lang>` (+1). `PASS` ≥5, `PARTIAL` 2..4, `FAIL` <2. |
| `READ-02` | Readable Textual Content | 7 | `PASS` (7): ≥80 server-rendered readable words and not a JS-only shell; `PARTIAL` (4): 25..79 words; `FAIL` (0): <25 words or JS-only empty shell. |
| `READ-03` | Document Metadata & Canonical Clarity | 4 | `<title>` (+2), `<meta name="description">` (+1), `<link rel="canonical">` (+1). `PASS` 4, `PARTIAL` 2..3, `FAIL` <2. |
| `READ-04` | AI-Friendly Text/Markdown Alternative | 3 | `PASS` (3): valid `/llms.txt` or `/agentready/catalog.md`; `FAIL` (0): neither. |

### Agent Interaction (15 points)
| ID | Criterion | Max | Scoring Rules |
| --- | --- | ---: | --- |
| `AGNT-01` | WebMCP Static Implementation Signals | 5 | `PASS` (5): static script, manifest, `modelContext`, `registerTool`, or declarative `toolname` signal detected; `FAIL` (0): none. |
| `AGNT-02` | WebMCP Runtime Capability Verification | 5 | **Never treated as working from static signals alone.** In HTTP-only scans: `UNVERIFIED` (0) when static WebMCP signals are present, `NOT_APPLICABLE` (0) when none are present. `PASS` (5) requires explicit real-browser runtime verification evidence. |
| `AGNT-03` | Public Read-Only Agent Interface & Safety Signals | 5 | `PASS` (5): valid unauthenticated `/agentready/manifest.json` + `/agentready/catalog.json`; `PARTIAL` (3): `catalog.json` alone or `llms.txt` with links; `FAIL` (0): none. |

## 5. Detected Signals vs. Verified Capabilities

Every scan report explicitly separates:
- **`verifiedCapabilities`:** Facts directly confirmed over HTTP (e.g., `http_public_accessibility`, `schema_org_jsonld_valid`, `agentready_catalog_valid`).
- **`detectedSignals`:** Static hints observed in HTML or manifests (e.g., `webmcp_static_signals_detected`, `currency-price-text-detected`).
- **`unverifiedCapabilities`:** Capabilities that were detected or blocked and could not be executed/verified over HTTP (e.g., `webmcp_runtime_execution`, `llms_txt_blocked_by_robots`).
