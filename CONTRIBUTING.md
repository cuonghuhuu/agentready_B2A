# Contributing to AgentReady B2A

Thanks for helping make commerce websites more understandable to compatible AI agents.

## Before you start

This is an **experimental, read-only toolkit**, not a payment or ordering agent. Please open an issue before making broad architectural or protocol changes. Smaller fixes and documentation improvements can go straight to a pull request.

## Development

Requirements: Node.js **20+** and npm.

```sh
npm test
npm run demo
npm run verify:demo
```

The demo uses fictional products. The current unit suite and CI cover generated resources and simulated WebMCP integration; they **do not** prove browser interoperability or integration with a live storefront.

## Pull requests

1. Fork the repository or create a short-lived feature branch.
2. Keep changes focused and maintain compatibility with the installable `agentready` skill where possible.
3. Add or adjust automated tests for behavior changes.
4. Run the relevant commands above and report the results, including anything not run.
5. Update documentation when CLI options, output formats, security behavior, or supported platforms change.
6. State the source and license of any third-party code included. Preserve copyright notices and update `THIRD_PARTY_NOTICES.md`.

In your PR, explain **what changed, why, how it was verified, and remaining limitations**. Avoid claiming Shopify, WooCommerce, browser-agent, or live-inventory support without actual integration tests.

## Design principles

- Prefer adapters over special cases for one merchant or product category.
- Reuse existing website services. Never bypass server-side authorization.
- Publish only explicitly approved, public fields.
- Keep tool actions read-only until a separate threat model, permission model and transaction design are reviewed.
- Bound catalog size and tool outputs; avoid feeding entire websites to language models.
- Treat `llms.txt` and WebMCP as optional interoperability features, not guaranteed AI discovery channels.
- Avoid secrets, customer records, private inventory, supplier costs, and credentials in examples, tests, PR descriptions or screenshots.

## Reporting security issues

Follow [SECURITY.md](SECURITY.md). Do not post exploitation details in public issues.
