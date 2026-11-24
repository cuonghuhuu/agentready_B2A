# AgentReady B2A — Universal Agent Skill Installation & Compatibility

AgentReady B2A ships a **self-contained, portable Agent Skill** (`skills/agentready/`) following the [Agent Skills open specification](https://agentskills.io/specification) and installable via the [Vercel Skills CLI](https://github.com/vercel-labs/skills).

- **Skill identifier:** `agentready`
- **Runtime requirements:** Node.js 20+ (zero external runtime dependencies, no mandatory MCP servers, no background services)
- **Security boundary:** Public, read-only catalog workflows only (never accesses private databases, customer PII, checkout, or payment flows)

## 1. One-Command Installation (Windows, Linux, macOS)

Install globally across compatible coding agents with the [Vercel Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g
```

### Target a specific agent or install per-project

```bash
# Install globally for specific agents
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a codex
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a claude-code
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a antigravity

# Install into the current repository only (project scope)
npx skills add cuonghuhuu/agentready_B2A --skill agentready
```

### Offline / Legacy Windows PowerShell Fallback (Codex)

If you cloned this repository locally and cannot use `npx`:

```powershell
.\install-codex.ps1
```

## 2. Activation

Restart your coding agent if it does not automatically reload skills (or run `/skills reload` in Antigravity CLI), open your e-commerce storefront repository, and activate the skill:

- **OpenAI Codex CLI** ([official docs](https://developers.openai.com/codex/skills)): type `$agentready` or select it via `/skills`.
- **Anthropic Claude Code** ([official docs](https://code.claude.com/docs/en/skills)): type `/agentready` (or view installed skills via `/skills`).
- **Google Antigravity CLI (`agy`)** ([official docs](https://antigravity.google/docs/skills/)): type `/agentready` (list via `/skills`, refresh via `/skills reload`).
- **Implicit activation:** Compatible agents may also match `agentready` automatically when your prompt asks to generate public `llms.txt`, `catalog.json`, Schema.org JSON-LD, or read-only WebMCP tools for an e-commerce site.

Example prompt:

```text
Use agentready to inspect this e-commerce application, connect only approved
public product data, generate AI-readable catalog resources, and verify the
output. Do not expose private fields or modify checkout or payment flows.
```

## 3. Update & Uninstallation

### Check & Update

```bash
# Check for updates
npx skills check

# Update installed skills
npx skills update

# Or re-run add to refresh specific agents cleanly
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g
```

### Uninstall

```bash
# Remove globally installed skill
npx skills remove agentready -g

# Remove project-scoped skill
npx skills remove agentready
```

> **Note on per-agent removal:** Upstream `vercel-labs/skills` uses a shared canonical `~/.agents/skills/` directory with symlinks for some agents. If you remove `agentready` from a single agent (`-a <agent>`) and want to confirm it is no longer discoverable, verify the agent's discovery path listed in the Compatibility Matrix below.

## 4. Compatibility Matrix

> **Honest verification notice:** Official discovery paths and activation commands below were verified against each vendor's official documentation. Automated tests in this repository verify `SKILL.md` specification compliance, isolated runtime execution (`inspect`, `init`, `import`, `generate`, `verify`), spaces/non-ASCII paths, and **simulated** directory-layout compatibility. **Live execution inside third-party agent binaries (Codex CLI, Claude Code, Antigravity CLI) and live `npx skills add` network installs were not executed in this offline sandbox** and remain unverified until run in those environments.

| Client | Official Project Discovery Path | Official Global Discovery Path | Activation Command | Documentation Source | Verification Status |
| --- | --- | --- | --- | --- | --- |
| **OpenAI Codex CLI** | `$CWD/.agents/skills/agentready/` up to `$REPO_ROOT/.agents/skills/agentready/` | `$HOME/.agents/skills/agentready/` (Admin: `/etc/codex/skills/`) | `$agentready` or `/skills` (or implicit) | [OpenAI Codex Skills Docs](https://developers.openai.com/codex/skills) | **Simulated layout + isolated CLI verified**; live Codex binary execution unverified in this environment |
| **Anthropic Claude Code** | `.claude/skills/agentready/` | `~/.claude/skills/agentready/` | `/agentready` (or implicit) | [Claude Code Skills Docs](https://code.claude.com/docs/en/skills) | **Simulated layout + isolated CLI verified**; live Claude Code execution unverified in this environment |
| **Google Antigravity CLI (`agy`)** | `<workspace-root>/.agents/skills/agentready/` (legacy `.agent/skills/` also recognized) | `~/.gemini/config/skills/agentready/` (CLI also checks `~/.gemini/antigravity-cli/skills/` & `~/.gemini/skills/`) | `/agentready` (`/skills`, `/skills reload`, or implicit) | [Antigravity Skills](https://antigravity.google/docs/skills/) · [Customization Discovery](https://antigravity.google/docs/customization-discovery/) | **Simulated layout + isolated CLI verified**; live Antigravity CLI execution unverified in this environment |
| **Other Agent Skills Clients** | Per [Agent Skills spec](https://agentskills.io/specification) | Per client documentation / [Vercel Skills CLI](https://github.com/vercel-labs/skills) | Client-defined | [agentskills.io/specification](https://agentskills.io/specification) | **Spec-validated (`SKILL.md` + self-contained `scripts/`)**; live client execution unverified |

## 5. Self-Contained Skill Layout & Reproducible Packaging

`skills/agentready/` contains everything needed to run without cloning the repository:

```text
skills/agentready/
├── SKILL.md                             # Agent Skills spec frontmatter + workflow
├── LICENSE                              # MIT license (synced from root)
├── THIRD_PARTY_NOTICES.md               # Upstream notices (synced from root)
├── references/
│   ├── UPSTREAM.md                      # AgentMarkup, WebMCPify, Chrome Labs eval notes
│   └── COMMERCE_VARIANTS.md             # Canonical variant contract (synced from docs/)
└── scripts/
    ├── package.json                     # ESM package metadata ("type": "module", zero deps)
    ├── agentready.mjs                   # Portable CLI entrypoint
    ├── .package-manifest.json           # SHA-256 integrity manifest
    ├── bin/agentready.mjs               # Synced from canonical bin/agentready.mjs
    └── src/                             # Synced from canonical src/*.mjs & webmcp*.js
```

Maintainers never edit packaged runtime files by hand. After changing canonical files in `bin/`, `src/`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, or `docs/COMMERCE_VARIANTS.md`, run:

```bash
npm run skill:package
npm run skill:check
```

GitHub Actions runs `npm run skill:check` on Linux, Windows, and macOS (Node.js 20 and 22) to fail CI if any packaged file drifts from canonical sources.
