# One-shot implementation prompt for Codex CLI

Use this INSIDE the real target website repo, after installing AgentReady and restarting Codex:

```text
Use $agentready to IMPLEMENT (not just analyze) an Agent-Ready read-only integration in this website.

Scope:
- Reuse existing public product/category/business data. Do NOT invent products, prices, URLs, inventory, or APIs.
- Create a working public, machine-readable catalog (JSON, concise Markdown, llms.txt) based on that public data.
- Add Schema.org Product/Offer markup to product pages using existing server-side data if feasible.
- Add read-only WebMCP search/get product tools, only if the browser integration is compatible.
- Validate output against actual backend/public catalog. Run relevant unit, build and browser checks.
- Preserve app architecture, auth, RBAC, checkout, pricing and payments. Do not expose admin/customer data.
- If upstream maintained packages are a better fit, prefer AgentMarkup for build/SSR and WebMCPify for tool design after resolving output collisions. Use Chrome Labs test tools where supported.
- Do not spend the whole session producing an audit. Implement the smallest safe vertical slice and report what is DONE and what remains BLOCKED.
- Never install network dependencies or expose state-changing tools without showing and reviewing the proposed change first.

Success conditions:
(1) A documented public endpoint provides truthful products and links.
(2) Price and availability match the source at generation time.
(3) Both good and bad inputs are tested.
(4) No secret or private inventory/customer fields are leaked.
(5) The real website builds, and WebMCP status is reported honestly rather than presumed.
```
