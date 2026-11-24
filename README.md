# AgentReady B2A

**Make public commerce information easier for compatible AI agents to discover and use.**

[![CI](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml/badge.svg)](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](package.json)
[![Status](https://img.shields.io/badge/Status-Experimental-orange)](TEST_REPORT.md)

AgentReady B2A is an **experimental, open-source toolkit and installable Agent Skill** for developers of e-commerce websites. It generates a truthful **public product catalog** and can expose **read-only WebMCP tools** for compatible browser agents.

**B2A = Business-to-Agent.** The goal is to make a commerce site intelligible to AI agents without giving them unauthorized access to private data or transactions.

> **Current scope (v0.3 development branch):** snapshot-based public catalogs with optional explicitly-published product variants and local file import adapters (Shopify, WooCommerce Store API, Schema.org JSON-LD). Not live stock, database synchronization, live platform API integration, checkout, or agent-driven purchases. The example fixtures are fictional.

## What works today

| Capability | Status |
| --- | --- |
| CLI: inspect, init, import, generate, verify | Implemented |
| Local public catalog import adapters (Shopify `/products.json`, WooCommerce Store API JSON, Schema.org JSON-LD) | Implemented; local file exports only, strict attribute allowlist & trust contract |
| Public catalog (JSON + Markdown), optional validated variants (`src/commerce-model.mjs`), and manifest | Implemented |
| `llms.txt` and standalone Schema.org JSON-LD output | Implemented; optional discovery metadata |
| Read-only product search (variant-isolated, currency-safe `maxPrice`, matched-variant summaries & compact `matchingOffers`) and detail lookup via WebMCP | Implemented; simulated tests passed |
| WebMCPify runtime | Bundled under MIT, with preserved notice |
| AgentMarkup Next.js configuration helper | Optional integration; **real storefront build unverified** |
| Google Chrome Labs WebMCP smoke-eval fixture | Provided; **browser eval unrun** |
| Live database sync, live Shopify/WooCommerce API polling, or transactional checkout | **Not implemented** |

WebMCP is experimental and not available in every browser. `llms.txt` is optional metadata; publishing it does **not** guarantee discovery by external agents.

## Development preview: commerce variants & public catalog adapters (v0.3)

The v0.3 feature branch adds:

- **Canonical variant normalization (`src/commerce-model.mjs`):** optional, explicitly published (`published: true`) product variants with canonical `label`, `sku`, `price`, `currency`, `availability`, same-origin `url`, and allowlisted `attributes` (up to 100 variants per product and 30 attributes per variant). Existing flat product snapshots remain supported.
- **Local public catalog import adapters (`src/adapters.mjs`, `agentready import`):** converts developer-exported local Shopify `/products.json`, WooCommerce Store API JSON, or Schema.org JSON-LD files into allowlisted `data/agentready-products.json` records while reusing `src/commerce-model.mjs`.
- **Variant-isolated WebMCP search (`src/webmcp-products.js`):** separates product-level fields from variant-specific attributes so aggregated parent options never contaminate sibling variants, evaluates query terms, `maxPrice`, `currency`, and `availability` on the same matching variant, refuses raw cross-currency `maxPrice` comparisons without an explicit `currency`, and reports the actual matched variants' price/availability and compact `matchingOffers` in search while reserving full `variants` for `agentready_get_product`.

### Public-source trust contract (importers)

Each local importer enforces an explicit trust contract before writing `data/agentready-products.json`:

- **Shopify (`--format shopify`):** Requires reliable parent publication evidence (`published_at` valid non-future ISO timestamp or `published: true`, with active/absent status) **and** explicit per-variant publication evidence (`variant.published: true` or valid non-future `variant.published_at`). Availability alone does not establish publication. For verified public storefront exports (such as Shopify's public `/products.json`), the developer may pass `--trusted-public-source` (`trustedPublicSource: true`), which still rejects any explicitly private/unpublished record or variant.
- **WooCommerce Store API (`--format woocommerce`):** Accepts only publicly published, non-hidden records with explicit `is_in_stock` / `is_on_backorder` availability and a valid integer `currency_minor_unit` (`0..6`).
- **Schema.org JSON-LD (`--format jsonld`):** Intended solely for JSON-LD extracted from already-public pages. Explicitly private, hidden, draft, archived, or `published: false` products and offers are rejected, as are offers with missing/unknown availability or mixed currencies on a single product.
- **Public attribute allowlist:** Only developer-approved merchandising attributes (`DEFAULT_ALLOWED_ATTRIBUTES`, or an explicit `--allow-attributes` list) are imported; unapproved keys (such as `supplier_cost` or `customer_email`) and nested object values are dropped with a warning.

See [Commerce variants](docs/COMMERCE_VARIANTS.md) for the input contract, synthetic fashion/electronics fixtures, safeguards, and tests. **Local file adapters do not imply live storefront API integration or live stock synchronization.**

## Quick start

Requirements: **Node.js 20+** and Git.

```bash
git clone https://github.com/cuonghuhuu/agentready_B2A.git
cd agentready_B2A
npm test
npm run demo
npm run serve:demo
```

Visit **http://127.0.0.1:4173**. The demo exposes fictional products at `/agentready/catalog.json` and `/agentready/catalog.md` with an optional browser tool adapter.

## Install the Agent Skill (Codex)

From the cloned repository on Windows PowerShell:

```powershell
.\install-codex.ps1
```

Restart Codex, open your own storefront repository, and ask:

```text
Use $agentready to inspect this e-commerce application, connect only
approved public catalog data, generate AI-readable output, and verify it.
Do not expose private fields or change checkout or payment flows.
```

The installable skill identifier remains **`agentready`**. Review the proposed changes and data field allowlist before publishing them.

## Use the CLI with your own store

AgentReady currently requires a local JSON export of the store's **already public** product data. It does not connect directly to a production database.

```powershell
node .\bin\agentready.mjs inspect --project "D:\projects\my-shop"
node .\bin\agentready.mjs init --project "D:\projects\my-shop" --site-name "My Shop" --site-url "https://shop.example.com"
```

Either connect real approved records directly to `data/agentready-products.json` (marking public items and variants with `published: true`), or normalize an existing local public Shopify/WooCommerce/JSON-LD export inside the project:

```powershell
node .\bin\agentready.mjs import --project "D:\projects\my-shop" --source "data/shopify-products.json" --format auto --currency USD --trusted-public-source --force
node .\bin\agentready.mjs generate --project "D:\projects\my-shop"
node .\bin\agentready.mjs verify --project "D:\projects\my-shop"
```

Generation and import refuse to overwrite existing outputs by default and block path traversal, source/output collisions, and symlink escapes; use `--force` only after reviewing the files owned by AgentReady. Verify actual availability and price again at the store before any purchase.

### Optional AgentMarkup integration (Next.js)

Install `@agentmarkup/next` and AgentReady in the target app:

```bash
npm install --save-dev git+https://github.com/cuonghuhuu/agentready_B2A.git @agentmarkup/next
```

```js
import { withAgentmarkup } from '@agentmarkup/next';
import { createAgentMarkupConfig } from 'agentready-b2a/integrations/agentmarkup-next';

const nextConfig = {};
const agentMarkupConfig = createAgentMarkupConfig({
  siteName: 'My Shop',
  siteUrl: 'https://shop.example.com',
  siteDescription: 'Public information about the shop and its products.'
});

export default withAgentmarkup(agentMarkupConfig, nextConfig);
```

AgentReady currently always generates `public/llms.txt`. Do not run two generators over that path without reviewing ownership and build order; automatic coexistence has not been verified. If using AgentMarkup, explicitly reconcile its discovery output with the AgentReady catalog links. The helper does not inject JSON-LD into dynamic product pages; render page-level structured data from the same authoritative server-side product values.

### Optional read-only WebMCP tools

After generating and deploying the public feed and runtime files, load `/agentready/webmcp-products.js` as an ES module in a compatible site. In supported browsers it registers:

- `agentready_search_products` — search up to 10 public snapshot results with variant-isolated query/price/currency/availability matching, matched-variant price/availability summaries, and compact `matchingOffers`.
- `agentready_get_product` — retrieve one published product by ID, including full public `variants` when present.

Tools are **read-only** and do not support accounts, cart mutations, checkout, or payments. See [testing evidence](TEST_REPORT.md). To run a real compatible-browser smoke evaluation, follow [the upstream instructions](skills/agentready/references/UPSTREAM.md) and use `examples/ecommerce-demo/webmcp-evals.json`.

## Architecture, development, and community

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Modules, data flow, verified scope, and known gaps |
| [Testing report](TEST_REPORT.md) | Executed checks versus unrun integration/browser tests |
| [Security policy](SECURITY.md) | Reporting vulnerabilities and security boundaries |
| [Contributing](CONTRIBUTING.md) | Running tests and submitting changes |
| [Changelog](CHANGELOG.md) | Published development milestones |
| [Third-party notices](THIRD_PARTY_NOTICES.md) | Attribution for upstream code and references |

Local checks:

```bash
npm test
npm run demo
npm run verify:demo
```

GitHub Actions tests Node.js **20 and 22** on **Linux and Windows**. CI passing does not substitute for a real e-commerce deployment or browser interoperability test.

## Roadmap

**Next:** live browser WebMCP evaluations, real storefront build verification, and safe public API sync patterns. **Later:** platform-specific integrations and separately authorized transactional interfaces. These are plans, **not current capabilities**.

## License and attribution

AgentReady's original code is distributed under the [MIT License](LICENSE). Upstream components and integrations are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); existing third-party copyright notices must be preserved.

Built as an open-source developer tool. Contributions and reproducible bug reports are welcome.
