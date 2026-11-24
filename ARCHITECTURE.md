# Architecture — AgentReady B2A v0.2.0

## Scope

This document describes the current implementation at v0.2.0, not the long-term universal e-commerce vision.

AgentReady has two distinct roles:

1. **Development-time helper:** the `agentready` skill and Node.js CLI guide a coding agent in inspecting a store, preparing its public data snapshot, generating machine-readable resources, and verifying local consistency.
2. **Optional runtime integration:** a browser-side WebMCP adapter exposes read-only tools against the generated **public snapshot** where the browser supports WebMCP.

## Data flow

```text
Existing storefront (authoritative business data)
     |
     | developer-reviewed export, published:true records only
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
| `skills/agentready/SKILL.md` | Coding-agent workflow and safety instructions |
| `bin/agentready.mjs` | CLI entry point |
| `src/core.mjs` | Inspect/init, source validation, public output generation, consistency verification |
| `src/webmcp-products.js` | Read-only browser tool adapter, fetching the public catalog |
| `src/webmcpify-runtime.js` | Adapted WebMCPify runtime; MIT notice retained |
| `src/integrations/agentmarkup-next.mjs` | Optional AgentMarkup Next.js configuration helper |
| `examples/ecommerce-demo/` | Fictional reproducible storefront fixture and smoke eval |
| `tests/` | Node.js tests including simulated tool registration |

## Integration boundaries

- **Source of truth:** the host application owns product information and security policy.
- **Publication boundary:** only explicitly published records and allowlisted fields are exported. Public output must never contain customer data, secrets, supplier costs, or private order information.
- **WebMCP boundary:** the provided tools only search or read the generated snapshot. Browsers without WebMCP do not register these tools.
- **Structured data:** the standalone JSON-LD artifact is **not** automatically embedded into product detail HTML.
- **AgentMarkup:** optional Next.js helper delegates ownership of `llms.txt` to AgentMarkup to prevent output collisions.

## Verification levels

- **Level 1:** file generation and local consistency — run in tests/demo.
- **Level 2:** simulated WebMCP runtime/tool behavior and local HTTP smoke — covered by the current verification report.
- **Level 3:** real Next.js storefront integration, real browser WebMCP Evals, external agent discovery, and live database data — **not yet verified**.

See [TEST_REPORT.md](TEST_REPORT.md) for the latest recorded run.

## Explicit non-goals for v0.2

No live database adapter, no arbitrary framework auto-integration, no real-time stock/price guarantees, no authenticated order or payment tools, and no guarantee that an external AI agent will crawl `llms.txt`.

## Extension direction

A future adapter layer can represent product variants, services, digital goods, multi-seller offers, and live public commerce APIs independently of platform. Those adapters will require their own tests and security review before being listed as supported.
