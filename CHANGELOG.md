# Changelog

Changes to AgentReady B2A are recorded here. Dates follow YYYY-MM-DD.

## [Unreleased]

### Documentation
- Add contributor guidelines, security reporting guidance, architecture notes and GitHub contribution templates.
- Improve repository README navigation and project status messaging.

## [0.2.0] — 2026-11-24

### Added
- Optional `@agentmarkup/next` configuration helper.
- MIT-attributed WebMCPify runtime integration for read-only product search and lookup.
- Google Chrome Labs WebMCP Evals smoke fixture.
- GitHub Actions test matrix for Node.js 20/22 on Linux and Windows.

### Verified
- 10 local tests reported passing.
- Demo generation, local verification and HTTP smoke check passed.
- GitHub Actions run 45315501119 passed its four matrix jobs.

### Known limitations
- Data comes from a public JSON **snapshot** rather than a live commerce API.
- Browser-based WebMCP evaluation and Next.js storefront build integration are not yet verified.
- Multi-platform commerce support is planned, not implemented.

See [TEST_REPORT.md](TEST_REPORT.md).
