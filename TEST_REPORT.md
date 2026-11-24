[Tiếng Việt](docs/vi/TEST_REPORT.md) · [Home](README.md)

# AgentReady B2A verification report (v0.3 catalog adapters — QA edge-case freeze)

- **Baseline commit:** `f8070dfc63738454f345312ec6aaa6b88ecf4946` (`feature/v0.3-commerce-variants`)
- **Integration branch:** `feature/v0.3-catalog-adapters`
- **Execution environment:** Linux sandbox, Node.js `v18.20.4`, npm `9.2.0`, Git `2.39.5`
- **Verification date:** 2026-11-24

> **Runtime limitation:** This environment provides Node.js `v18.20.4` only (`package.json` declares `"engines": { "node": ">=20" }`). Node.js 20 and 22 execution was **not** run in this environment for this final edge-case revision and must be verified on Node 20/22 (or GitHub Actions CI) before merging.

## Executed checks

### 1. Adapter, canonical model, security, and QA edge-case regression suite
- **Command:** `node --test tests/adapters.test.mjs`
- **Result:** **15 passed, 0 failed** (after verifying all 4 new edge-case regression tests failed before fixes)
- **New edge-case regressions verified:**
  - **QA-EDGE-1 (Variant label leakage):** Confirmed Shopify variant labels are constructed strictly from approved public options whenever any option is rejected by the allowlist (`"Black / 4.50"` becomes `"Black"`), and verified `"4.50"` and `"supplier_cost"` do not appear anywhere in the entire serialized product.
  - **QA-EDGE-2 (Parent description cross-variant contamination):** Confirmed that when a parent description contains `"Available in Black and Blue."`, variant-discriminating terms (`"Blue"`) must match the candidate variant's own label/SKU/attributes, so `{ query: 'Blue', maxPrice: 25, availability: 'InStock' }` returns `0` matches instead of matching the `$20` Black variant.
  - **QA-EDGE-3 (Representative offer consistency — WebMCP & JSON-LD):** Confirmed WebMCP search and detail summaries select a single representative offer (`InStock` → `PreOrder` → `OutOfStock`, lowest price within tier) so `$20 OutOfStock` + `$35 InStock` reports `price: 35, availability: 'InStock'` with `priceRange: { min: 20, max: 35 }`; confirmed JSON-LD `$20 OutOfStock` + `$35 PreOrder` selects `price: 35, availability: 'PreOrder'`.
  - **QA-EDGE-4 (Private JSON-LD container traversal):** Confirmed a JSON-LD `ItemList` marked `published: false` propagates private/unpublished status to nested `Product` entries during traversal, exporting `0` products and reporting the skipped record.
- **All 11 prior adapter, BUG-001..BUG-004, security, and WebMCP tests preserved and passing.**

### 2. Full test suite
- **Command:** `npm test` (`node --test tests/adapters.test.mjs tests/agentmarkup.test.mjs tests/agentready.test.mjs tests/commerce-variants.test.mjs`)
- **Result:** **27 passed, 2 failed** (29 total tests under Node.js `v18.20.4`)
  - Passed: all 15 tests in `tests/adapters.test.mjs`, all 2 tests in `tests/agentmarkup.test.mjs`, 7 of 8 tests in `tests/agentready.test.mjs`, and 3 of 4 tests in `tests/commerce-variants.test.mjs`.
  - Failed (2 pre-existing tests under Node `v18.20.4` only):
    1. `tests/agentready.test.mjs:103` (`read-only WebMCP adapter registers two safe tools in simulated browser`) — `SyntaxError: Cannot use import statement outside a module` at line 112 when dynamically importing generated `public/agentready/webmcp-products.js` from `os.tmpdir()` without `"type": "module"`.
    2. `tests/commerce-variants.test.mjs:70` (`WebMCP product search uses public variant pricing and detail omits private fields`) — same Node 18 ESM temp-dir `SyntaxError` at line 79.

### 3. Demo generation and verification
- **Command:** `npm run demo` — **Passed** (`productCount: 2`, 7 public files generated, `verify` returned `ok: true`).
- **Command:** `npm run verify:demo` — **Passed** (`ok: true`, `errors: []`, `productCount: 2`, `origin: https://shop.example.com`).

### 4. Patch integrity check
- **Command:** `git apply --check agentready-v0.3-integrated.patch` on clean `feature/v0.3-commerce-variants` (`f8070dfc`)
- **Result:** **Passed** (clean apply with zero conflicts).

## Independent verification of the integrated baseline

- Commit `fceabdb2573f9139a52fe863f8efaf4fb5cf9939`: Linux Node.js 22.16.0, 29/29 tests passed; demo, verification and packaging passed.
- GitHub Actions [45350980470](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45350980470): all four Node.js 20/22 Windows/Linux jobs passed tests, demo and verification.
- Release candidate `271936ad` adds two source/configuration collision regressions (31 tests total). [CI 45351442675](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351442675), [integrated branch CI 45351577333](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351577333), and [main CI 45351681140](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351681140) all completed successfully with four jobs each. Main release commit: `512299372736a3282a70ed5839b9e4f185ca0903`.

## Not run / unverified

- **Real storefront integration:** Actual Next.js build with `@agentmarkup/next` installed in a live storefront.
- **Real browser WebMCP evaluation:** Google Chrome Labs WebMCP Evals (`examples/ecommerce-demo/webmcp-evals.json`) against a WebMCP-capable browser; unit tests simulate `document.modelContext` only.
- **Live deployment & inventory:** Live store APIs, real-time stock/price sync, checkout/payment flows, and external agent discovery.

Local file verification does not prove deployed behavior or real-time price and stock.

---

# AgentReady B2A — Verification Report (Universal Agent Skill Distribution)

- **Baseline commit:** `67b49bdd3cd723467d4471a55f1d3e9312b3e6e4` (post-release documentation baseline; release tag unchanged)
- **Development branch:** `feature/universal-skill-distribution`
- **V0.4 Scanner branch:** Unmodified (separate branch)
- **Execution environment:** Linux sandbox, Node.js `v18.20.4`, npm `9.2.0`, Git `2.39.5`
- **External networking:** Disabled in sandbox environment (`npx skills add` against GitHub/npm registry could not be executed here)
- **Verification date:** 2026-11-24

> **Environment limitations:**
> 1. This sandbox provides Node.js `v18.20.4` (`package.json` declares `"engines": { "node": ">=20" }`). Node.js 20 and 22 CI runs (Linux, Windows, macOS) must be executed before merging.
> 2. Outbound internet access is disabled in this sandbox, so live `npx skills add cuonghuhuu/agentready_B2A --skill agentready -g` installation via the upstream Vercel Skills CLI was **not** run.
> 3. Live execution inside third-party coding-agent binaries (OpenAI Codex CLI, Anthropic Claude Code, Google Antigravity CLI) was **not** run; only simulated filesystem discovery layouts and isolated CLI execution were verified.

## Executed Checks

### 1. Reproducible Skill Packaging & Drift Detection
- **Command:** `npm run skill:package && npm run skill:check`
- **Result:** **Passed** (`ok: true`, `errors: []`, `checkedFileCount: 13`)
- Verified deterministic SHA-256 manifest (`skills/agentready/scripts/.package-manifest.json`), ESM package metadata (`skills/agentready/scripts/package.json` with `"type": "module"` and zero dependencies), bundled `LICENSE`, `THIRD_PARTY_NOTICES.md`, `references/COMMERCE_VARIANTS.md`, and `references/UPSTREAM.md`.

### 2. Universal Skill Distribution Test Suite
- **Command:** `npm run test:skill` (`node --test tests/skill-distribution.test.mjs`)
- **Result:** **4 passed, 0 failed** (`duration_ms: 1088 ms`)
- **Verified scenarios:**
  1. `SKILL.md` YAML frontmatter & line-count validation against [agentskills.io/specification](https://agentskills.io/specification) (plus negative validation tests).
  2. Drift detection: verified `checkSkillPackage()` passes on clean state, fails when a packaged file is modified, recovers after `packageSkill()`, and fails when an unmanaged stale file is added inside `skills/agentready/scripts/`.
  3. Isolated temporary-directory execution with **spaces and non-ASCII Unicode paths** (`Cài đặt Skill Thử Nghiệm/agentready` -> `Cửa hàng Việt Nam — Demo 2026`) with zero access to the original repository: executed `inspect`, `init`, `import` (Shopify fixture with variants), `generate` (7 public outputs), and `verify` (`ok: true`, `errors: []`).
  4. Simulated global discovery directory layouts for OpenAI Codex CLI (`$HOME/.agents/skills/agentready`), Anthropic Claude Code (`$HOME/.claude/skills/agentready`), and Google Antigravity CLI (`$HOME/.gemini/config/skills/agentready`) — verified `SKILL.md` spec validity and executable `scripts/agentready.mjs`.

### 3. Full Test Suite (31 Preserved v0.3 Tests + 4 New Skill Distribution Tests)
- **Command:** `npm test`
- **Result:** **33 passed, 2 failed** (35 total tests under Node.js `v18.20.4`)
  - **Passed:** 4/4 `tests/skill-distribution.test.mjs` + 29/31 preserved v0.3 tests (`adapters.test.mjs`, `agentmarkup.test.mjs`, `agentready.test.mjs`, `commerce-variants.test.mjs`).
  - **Failed (2 pre-existing v0.3 tests under Node `v18.20.4` only, unchanged from baseline):**
    1. `tests/agentready.test.mjs:103` — Node 18 `SyntaxError: Cannot use import statement outside a module` when dynamically importing generated `webmcp-products.js` from `os.tmpdir()`.
    2. `tests/commerce-variants.test.mjs:70` — same Node 18 tmpdir ESM limitation.

### 4. Demo Generation, Verification & Patch Integrity
- **Command:** `npm run demo` — **Passed** (`productCount: 2`, 7 public files generated, `verify` `ok: true`).
- **Command:** `npm run verify:demo` — **Passed** (`ok: true`, `errors: []`).
- **Patch check:** `git apply --check` on a clean checkout of baseline `67b49bd` — **Passed**.

## Not Run / Unverified
- Live `npx skills add cuonghuhuu/agentready_B2A --skill agentready -g` installation via the upstream Vercel Skills CLI (requires outbound internet access).
- Live activation and end-to-end agent execution inside OpenAI Codex CLI, Anthropic Claude Code, and Google Antigravity CLI binaries.
- Node.js 20 and 22 execution on Windows, Linux, and macOS (configured in `.github/workflows/ci.yml` with `npm run skill:check`).
- Real browser WebMCP evaluation (`examples/ecommerce-demo/webmcp-evals.json`) and real Next.js `@agentmarkup/next` build.

## Independent review (2026-11-24)

- Linux Node.js 22.16.0: 35/35 tests passed on reconstructed source and fixtures matching the baseline code, plus the extracted distribution patch. `npm run skill:check` (13 files), `npm run demo`, and `npm run verify:demo` passed.
- This is not a live Skills CLI installation or agent activation test. Six CI jobs and real client installation remain pending.

## Alpha 2 release preparation — 2026-11-24

- [PR #8](https://github.com/cuonghuhuu/agentready_B2A/pull/8), source commit `2170e7a`: [CI](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45379899868) passed all six jobs (Windows/Linux/macOS, Node 20/22).
- Maintainer's Windows 11 / Node 24.14.0: 13/13 package files matched; 34/35 tests passed. One pre-existing test could not create a symlink (EPERM), so its security assertions were not executed. No elevation or Developer Mode change was performed.
- Local reconstructed Alpha 2 source, Node 22.16.0 on Linux: regenerated package, drift check 13/13, 35/35 tests, demo and verify passed. Versioned file blob hashes matched the integration tree.
- Live Skills CLI network installation, agent invocation, update/removal, real storefront and browser WebMCP remain unverified. The new tag is not yet published.

## Published Alpha 2

- Tag `v0.3.0-alpha.2` verified at commit `182199c2596983bd66d5c59f93abc5da3b77ea43`.
- [Release CI](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45382536951): six of six successful jobs. Live client verification remains pending.
