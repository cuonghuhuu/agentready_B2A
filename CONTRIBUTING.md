# Contributing to AgentReady B2A

Thanks for helping make e-commerce websites more understandable to compatible AI agents.

## Before contributing

- Read [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Open an issue for major new capabilities so scope and acceptance criteria are clear.
- Keep changes small and avoid unrelated refactors or changes to an existing store's checkout/payment logic.

## Local development

Node.js 20+ is required.

```bash
git clone https://github.com/cuonghuhuu/agentready_B2A.git
cd agentready_B2A
npm test
npm run demo
npm run verify:demo
```

Contributions should include focused regression tests when behavior changes. If using a browser or framework-specific integration, record the actual browser/runtime, commands, and versions used. Do not describe mock tests as real browser tests.

## Pull requests

1. Fork the repository or create a feature branch.
2. Implement one scoped improvement with tests and documentation.
3. Run `npm test`, `npm run demo`, and `npm run verify:demo`.
4. Open a PR explaining the change, verification evidence, risk, and rollback considerations.
5. Do not include credentials, proprietary datasets, or customer/order information.

Maintain backward compatibility where practical. Explain any changes to generated files, public schemas, or CLI flags.

## Third-party code

Prefer dependencies and well-defined adapters over copying source. Confirm the third party's license, preserve copyright/permission notices where required, and update `THIRD_PARTY_NOTICES.md` when code or licensed material is introduced.

## Reporting bugs and security issues

Use a GitHub issue for regular defects and reproducible examples. **Do not publish exploitable security details in a public issue**; see [SECURITY.md](SECURITY.md).

## Style of claims

Document what was implemented and **actually tested**. Separate planned features, simulated tests, and real-world interoperability. A green CI check is not proof of universal platform support.
