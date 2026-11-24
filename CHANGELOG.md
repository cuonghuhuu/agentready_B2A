[Tiếng Việt](docs/vi/CHANGELOG.md) · [Home](README.md)

# Changelog

Notable documented changes to AgentReady B2A are recorded here. This file describes repository development; it does not imply any GitHub Release or npm publication has occurred.

## [Unreleased]

- No additional runtime changes.

## [0.3.0-alpha.2] — 2026-11-24 — [GitHub release](https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.2)

- Portable `agentready` skill with its own runtime, license and references.
- Reproducible packaging and CI drift checks; four distribution tests (35 total).
- CI PR #8: six passing Node.js 20/22 jobs across Windows, Linux and macOS.
- Bilingual installation guides with explicit live-client verification limits.
- No commerce runtime changes or V0.4 Scanner release. See [release notes](docs/RELEASE_ALPHA2.md).

## [0.3.0-alpha.1] — 2026-11-24 — [GitHub release](https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.1)

### Added (development)
- Optional explicitly-published product variant normalization (`src/commerce-model.mjs`) with canonical `label`, duplicate SKU/ID checks, parent-currency validation, and variant-specific offer metadata.
- Local public catalog import adapters (`src/adapters.mjs` and `agentready import` CLI subcommand) for Shopify `/products.json`, WooCommerce Store API JSON, and Schema.org JSON-LD, reusing `src/commerce-model.mjs` validation.
- Synthetic fashion and electronics source fixtures, adapter regression tests, and variant-isolated WebMCP search tests.

### Fixed & Hardened
- **BUG-001 (Variant publication evidence):** Shopify variants now require explicit per-variant publication evidence (`variant.published: true` or valid non-future `variant.published_at`) or an explicit developer-declared `--trusted-public-source` (`trustedPublicSource: true`) provenance flag; availability alone never establishes publication.
- **BUG-002 (Attribute allowlist & sanitized labels):** Replaced arbitrary attribute acceptance in `src/adapters.mjs` with a strict developer-approved public attribute allowlist (`DEFAULT_ALLOWED_ATTRIBUTES` plus optional `--allow-attributes`), dropping unapproved keys (`supplier_cost`, `customer_email`) and nested objects, and reconstructing Shopify variant `label` strictly from approved public options whenever any option is rejected.
- **BUG-003 (Variant search isolation & offer consistency):** Stopped copying aggregated Shopify option values onto parent product attributes, separated product-level fields from variant-specific attributes and sibling SKUs, enforced variant-discriminating term matching so parent descriptions mentioning sibling variant values cannot contaminate other variants, and selected a single internally consistent representative offer (`InStock` → `PreOrder` → `OutOfStock`, lowest price in tier) for `price`/`availability` in both WebMCP summaries and JSON-LD offer aggregation while exposing `priceRange` separately.
- **BUG-004 (Private JSON-LD & container rejection):** Rejected JSON-LD products, offers, and nested products under private, hidden, draft, archived, or `published: false` ancestor containers (`ItemList`, `ListItem`, `@graph`), and documented the public-source trust contract for all three importers.
- Prevented raw cross-currency `maxPrice` comparisons in WebMCP search and JSON-LD offer aggregation; multi-currency catalogs require an explicit ISO 4217 `currency` parameter when filtering by `maxPrice`.
- Validated WooCommerce `currency_minor_unit` scaling, blocked source/output path collisions, and added symlink output escape protection in both `importCatalog` and `generate`.

- Prevented forced generation from overwriting its configured source and forced import from overwriting the AgentReady configuration; added regression tests.

### Documentation
- Updated `README.md`, `ARCHITECTURE.md`, `TEST_REPORT.md`, and `skills/agentready/SKILL.md` with the public-source trust contract, attribute allowlist, and variant-isolated WebMCP search behavior.

## [0.2.0] — 2026-11-24

### Added
- AgentReady B2A repository and reusable `agentready` Agent Skill.
- Optional AgentMarkup Next.js configuration helper.
- WebMCPify-based read-only WebMCP runtime with preserved MIT notice.
- Google Chrome Labs-compatible WebMCP Evals smoke fixture.
- Local CLI validation, generated demo catalog, and CI matrix for Node.js 20/22 on Linux/Windows.

### Known limitations
- Public catalog is a build-time JSON snapshot, not a database/live inventory adapter.
- A real Next.js storefront integration build and real browser WebMCP evaluation have not yet been run.
- Live storefront API integrations have not been implemented.

See [TEST_REPORT.md](TEST_REPORT.md) for recorded verification evidence.
