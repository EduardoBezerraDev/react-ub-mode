# React UB-Mode Rules

When working on React or TypeScript frontend code in this workspace:

1. Follow the three-phase loop in `react-ub-mode` (`SKILL.md`): **First Make it Work**, **Then Make it Right**, **Follow Practice**.
2. Structure React components with **Atomic Design** (`atoms/` -> `molecules/` -> `organisms/` -> `templates/` -> `pages/`): dependencies flow strictly downward, `atoms/` remain pure UI primitives (no `fetch`, `useEffect`, or router imports), and `templates/` define layout slots without fetching.
3. Model UI and async state with discriminated unions; derive renderable values directly instead of syncing them in `useEffect`.
4. Parse external data (`fetch`, `JSON.parse`, `localStorage`, URL params) once at the boundary; never silence TypeScript with `any`, `as any`, or `@ts-ignore`.
5. Write behavioral tests using accessible queries (`getByRole`, `getByLabelText`, `getByText`) before changing implementation.
6. Before finishing any change, run the deterministic quality gates (`npx react-ub gate` or `react-ub gate`) and resolve any violation (`CRAP < 10`, `Dryer < 0.8`, `React Audit` clean, and `Mutator` checks).
