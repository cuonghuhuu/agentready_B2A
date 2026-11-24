# AgentReady B2A — contributor agent instructions

## Scope
- Current public release: v0.3.0-alpha.1. V0.4 Scanner is a local-only development preview.
- Keep the public catalog generator and WebMCP tools read-only. Never add checkout, payment, account access or private-data exposure without a separately approved design.
- Preserve the Agent Skill ID `agentready` and bilingual docs. Read `skills/agentready/SKILL.md` for integration workflow and `docs/SCANNER_PREVIEW.md` for pending QA.
- Do not deploy the scanner publicly or describe static signals as verified browser/agent capabilities.

## Workflow
Use Node.js 20+; prefer 22 for local development. Keep changes focused and review third-party license notices. Do not change generated snapshots just for timestamps. Never commit secrets, local scan reports or customer data. Record real test results; do not bypass SSRF protections for tests. Use controlled fixtures.

```bash
npm test
npm run demo
npm run verify:demo
```

Submit a feature branch/PR, describe limitations and regression tests, and do not merge or publish releases without maintainer approval.

## Skill packaging
The skill metadata follows the Agent Skills format (https://agentskills.io/specification). The Windows Codex installer is `install-codex.ps1` from the repository root and copies runtime files as well as SKILL.md. Copying the metadata directory alone does not provide the CLI. Other agents require host-specific installation and have not been independently validated.
