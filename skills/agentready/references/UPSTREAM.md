# Upstream integrations

AgentReady B2A composes maintained upstream tools without changing their repositories.

## AgentMarkup

The `src/integrations/agentmarkup-next.mjs` helper exports `createAgentMarkupConfig()` for use with `withAgentmarkup()` from `@agentmarkup/next`. It configures AgentMarkup to own the generated `llms.txt` and publish links to the AgentReady JSON, Markdown, and JSON-LD catalog resources. This avoids two generators overwriting the same file. It adds a global WebSite schema; it does not synthesize product detail pages or cover dynamic SSR routes.

For fully dynamic product routes, follow the current upstream Next.js documentation and render product JSON-LD from the same server-side data as the page. Keep one owner per generated path.

## WebMCPify

`src/webmcpify-runtime.js` is sourced from `TueJon/webmcpify`'s JavaScript runtime template. Its full MIT notice is kept at the top of the file. The AgentReady product adapter imports `createToolScope()` to register two read-only catalog tools, handle missing WebMCP safely, roll back registration failures, and remove its scope on page exit.

The runtime is browser code, not a package dependency. For broader tool inventory, manifest review, and browser verification, use the upstream WebMCPify skill in the target project. Do not register duplicate AgentReady tools.

## Google Chrome Labs WebMCP tools

`examples/ecommerce-demo/webmcp-evals.json` uses the upstream `webmcp-evals smoke` fixture shape to check both product search and exact product lookup against a running compatible browser. The smoke command requires no LLM provider key. It is not run by the default Node test suite because it requires the upstream CLI, a running server, and a WebMCP-capable browser.

The eval fixture and documentation are integration points only; no Google Chrome Labs source is copied. Report browser compatibility only after running the smoke command in the intended browser environment.
