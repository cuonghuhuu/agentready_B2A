# AgentReady B2A verification report

Environment: Windows, Node.js v24.14.0, npm. Verification run: 2026-11-24.

## Executed

- `npm test` — 10 passed, 0 failed. Covers catalog safety and consistency, output collision protection, the AgentMarkup config helper, simulated WebMCP registration through the WebMCPify runtime, and browsers without WebMCP.
- `npm run demo` — generated seven public resources from fictional sample data; 2 published products included; CLI verification returned `ok:true`.
- HTTP smoke against the local demo server — `/`, `/llms.txt`, catalog JSON, WebMCP adapter, WebMCPify runtime, and JSON-LD returned 200 with expected content; `/package.json` returned 404.
- `npm pack --dry-run` — package contents include the CLI, reusable `agentready` skill, integration helper, runtime with license notice, example, and tests.
- GitHub Actions run [`45315387121`](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45315387121) — all four Node.js 20/22 Linux/Windows jobs passed, including tests, demo generation, and demo verification.
- Upstream working trees — `agentmarkup`, `webmcpify`, and `webmcp-tools` remained clean.

## Not run

- Actual Next.js build with `@agentmarkup/next` installed in a target storefront.
- Google Chrome Labs WebMCP Evals against a WebMCP-capable browser. The fixture is in `examples/ecommerce-demo/webmcp-evals.json`; the default unit suite simulates tool calls and is not a browser test.
- Live deployment, current commerce database, live inventory, checkout/payment, or external agent discovery.

Local file verification does not prove deployed behavior or real-time price and stock.
