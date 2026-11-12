# react-ub-mode

**Disciplined Frontend Engineering for React & TypeScript — powered by an Agent Skill, IDE/Agent Plugins, Atomic Design Enforcement, and Deterministic AST Quality Gates.**

*Read this in Portuguese: [README.pt-BR.md](./README.pt-BR.md)*

---

## What is `react-ub-mode`?

`react-ub-mode` brings the workflow and rigor of [unclebob/ub-mode](https://github.com/unclebob/ub-mode) to **React + TypeScript** frontend projects (Vite/SPA, Next.js App Router, Remix, or standalone libraries).

Instead of relying solely on AI prompts or generic style linters, `react-ub-mode` pairs:
1. **Behavioral Engineering Rules** ([`SKILL.md`](./SKILL.md) + [`plugin/rules/AGENTS.md`](./plugin/rules/AGENTS.md))
2. **A Deterministic TypeScript AST Quality-Gate CLI** (`react-ub`) with built-in equivalents to `crapper`, `dryer`, `mutator`, and a specialized `react-audit` (including **Atomic Design** enforcement).

---

## 60-Second Quick Start

### Step 1 — Install globally on your machine (one time)

```bash
git clone <repo-url> react-ub-mode
cd react-ub-mode
npm install
npm run setup:global
```

What `npm run setup:global` does automatically:
- Builds the TypeScript CLI (`dist/cli.js`) and links `react-ub` globally (`npm link`)
- Installs the skill + plugin for **Antigravity** (`~/.gemini/config/skills/` and `~/.gemini/config/plugins/`)
- Installs the global skill for **VS Code Copilot** (`~/.copilot/skills/`), **Codex**, **Claude Code**, **Cursor**, and **OpenCode**
- Saves the compact **ChatGPT Custom Instructions** to `~/.react-ub-mode/chatgpt-custom-instructions.md` and copies it to your clipboard

### Step 2 — Onboard any React project (one command per repo)

```bash
cd /path/to/your-react-app
react-ub init
```

What `react-ub init` does idempotently:
- Creates missing **Atomic Design** directories (`src/atoms`, `src/molecules`, `src/organisms`, `src/templates`, `src/pages`, or `components/...` for Next.js `app/` projects)
- Installs **VS Code Copilot** path-scoped instructions (`.github/instructions/react-ub-mode.instructions.md`) and `.github/skills/react-ub-mode/SKILL.md`
- Installs **Antigravity / universal `.agents/`** skill and plugin (`.agents/skills/` and `.agents/plugins/`)
- Adds `ub:gate`, `ub:audit`, and `ub:mutate` scripts to your `package.json`

### Step 3 — Run the quality gates

```bash
# Generate test coverage first (Vitest / Jest) so Crapper uses real coverage
npx vitest run --coverage

# Run all gates
npm run ub:gate
```

---

## Using Across AI Tools

### Antigravity
`npm run setup:global` (or `react-ub install --target antigravity --plugin`) installs:
- `~/.gemini/config/skills/react-ub-mode/SKILL.md` (invocable via `/react-ub-mode`)
- `~/.gemini/config/plugins/react-ub-mode/` (`plugin.json`, `rules/AGENTS.md`, `hooks.json` with a `SessionStart` check for React projects)

In a team repository, `react-ub init` also writes `.agents/skills/` and `.agents/plugins/` so teammates inherit the exact rules.

### VS Code (GitHub Copilot)
Running `react-ub init` inside a React repository (or `react-ub install --target copilot`) configures:
- `.github/instructions/react-ub-mode.instructions.md` with `applyTo: "**/*.{ts,tsx,js,jsx}"` — automatically loaded by Copilot Chat & Copilot Edits/Agent whenever you touch React/TS files
- `.github/skills/react-ub-mode/SKILL.md` — workspace agent skill
- `~/.copilot/skills/react-ub-mode/SKILL.md` — global Copilot skill

> **Tip:** Make sure VS Code setting `github.copilot.chat.codeGeneration.useInstructionFiles` is enabled (enabled by default in modern VS Code).

### ChatGPT (Web, Desktop, Projects, Custom GPTs & Codex)

1. **ChatGPT Custom Instructions** (fits the 1,500-character limit — [1,341 chars](./chatgpt/CUSTOM_INSTRUCTIONS.md)):
   ```bash
   react-ub prompt --compact | pbcopy
   ```
   Open ChatGPT → **Settings → Personalization → Custom Instructions** and paste (`Cmd+V` / `Ctrl+V`).

2. **ChatGPT Projects or Custom GPTs** (full rulebook):
   ```bash
   react-ub prompt | pbcopy
   ```
   Or attach [`SKILL.md`](./SKILL.md) as a Knowledge file in your ChatGPT Project or Custom GPT.
   To generate a single Markdown file containing both prompts in the current directory:
   ```bash
   react-ub install --target chatgpt
   ```

3. **OpenAI Codex CLI**:
   ```bash
   react-ub install --target codex
   ```

### Claude Code, Cursor & OpenCode

```bash
react-ub install --target claude
react-ub install --target cursor
react-ub install --target opencode
```

Or install all global targets at once:

```bash
react-ub setup
```

---

## The Three-Phase Discipline

Every React/TypeScript change follows:

### 1. First Make it Work
- **Laziness Protocol**: Single source of truth for state, derived values, schemas, and tokens; ship the smallest edit that solves the user-visible problem.
- **Foundational Thinking**: Design discriminated unions first (`{ status: 'idle' | 'loading' | 'error' | 'success' }`) instead of boolean bags (`isLoading && isError`); derive values during render; use `AbortController` or request IDs against async races.
- **Behavior-First React TDD**: Write failing tests using accessible queries (`getByRole`, `getByLabelText`, `getByText`) and `userEvent` before changing code.
- **Redesign From First Principles & Subtract Before You Add**: Prefer composition (`children`, slots) over stacking boolean flags (`isCompactV2`), and delete dead `useEffect`s before adding new hooks.
- **Boundary & Type System Discipline**: Parse external payloads (`fetch`, `JSON.parse`, `localStorage`, URL params) once at the boundary; keep domain logic in pure `.ts` functions; never silence TypeScript (`any`, `@ts-ignore`, `eslint-disable`).
- **StrictMode-Safe Idempotency & State Colocation**: Every `useEffect` listener/timer/subscription returns cleanup; keep `'use client'` boundaries leaf-level; never read `window`/`document` unconditionally during render.

### 2. Then Make it Right
- **Fix Root Causes**: Reproduce with a failing test; never mask broken state transitions with `?.` or `if (!data) return null`.
- **Crapper (`CRAP < 10`)**: Keep every component, hook, and function below CRAP 10 by extracting pure helpers, splitting components, or covering branches with behavioral tests.
- **Dryer (`similarity < 0.8`)**: Extract duplicated stateful logic into custom hooks, duplicated UI primitives into `atoms/`/`molecules/`, and duplicated domain rules into pure helpers.
- **Mutator**: Cover uncovered modules, kill surviving mutants, eliminate zero-assertion or implementation-coupled tests (`querySelector`, `innerHTML`), and delete dead code.
- **React Audit**: Pass all Atomic Design, boundary, type, hook, accessibility, XSS, and SSR checks.

### 3. Follow Practice
- **Keep a Log**: Record actions, rationale, and gate metrics (`CRAP`, `Dryer`, `Mutator`, `React Audit`) before/after.
- **Guard the Context Window**: Delegate broad exploration or verbose logs; keep actionable summaries.
- **Worktree Cleanup & Small Ordered Commits**: Explain *why*, *what changed*, and *how it was proved*.

---

## Atomic Design Component Architecture

`react-ub-mode` enforces the five-tier Atomic Design hierarchy with **strictly downward dependencies**:

```text
pages/ (or app/**/page.tsx)
  └──▶ templates/
         └──▶ organisms/
                └──▶ molecules/
                       └──▶ atoms/
```

| Layer | Responsibility | Allowed Dependencies | Purity Rules |
| :--- | :--- | :--- | :--- |
| **`atoms/`** | Pure UI primitives (`Button`, `Input`, `Badge`, `Icon`) | None (external UI libs/utils only) | No `fetch()`, no `useEffect`, no router imports (`next/navigation`, `react-router-dom`) |
| **`molecules/`** | Cohesive atom groups (`FormField`, `SearchBar`, `StatTile`) | `atoms/` | Ephemeral UI state only; no upward imports |
| **`organisms/`** | Self-contained UI sections (`Header`, `CheckoutForm`, `UserTable`) | `atoms/`, `molecules/` | Coordinates section state/callbacks; no imports from `templates/` or `pages/` |
| **`templates/`** | Page layout skeletons & slots (`DashboardLayout`) | `atoms/`, `molecules/`, `organisms/` | Composes layout via `children`/slot props; no `fetch()` |
| **`pages/`** *(or `app/**/page.tsx`)* | Route orchestrators | All lower layers | Wires boundary-validated data, feature hooks, and templates/organisms |

---

## Deterministic CLI Reference (`react-ub`)

### Commands

| Command | Purpose | Key Flags |
| :--- | :--- | :--- |
| `react-ub setup` | Install globally for Antigravity, Copilot, Codex, Claude, Cursor, OpenCode & ChatGPT | `--copy`, `--json` |
| `react-ub init [dir]` | Scaffold Atomic Design dirs, `.github/`, `.agents/`, and `package.json` scripts | `--chatgpt`, `--json` |
| `react-ub gate [path]` | Run `crapper`, `dryer`, `react-audit`, and `mutator` together | `--strict`, `--mutate`, `--max-crap <n>`, `--threshold <n>`, `--coverage <file>`, `--test-cmd <cmd>`, `--max-mutants <n>`, `--min-score <n>`, `--json` |
| `react-ub crapper [path]` | Compute cyclomatic complexity + coverage + CRAP score per unit | `--max-crap <n>` (default `10`), `--coverage <file>`, `--json` |
| `react-ub dryer [path]` | AST structural clone detection preserving React hooks & HTML tags | `--threshold <n>` (default `0.8`), `--json` |
| `react-ub react-audit [path]` | Run all React, TypeScript, a11y, SSR, and Atomic Design AST rules | `--strict` (fail on warnings too), `--json` |
| `react-ub mutator [path]` | Audit test behavior & run isolated AST mutation testing | `--run`, `--test-cmd <cmd>` (default `"npm test"`), `--max-mutants <n>` (default `50`), `--min-score <n>` (default `80`), `--json` |
| `react-ub install` | Install skill/plugin for a specific target | `--target antigravity\|copilot\|vscode\|chatgpt\|codex\|claude\|cursor\|opencode\|local\|all`, `--plugin`, `--local`, `--json` |
| `react-ub prompt` | Print ready-to-paste prompt to stdout | `--compact` (`<= 1500` chars for ChatGPT Custom Instructions) |

### Supported Coverage Formats (`crapper`)
`crapper` auto-discovers coverage in this order (or via `--coverage <file>`):
1. `coverage/coverage-final.json` (Istanbul/Vitest statement hit map — per-unit line accuracy)
2. `coverage/lcov.info` (LCOV — per-unit line accuracy)
3. `coverage/coverage-summary.json` (Istanbul summary — file-level %)

If no coverage file is found, `0%` coverage is assumed (`CRAP = comp^2 + comp`), surfacing complex uncovered units immediately.

### `react-audit` Rule Catalog

| Rule ID | Default Severity | What It Detects |
| :--- | :--- | :--- |
| `atomic-dependency-direction` | `error` | Upward import across Atomic Design layers (`atoms -> molecules`, `templates -> pages`, etc.) |
| `atomic-atom-impurity` | `error` | `fetch()`, `useEffect`, or router imports inside `atoms/` |
| `atomic-template-impurity` | `warning` | Direct `fetch()` inside `templates/` |
| `atomic-unclassified-component` | `warning` | React component outside `atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`, or `app/**/page.*` |
| `type-compiler-silence` | `error` | `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable` |
| `type-any-usage` | `error` | Explicit `any` or `as any` |
| `boundary-unparsed-data` | `warning` | `JSON.parse()`, `.json()`, `localStorage.getItem()`, `sessionStorage.getItem()` not passed through a `parse*`/`safeParse`/`validate*` boundary |
| `effect-derived-state` | `warning` | Synchronous `setState` inside `useEffect` without async/subscription side effects |
| `effect-missing-cleanup` | `warning` | `addEventListener`, `setInterval`, `setTimeout`, `subscribe`, or `observe` in `useEffect` without returning a cleanup function |
| `jsx-index-key` | `error` | Array index used as React `key={idx}` inside `.map()` |
| `a11y-clickable-non-semantic` | `warning` | `<div onClick>` or `<span onClick>` lacking `role` and `tabIndex`/`onKeyDown` |
| `a11y-missing-alt` | `error` | `<img>` missing an `alt` attribute (without `{...props}` spread) |
| `security-dangerous-html` | `error` | `dangerouslySetInnerHTML` without a `sanitize` call |
| `ssr-unsafe-global` | `warning` | Unconditional `window`, `document`, `localStorage`, or `sessionStorage` access during component render |
| `component-oversized` | `warning` | React component exceeding 150 lines |
| `component-prop-bloat` | `warning` | React component accepting more than 8 destructured props |

---

## CI / GitHub Actions Example

```yaml
name: React UB-Mode Quality Gate
on: [pull_request, push]

jobs:
  ub-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx vitest run --coverage
      - run: npx react-ub gate src --strict
```

---

## Repository Structure

```text
react-ub-mode/
├── SKILL.md                       # Authoritative React UB-Mode Agent Skill
├── chatgpt/
│   └── CUSTOM_INSTRUCTIONS.md     # Compact (< 1500 chars) ChatGPT Custom Instructions
├── plugin/                        # Antigravity / .agents plugin bundle
│   ├── plugin.json
│   ├── hooks.json                 # SessionStart React detection hook
│   ├── rules/AGENTS.md            # Always-on React UB-Mode rules
│   ├── scripts/session-start.mjs
│   └── skills/react-ub-mode/SKILL.md
├── src/
│   ├── cli.ts                     # Unified CLI entrypoint (`react-ub`)
│   ├── gate.ts                    # Full quality-gate orchestrator
│   ├── install.ts                 # Multi-platform installer
│   ├── onboard.ts                 # `setup` and `init` workflows
│   ├── scanner.ts                 # TypeScript/TSX AST file & unit scanner
│   ├── crapper/                   # Complexity, coverage & CRAP < 10 engine
│   ├── dryer/                     # AST structural clone detector (< 0.8)
│   ├── mutator/                   # Test behavior audit & isolated AST mutator
│   └── react-audit/               # Atomic Design, boundary, hook, a11y & SSR checks
├── tests/                         # Node test suite (dogfoods `react-ub gate`)
├── README.md                      # English documentation
├── README.pt-BR.md                # Portuguese documentation
└── CONTRIBUTING.md                # Contributor guide
```

## Contributing & License

See [CONTRIBUTING.md](./CONTRIBUTING.md). Licensed under the [MIT License](./LICENSE).
