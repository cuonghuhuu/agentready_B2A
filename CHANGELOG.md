# Changelog

Notable documented changes to AgentReady B2A are recorded here. This file describes repository development; it does not imply any GitHub Release or npm publication has occurred.

## [Unreleased]

### Added (development)
- Optional explicitly-published product variant normalization with variant-specific offer metadata.
- Synthetic fashion and electronics source fixtures and focused variant regression tests.

### Documentation
- Added project architecture, contribution, security and community guidance.
- Improved README with truthful capability matrix, setup instructions, CI/license badges, and limitations.

## [0.2.0] — 2026-11-24

### Added
- AgentReady B2A repository and reusable `agentready` Agent Skill.
- Optional AgentMarkup Next.js configuration helper.
- WebMCPify-based read-only WebMCP runtime with preserved MIT notice.
- Google Chrome Labs-compatible WebMCP Evals smoke fixture.
- Local CLI validation, generated demo catalog, and CI matrix for Node.js 20/22 on Linux/Windows.

### Known limitations
- Public catalog is a build-time JSON snapshot, not a database/live inventory adapter.
- A real Next.js storefront integration build and real browser WebMCP evaluation have not yet been run.
- Support for arbitrary e-commerce platforms has not been established.

See [TEST_REPORT.md](TEST_REPORT.md) for recorded verification evidence.
