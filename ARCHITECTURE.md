[Tiếng Việt](docs/vi/ARCHITECTURE.md) · [Home](README.md)

# Architecture — AgentReady B2A (v0.3 Alpha)

## Scope

This document describes the current implementation in the v0.3 alpha, not the long-term universal e-commerce vision.

AgentReady has two distinct roles:

1. **Development-time helper:** the `agentready` skill and Node.js CLI guide a coding agent in inspecting a store, optionally normalizing local public exports (Shopify, WooCommerce Store API, Schema.org JSON-LD) into `data/agentready-products.json`, generating machine-readable resources, and verifying local consistency.
2. **Optional runtime integration:** a browser-side WebMCP adapter exposes read-only tools against the generated **public snapshot** where the browser supports WebMCP.

## Data flow

```text
Existing storefront (authoritative business data)
     |
     | optional local public export (Shopify / WooCommerce / JSON-LD)
     v
CLI: import (src/adapters.mjs + src/commerce-model.mjs)
     |
     | developer-reviewed allowlisted public records, published:true only
     v
data/agentready-products.json
     |
     v
CLI: init / generate / verify  (bin/agentready.mjs, src/core.mjs)
     |
     +--> public/llms.txt
     +--> public/agentready/catalog.json
     +--> public/agentready/catalog.md
     +--> public/agentready/products.jsonld
     +--> public/agentready/manifest.json
     +--> public/agentready/webmcp-products.js
     +--> public/agentready/webmcpify-runtime.js
                                        |
                                        v
                            compatible browser's WebMCP
                             search_products / get_product
```

The snapshot does not automatically refresh when source products, prices, or stock change. `verify` checks local source/output consistency; it is **not** live price verification.

## Source modules

| Path | Responsibility |
| --- | --- |
| `skills/agentready/SKILL.md` | Coding-agent workflow, public-source trust contract, and safety instructions |
| `bin/agentready.mjs` | CLI entry point (`inspect`, `init`, `import`, `generate`, `verify`) |
| `src/adapters.mjs` | Local public catalog importers for Shopify `/products.json`, WooCommerce Store API JSON, and Schema.org JSON-LD, reusing `src/commerce-model.mjs` and enforcing `DEFAULT_ALLOWED_ATTRIBUTES` |
| `src/commerce-model.mjs` | Canonical explicitly-public sellable variant validation and normalization |
| `src/core.mjs` | Inspect/init, source validation, symlink-safe public output generation, consistency verification |
| `src/webmcp-products.js` | Read-only browser tool adapter with variant-isolated, currency-safe search and matched-variant compact `matchingOffers` responses |
| `src/webmcpify-runtime.js` | Adapted WebMCPify runtime; MIT notice retained |
| `src/integrations/agentmarkup-next.mjs` | Optional AgentMarkup Next.js configuration helper |
| `examples/` | Fictional reproducible storefront demo and synthetic fashion/electronics variant fixtures |
| `tests/` | Node.js unit and simulated WebMCP tests |

## Integration boundaries & public-source trust contract

- **Source of truth:** the host application owns product information and security policy.
- **Publication boundary:** only explicitly published records and developer-approved allowlisted fields/attributes (`DEFAULT_ALLOWED_ATTRIBUTES` or explicit `allowedAttributes`) are exported.
  - **Shopify:** requires reliable parent publication evidence (`published_at` valid non-future timestamp or `published: true`) AND explicit per-variant publication evidence (`variant.published: true` or valid non-future `variant.published_at`), unless the developer explicitly attests a verified public storefront export via `trustedPublicSource: true` (`--trusted-public-source`). Availability alone never establishes publication.
  - **WooCommerce Store API:** accepts only published, non-hidden records with explicit `is_in_stock` / `is_on_backorder` availability and valid integer `currency_minor_unit` (`0..6`).
  - **Schema.org JSON-LD:** intended only for JSON-LD extracted from public pages; explicitly private, hidden, draft, archived, or `published: false` products and offers are rejected.
- **Filesystem boundary:** both `importCatalog` and `generate` enforce project-directory containment, block source/output path collisions, refuse overwrites without `--force`, and reject symlink traversals or symlink output targets.
- **WebMCP boundary:** the provided tools only search or read the generated snapshot. Variant-isolated search separates product-level fields from variant-specific attribute keys and sibling SKUs, evaluates query terms, `maxPrice`, `currency`, and `availability` on the same matching variant, refuses cross-currency `maxPrice` comparisons without an explicit `currency`, and reports the actual matched variants' price/availability plus compact `matchingOffers` while reserving full `variants` for `agentready_get_product`. Browsers without WebMCP do not register these tools.
- **Structured data:** the standalone JSON-LD artifact is **not** automatically embedded into product detail HTML.
- **AgentMarkup:** optional Next.js helper provides configuration only. AgentReady always emits `public/llms.txt`; developers must explicitly reconcile file ownership and build order. Automatic coexistence is unverified.

## Verification levels

- **Level 1:** file generation, adapter normalization, variant validation, attribute allowlisting, and local consistency — run in unit tests/demo.
- **Level 2:** simulated WebMCP runtime/tool behavior (including variant-isolated and multi-currency search checks) — covered in unit tests.
- **Level 3:** real Next.js storefront integration, real browser WebMCP Evals, external agent discovery, and live database/API data — **not yet verified**.

See [TEST_REPORT.md](TEST_REPORT.md) for the latest recorded run.

## Explicit non-goals

No live database adapter, no live authenticated store API polling, no arbitrary framework auto-integration, no real-time stock/price guarantees, no authenticated order or payment tools, and no guarantee that an external AI agent will crawl `llms.txt`.
