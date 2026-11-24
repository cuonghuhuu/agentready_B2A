# Security Policy

## Supported versions

AgentReady B2A is experimental and pre-stable. Security fixes target the current development line; no long-term support policy or SLA is promised.

| Version | Status |
| --- | --- |
| v0.2.x | Current experimental line |
| v0.1.x | Prototype; no dedicated security maintenance commitment |

## Reporting a vulnerability

Please avoid posting secrets, proof-of-concept exploits, or sensitive vulnerability details in public issues.

If **GitHub Private Vulnerability Reporting** is enabled for this repository, use the repository's **Security → Report a vulnerability** workflow. Otherwise, use a private contact method listed on the maintainer's GitHub profile to coordinate a responsible report; if none is listed, open a non-sensitive issue requesting a private reporting channel **without including exploit details**.

Include affected version/commit, impact, a minimal non-sensitive reproduction, and expected behavior. Do not test against websites without authorization.

## Security boundaries

AgentReady presently generates **public data snapshots** and offers **read-only** browser tools only. Installing the skill does not authorize accessing or exposing private information.

Contributors and integrators must:

- Export only content the storefront intentionally publishes; review field allowlists before generation.
- Exclude credentials, customer PII, orders, supplier costs, private stock records, and admin endpoints.
- Keep authentication and authorization enforced by the existing store backend.
- Avoid embedding secrets into generated `public/` files or browser JavaScript.
- Treat product descriptions and other website content as untrusted data, including potential prompt-injection text.
- Apply input validation and reasonable bounds to public search and retrieval.
- Never automatically create orders, change carts, charge payments, or bypass website permissions.
- Re-check real price and stock at the authoritative store before any transaction.

WebMCP is experimental. Before deploying a WebMCP integration, validate its behavior in the actual supported browser and origin environment. Snapshot verification alone is not a production security review.

## Disclosure

Maintainers will assess reports and coordinate fixes on a best-effort basis. No response-time or disclosure deadline is guaranteed.
