---
name: agentready
description: Make an e-commerce website publish truthful public product data and optional read-only WebMCP tools. Use when inspecting a storefront repository, importing approved public Shopify/WooCommerce/JSON-LD catalogs, generating llms.txt/catalog.json/catalog.md/products.jsonld/manifest.json, or verifying public catalog outputs. Never expose customer data, secrets, checkout, or payment actions.
license: MIT
compatibility: Requires Node.js 20+ (zero external runtime dependencies). Cross-platform on Windows, Linux, and macOS. Optional WebMCP-capable browser for live browser checks.
metadata:
  author: cuonghuhuu
  version: "0.3.0-alpha.1"
  repository: https://github.com/cuonghuhuu/agentready_B2A
---

# AgentReady B2A Implementation Skill

You are an implementation agent. Make useful, verified changes in the target storefront repository, not just a theoretical audit. AgentReady B2A is a reusable developer toolkit, not a particular store. Treat demo data as fictional and never claim it represents a target site's real catalog.

This skill directory is **self-contained**: its zero-dependency ESM runtime lives inside `scripts/` (`scripts/agentready.mjs`), with bundled licenses (`LICENSE`, `THIRD_PARTY_NOTICES.md`) and references (`references/COMMERCE_VARIANTS.md`, `references/UPSTREAM.md`). Always run commands using the installed skill directory path (`<skill>`), quoting paths that may contain spaces or non-ASCII characters.

## Workflow

1. **Inspect** the target project, its framework, public product source, existing tests, and current generated files. Identify real site identity and fields; never guess products, prices, availability, URLs, or ownership:

   ```bash
   node "<skill>/scripts/agentready.mjs" inspect --project "<target>"
   ```

2. **Initialize** only missing adapter files:

   ```bash
   node "<skill>/scripts/agentready.mjs" init --project "<target>" --site-name "Store" --site-url "https://store.example"
   ```

3. **Connect approved public product data** to `data/agentready-products.json` or normalize a reviewed local public export (Shopify `/products.json`, WooCommerce Store API JSON, or Schema.org JSON-LD) through the allowlisted importer:

   ```bash
   node "<skill>/scripts/agentready.mjs" import --project "<target>" --source "<relative-export.json>" [--format auto|shopify|woocommerce|jsonld] [--currency USD] [--trusted-public-source] [--allow-attributes color,size]
   ```

   Use `--force` only after the developer approves replacing the existing catalog. Use `--trusted-public-source` or custom attribute keys only after explicit review of provenance and public visibility.

   **Public-Source Trust Contract:**
   - **Shopify:** Requires reliable parent publication evidence (`published_at` past ISO timestamp or `published: true`, active status) AND explicit per-variant publication evidence (`variant.published: true` or past `variant.published_at`), unless the developer explicitly attests a verified public storefront export via `--trusted-public-source`. Availability alone never establishes publication.
   - **WooCommerce Store API:** Accepts only publicly published, non-hidden records with explicit `is_in_stock` / `is_on_backorder` availability and a valid integer `currency_minor_unit`.
   - **Schema.org JSON-LD:** Intended only for JSON-LD extracted from public pages; explicitly private, hidden, draft, or `published: false` products and offers are rejected.
   - **Attributes:** Only developer-approved public merchandising attributes (`DEFAULT_ALLOWED_ATTRIBUTES` or `--allow-attributes`) are exported; arbitrary or nested attributes are dropped.

   Set `published: true` only for records the site already publishes. Never fabricate missing publication evidence or availability. Exclude customer data, supplier costs, secrets, private inventory, and internal notes. Do not create an unauthenticated endpoint or bypass existing authorization.
   For optional product `variants`, see [Commerce Variants reference](references/COMMERCE_VARIANTS.md). Export only variants explicitly marked `published: true`; never infer publication from the parent.

4. **Generate** public snapshot outputs:

   ```bash
   node "<skill>/scripts/agentready.mjs" generate --project "<target>"
   ```

   Generation refuses existing outputs and symlink escapes. Use `--force` only after reviewing the exact AgentReady-owned files (`public/llms.txt` and `public/agentready/*`) that will be replaced.

5. **Optional Next.js AgentMarkup integration:** Use `scripts/src/integrations/agentmarkup-next.mjs` (or `agentready-b2a/integrations/agentmarkup-next`) with AgentMarkup's `withAgentmarkup()`. AgentReady always emits `public/llms.txt`; explicitly reconcile file ownership and build order before using both generators. See [Upstream reference](references/UPSTREAM.md).

6. **Optional read-only WebMCP tools:** Load `/agentready/webmcp-products.js` as an ES module after generating and deploying the catalog. It exposes only read-only product search (`agentready_search_products`) and exact product lookup (`agentready_get_product`) from the public snapshot. WebMCP is experimental and must be verified in a real compatible browser.

7. **Verify** generated files:

   ```bash
   node "<skill>/scripts/agentready.mjs" verify --project "<target>"
   ```

   Run relevant target tests and builds. Local verification confirms file consistency only; it does not prove deployment, live inventory, search indexing, or browser compatibility.

8. **Browser smoke evaluation:** For a supported browser smoke test, see [Upstream reference](references/UPSTREAM.md) and the Google Chrome Labs eval fixture. Report only checks that were actually run.

9. **Summarize** changed files, test/build results, generated endpoints, and remaining limits.

## Safety Boundaries

- Catalogs and tools must contain **public data only**.
- Tools stay **read-only**; no cart mutation, checkout, payment, account access, or private API calls.
- No mandatory MCP servers or background daemons are required.
- The feed is a snapshot; it does not promise current stock or price at order time.
- Render product JSON-LD on detail pages from the same server-side data used for the page, with safe serialization, and avoid duplicate schemas.
- Preserve the target app's architecture and unrelated work.
