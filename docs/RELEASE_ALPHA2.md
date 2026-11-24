# AgentReady B2A v0.3.0-alpha.2

**Published experimental alpha.** [GitHub Release](https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.2) points to commit `182199c`. [Release CI](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45382536951) passed all six jobs.

## What's new

- Self-contained `agentready` Agent Skill: bundled ESM runtime, references, MIT license and third-party notices.
- Deterministic packaging and drift detection; four new tests, 35 total.
- One-command installation instructions via Vercel Skills CLI, English and Vietnamese.
- Six passing [PR #8 CI jobs](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45379899868) across Windows, Linux and macOS, Node.js 20/22. Independent Linux Node 22.16.0 version-bump check: 35/35, package check and demo/verify passed.

## Try the skill

```bash
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g
```

Expected invocation: Codex `$agentready`; Claude Code and Antigravity CLI `/agentready`. These commands follow client documentation; live installs and activation have **not** been tested. See [installation guide](SKILL_INSTALLATION.md) and [test report](../TEST_REPORT.md).

## Known limits

- Live Skills CLI installation, update/removal and end-to-end agent execution remain unverified.
- On the maintainer's Windows machine with Node 24.14.0: 34/35 tests passed; symlink creation failed with EPERM before security assertions.
- No verified real storefront integration, real browser WebMCP, live inventory or transactions.
- V0.4 Scanner remains a separate local-only preview with unresolved QA issues.
- No npm publication. Alpha 1 release remains unchanged.

## Tiếng Việt

Alpha 2 bổ sung Skill tự chứa, đóng gói tái lập, 4 test mới (35 tổng cộng) và hướng dẫn cài đặt song ngữ. CI PR #8 đạt 6/6. Kiểm thử cục bộ nâng version đạt 35/35 trên Node 22. Chưa xác minh cài qua mạng, gọi Skill trong Codex/Claude/AGY thật, update/uninstall, storefront thật và WebMCP trình duyệt thật. Scanner V0.4 vẫn là preview nhánh riêng. Tag Alpha 2 đã phát hành trên GitHub; chưa xuất bản npm. Xem [hướng dẫn tiếng Việt](vi/SKILL_INSTALLATION.md).
