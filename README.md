# AgentReady B2A

<!-- AGENTREADY-OPEN-SOURCE-HEADER -->
<div align="center">

### B2A · Business to Agent

**Make public e-commerce data discoverable and usable by compatible AI agents.**

[![CI](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml/badge.svg)](https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-2ea44f.svg)](LICENSE)
![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933.svg)
![Status: Experimental](https://img.shields.io/badge/status-experimental-orange.svg)

[Quick start](#try-the-example) · [Skill installation](#install-the-agent-skill) · [Architecture](ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

> **Project status — experimental v0.2.0.** Public catalog snapshots and simulated read-only WebMCP tool tests are available. Live-store adapters, actual WebMCP browser evaluation and automatic commerce-platform compatibility have **not** been verified. See [TEST_REPORT.md](TEST_REPORT.md).

AgentReady B2A is a reusable open-source toolkit for e-commerce developers. It helps a website publish a truthful public product snapshot and optionally expose safe, read-only product search tools to compatible browser agents. It is not a storefront or a solution for a particular business. The included shop data is fictional demonstration data.

The installable Agent Skill identifier remains **`agentready`** for compatibility.

## Features

- Node.js CLI to inspect a project, initialize a public-data adapter, generate resources, and verify output.
- Public `llms.txt`, JSON and Markdown catalogs, standalone Schema.org `ItemList`/`Product`/`Offer` JSON-LD, and an output manifest.
- Read-only WebMCP product search and lookup, using WebMCPify's MIT licensed runtime for feature detection, scoped registration, and teardown.
- Optional AgentMarkup Next.js config helper. AgentMarkup owns `llms.txt` and links to the AgentReady catalog, preventing competing generators from replacing each other's output.
- A Google Chrome Labs WebMCP Evals smoke fixture for deterministic browser checks without an LLM key.
- No production dependencies in the base CLI; Node.js 20 or newer.

## Try the example

From the project root:

```powershell
npm test
npm run demo
npm run serve:demo
```

Open `http://127.0.0.1:4173`. The demo contains fictional sample items. Browser tool registration requires WebMCP support; the catalog and page work without it.

To run the Chrome Labs smoke evals against a running compatible browser page, build/install the upstream `webmcp-evals` CLI and run:

```sh
webmcp-evals smoke -u http://127.0.0.1:4173 -e examples/ecommerce-demo/webmcp-evals.json -v
```

These evals make concrete calls and require no model API key. They are separate from the simulated WebMCP unit tests.

## Use with an e-commerce website

Inspect and initialize a target project:

```powershell
node .\bin\agentready.mjs inspect --project "D:\projects\my-shop"
node .\bin\agentready.mjs init --project "D:\projects\my-shop" --site-name "My Shop" --site-url "https://shop.example.com"
```

Connect the target site's real public product source to `data/agentready-products.json`. Only products marked `published: true` are exported. The generator allowlists public fields and rejects external product URLs, unsafe paths, duplicate IDs, invalid prices, and invalid currencies.

```powershell
node .\bin\agentready.mjs generate --project "D:\projects\my-shop"
node .\bin\agentready.mjs verify --project "D:\projects\my-shop"
```

Generation refuses existing output by default. Use `--force` only after checking the AgentReady-owned output files. The feed is a build-time snapshot: it does not connect to a database, provide live stock, or transact. Product detail pages that need JSON-LD should render it from their own server-side product data.

### Optional AgentMarkup integration for Next.js

Install the toolkit from the GitHub repository in the target site and add AgentMarkup:

```sh
npm install --save-dev git+https://github.com/cuonghuhuu/agentready_B2A.git @agentmarkup/next
```

Wrap the existing Next.js config. The helper configures AgentMarkup's generated `llms.txt` to link to the AgentReady catalog and sets AgentMarkup as the sole owner of that file:

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

AgentMarkup's build-time JSON-LD does not automatically cover fully dynamic SSR product pages. Follow its current Next.js package guidance for those routes and use the same server-side product values as the page.

### Optional WebMCP tools

After generating and deploying the public feed and runtime files, load the module in the existing layout:

```tsx
<Script type="module" src="/agentready/webmcp-products.js" strategy="afterInteractive" />
```

It registers `agentready_search_products` and `agentready_get_product` only when WebMCP exists. Both read the public snapshot. They do not access user accounts, carts, checkout, payment, or private APIs. WebMCP is experimental; compatibility must be verified in the target browser.

For broader route inventory and browser verification, install the upstream [WebMCPify skill](https://github.com/TueJon/webmcpify) and follow its reviewed manifest workflow. Its license notice is preserved in the bundled runtime.

## Install the Agent Skill

Run the PowerShell installer from this repository:

```powershell
.\install-codex.ps1
```

It installs the skill under the unchanged identifier `agentready`. Then invoke `$agentready` in a website project. Review target-project changes and generated public data before deployment.

## Development and CI

```sh
npm test
npm run demo
node bin/agentready.mjs verify --project examples/ecommerce-demo
```

GitHub Actions runs the test suite and verifies the demo on Node.js 20 and 22 for pushes and pull requests.

## Upstream integrations and licenses

- [AgentMarkup](https://github.com/agentmarkup/agentmarkup) — optional Next.js adapter; MIT. No upstream source is copied.
- [WebMCPify](https://github.com/TueJon/webmcpify) — its JavaScript runtime is bundled under MIT with the full copyright/license header retained.
- [GoogleChromeLabs/webmcp-tools](https://github.com/GoogleChromeLabs/webmcp-tools) — upstream WebMCP Evals smoke-fixture format; Apache-2.0. No upstream source is copied.

The toolkit's original code is MIT licensed; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Project documentation

| Document | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Current modules, data flow, and technical limitations. |
| [Contributing](CONTRIBUTING.md) | Development workflow and pull request expectations. |
| [Security](SECURITY.md) | Security boundaries and private vulnerability reporting. |
| [Changelog](CHANGELOG.md) | Version history and outstanding work. |
| [Test report](TEST_REPORT.md) | Verification evidence and tests not yet run. |
| [Third-party notices](THIRD_PARTY_NOTICES.md) | Attribution for reused upstream components. |

Contributions and bug reports are welcome. This project is not affiliated with or endorsed by AgentMarkup, WebMCPify, or Google Chrome Labs.
