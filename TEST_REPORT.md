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
- Release-candidate follow-up adds two source/configuration collision regressions. New CI evidence is required for that revision; the earlier run is not evidence for changed code.

## Not run / unverified

- **Real storefront integration:** Actual Next.js build with `@agentmarkup/next` installed in a live storefront.
- **Real browser WebMCP evaluation:** Google Chrome Labs WebMCP Evals (`examples/ecommerce-demo/webmcp-evals.json`) against a WebMCP-capable browser; unit tests simulate `document.modelContext` only.
- **Live deployment & inventory:** Live store APIs, real-time stock/price sync, checkout/payment flows, and external agent discovery.

Local file verification does not prove deployed behavior or real-time price and stock.
