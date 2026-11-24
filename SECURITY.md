# Security policy

## Project status

AgentReady B2A is currently an **experimental developer toolkit**. Its public catalog generator reads a configured source snapshot, and its optional WebMCP tools are intended to expose only public, read-only product information. This is not a security certification and does not authorize access to private website data.

## Supported versions

| Version | Status |
| --- | --- |
| 0.2.x | Active experimental development |
| Earlier prototypes | No dedicated security support policy |

No production security SLA is provided.

## Report a vulnerability

**Do not disclose exploitable details, secrets or personal data in a public issue.**

Prefer GitHub's **Report a vulnerability / private vulnerability reporting** option if it is enabled for this repository. Otherwise contact the maintainer privately through the GitHub profile before sharing technical details. If no private channel is available, open a public issue requesting a secure contact channel **without** including exploit steps or sensitive material.

Include affected version/commit, minimal reproduction, impact and mitigations when a secure channel has been established. There is no guaranteed response timeline.

## Integration security boundaries

- Publish only an explicit allowlist of **public** catalog fields; review every source mapping before deploy.
- Do not expose credentials, customer records, private orders, payment data or internal supplier information.
- Keep authentication, authorization, price calculation and stock checks in the website's server-side business services.
- Never treat a published price or stock snapshot as authoritative at checkout.
- Do not add auto-purchase, payment, admin or other state-changing WebMCP tools as part of the current read-only integration.
- Review third-party dependencies and source licenses before updating or vendoring them.
- Do not assume that local generation tests, HTTP smoke checks or simulated tool registration prove real-browser compatibility.

See [README.md](README.md) for current limitations.
