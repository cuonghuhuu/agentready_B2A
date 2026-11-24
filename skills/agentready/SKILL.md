---
name: agentready
description: Make an e-commerce website publish truthful public product data and optional read-only WebMCP tools. Inspect the real project, map approved public data, generate and verify catalog resources, and use the AgentMarkup Next.js integration when it fits. Never expose customer data, secrets, checkout, or payment actions.
license: MIT
compatibility: Node.js 20+; a website repository with public product data that can be exported to JSON; optional WebMCP-capable browser for browser checks.
---

# AgentReady B2A Implementation Skill

You are an implementation agent. Make useful changes in the target project, not just an audit. AgentReady B2A is a reusable developer toolkit, not a particular store. Treat demo data as fictional and never claim it represents a target site's real catalog.

## Workflow

1. Inspect the target project, its framework, public product source, existing tests, and current generated files. Identify real site identity and fields; never guess products, prices, availability, URLs, or ownership.
2. Initialize only missing adapter files:

   `node <skill>/bin/agentready.mjs init --project <target> --site-name "Store" --site-url https://store.example`

3. Connect the target's actual public data to `data/agentready-products.json` or a safe export. If the storefront already exports a local public Shopify `/products.json`, WooCommerce Store API JSON, or Schema.org JSON-LD catalog inside the project, normalize it through the allowlisted importer (which validates variants through `src/commerce-model.mjs`):

   `node <skill>/bin/agentready.mjs import --project <target> --source <relative-export.json> [--format auto|shopify|woocommerce|jsonld] [--currency USD] [--trusted-public-source] [--allow-attributes color,size] --force`

   **Public-Source Trust Contract:**
   - **Shopify:** Requires reliable parent publication evidence (`published_at` past ISO timestamp or `published: true`, active status) AND explicit per-variant publication evidence (`variant.published: true` or past `variant.published_at`), unless the developer explicitly attests a verified public storefront export via `--trusted-public-source`. Availability alone never establishes publication.
   - **WooCommerce Store API:** Accepts only publicly published, non-hidden records with explicit `is_in_stock` / `is_on_backorder` availability and a valid integer `currency_minor_unit`.
   - **Schema.org JSON-LD:** Intended only for JSON-LD extracted from public pages; explicitly private, hidden, draft, or `published: false` products and offers are rejected.
   - **Attributes:** Only developer-approved public merchandising attributes (`DEFAULT_ALLOWED_ATTRIBUTES` or `--allow-attributes`) are exported; arbitrary or nested attributes are dropped.

   Set `published:true` only for records the site already publishes. Never fabricate missing publication evidence or availability. Exclude customer data, supplier costs, secrets, private inventory, and internal notes. Do not create an unauthenticated endpoint or bypass existing authorization.
   If a product has optional `variants`, export only variant records explicitly marked `published:true`. Never infer publication from the parent; keep public `id`, `sku`, `label`, `price`, `currency`, `availability`, same-origin `url`, and approved `attributes` only. See `docs/COMMERCE_VARIANTS.md` in the AgentReady source; current support is snapshot-based.
4. Generate outputs:

   `node <skill>/bin/agentready.mjs generate --project <target>`

   Generation refuses existing output and symlink escapes. Use `--force` only after reviewing the exact AgentReady-owned files that will be replaced.
5. For Next.js, the optional `@agentmarkup/next` adapter helper is `src/integrations/agentmarkup-next.mjs`. Use it with AgentMarkup's `withAgentmarkup()` and let AgentMarkup own `llms.txt`. Follow current upstream guidance for dynamic SSR routes; the helper does not add product JSON-LD to those pages.
6. Optionally load `/agentready/webmcp-products.js` as a module after generating the catalog. It exposes only read-only product search (with variant-isolated matching, currency-safe `maxPrice` filtering, and compact `matchingOffers` summaries reflecting matched variant price/availability) and full-detail product lookup from the public snapshot. WebMCP is experimental and must be checked in an actual compatible browser. For route-wide inventory, use the WebMCPify skill and its approval manifest.
7. Verify the generated files:

   `node <skill>/bin/agentready.mjs verify --project <target>`

   Run relevant target tests and builds. Local verification confirms file consistency only; it does not prove deployment, live inventory, search indexing, or browser compatibility.
8. For a supported browser smoke test, see `references/UPSTREAM.md` and the Google Chrome Labs eval fixture. Report only checks that were actually run.
9. Summarize changed files, test/build results, generated endpoints, and remaining limits.

## Safety

- Catalogs and tools must contain public data only.
- Tools stay read-only; no cart mutation, checkout, payment, account access, or private API calls.
- The feed is a snapshot. It does not promise current stock or price at order time.
- Render product JSON-LD on detail pages from the same server-side data used for the page, with safe serialization, and avoid duplicate schemas.
- Preserve the target app's architecture and unrelated work.
