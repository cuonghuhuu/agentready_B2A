# AgentReady B2A

**Make public commerce information easier for compatible AI agents to discover and use.**

[![CI](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml/badge.svg)](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](package.json)
[![Status](https://img.shields.io/badge/Status-Experimental-orange)](TEST_REPORT.md)

AgentReady B2A is an **experimental, open-source toolkit and installable Agent Skill** for developers of e-commerce websites. It generates a truthful **public product catalog** and can expose **read-only WebMCP tools** for compatible browser agents.

**B2A = Business-to-Agent.** The goal is to make a commerce site intelligible to AI agents without giving them unauthorized access to private data or transactions.

> **Current scope (v0.2.0):** snapshot-based public catalogs, not live stock, database synchronization, universal platform support, checkout, or agent-driven purchases. The example store is fictional.

## What works today

| Capability | Status |
| --- | --- |
| CLI: inspect, init, generate, verify | Implemented |
| Public catalog (JSON + Markdown) and manifest | Implemented |
| `llms.txt` and standalone Schema.org JSON-LD output | Implemented; optional discovery metadata |
| Read-only product search and lookup via WebMCP | Implemented; simulated tests passed |
| WebMCPify runtime | Bundled under MIT, with preserved notice |
| AgentMarkup Next.js configuration helper | Optional integration; **real storefront build unverified** |
| Google Chrome Labs WebMCP smoke-eval fixture | Provided; **browser eval unrun** |
| Automatic support for Shopify, WooCommerce, marketplaces, or live databases | **Not yet implemented** |

WebMCP is experimental and not available in every browser. `llms.txt` is optional metadata; publishing it does **not** guarantee discovery by external agents.

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

AgentReady currently requires a JSON export of the store's **already public** product data. It does not connect directly to a production database.

```powershell
node .\bin\agentready.mjs inspect --project "D:\projects\my-shop"
node .\bin\agentready.mjs init --project "D:\projects\my-shop" --site-name "My Shop" --site-url "https://shop.example.com"
```

Connect real approved records to `data/agentready-products.json` and mark public items with `published: true`. Then run:

```powershell
node .\bin\agentready.mjs generate --project "D:\projects\my-shop"
node .\bin\agentready.mjs verify --project "D:\projects\my-shop"
```

Generation refuses to overwrite existing outputs by default; use `--force` only after reviewing the files it owns. Verify actual availability and price again at the store before any purchase.

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

Let **AgentMarkup own `llms.txt`** in this setup to avoid generator collisions. The helper does not inject JSON-LD into dynamic product pages; render page-level structured data from the same authoritative server-side product values.

### Optional read-only WebMCP tools

After generating and deploying the public feed and runtime files, load `/agentready/webmcp-products.js` as an ES module in a compatible site. In supported browsers it registers:

- `agentready_search_products` — search up to 10 public snapshot results.
- `agentready_get_product` — retrieve one published product by ID.

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

**Next:** generalized commerce entities, safe API adapters, tested fashion/electronics fixtures, and live browser WebMCP evaluations. **Later:** platform-specific integrations and separately authorized transactional interfaces. These are plans, **not current capabilities**.

## License and attribution

AgentReady's original code is distributed under the [MIT License](LICENSE). Upstream components and integrations are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); existing third-party copyright notices must be preserved.

Built as an open-source developer tool. Contributions and reproducible bug reports are welcome.
