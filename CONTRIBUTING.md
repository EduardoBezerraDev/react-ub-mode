# Contributing to `react-ub-mode`

`react-ub-mode` dogfoods its own craftsmanship discipline. Every change should follow **First Make it Work → Then Make it Right → Follow Practice** and pass the full self-gate before opening a pull request.

## Development Workflow

```bash
npm install
npm run build
npm test
```

Run the full coverage + skill sync + quality gate pipeline:

```bash
npm run test:coverage
npm run lint:skill
npm run gate
```

## Rules for Contributors

1. **Single source of truth for the skill**: Edit [`SKILL.md`](./SKILL.md) at the repository root — never edit `plugin/skills/react-ub-mode/SKILL.md` directly. `npm run build` automatically syncs it via [`scripts/sync-skill.mjs`](./scripts/sync-skill.mjs), and `npm run lint:skill` verifies sync integrity.
2. **Keep ChatGPT Custom Instructions under 1,500 characters**: Verify [`chatgpt/CUSTOM_INSTRUCTIONS.md`](./chatgpt/CUSTOM_INSTRUCTIONS.md) stays `<= 1500` characters (`wc -c chatgpt/CUSTOM_INSTRUCTIONS.md`).
3. **Pass all deterministic gates**:
   - `crapper`: every function/unit must stay at `CRAP < 10`
   - `dryer`: zero structural clones `>= 0.8`
   - `react-audit`: `0` errors and `0` warnings
   - `mutator`: zero behavior-audit issues (`no-assertions`, `implementation-coupling`, `uncovered-file`)
4. **Type safety**: No `any`, `as any`, `@ts-ignore`, or `eslint-disable`. Parse external JSON/inputs once at boundaries.
5. **Behavior-first tests**: Write failing tests in `tests/` using `node:test` and `node:assert/strict` before changing implementation, and test against isolated temporary directories (`mkdtempSync`) cleaned up in `finally`.
