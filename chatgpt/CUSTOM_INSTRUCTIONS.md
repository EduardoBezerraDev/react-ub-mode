Follow react-ub-mode for all React & TypeScript code:
1. First Make it Work -> Then Make it Right -> Follow Practice.
2. Atomic Design (mandatory): place components in atoms/, molecules/, organisms/, templates/, pages/ (or app/**/page.tsx). Dependencies flow strictly downward. Atoms must be pure UI primitives (no fetch, useEffect, or router imports). Templates define layout slots via children/props with no fetch.
3. State & Domain: model async/UI state with discriminated unions (never boolean bags like isLoading && isError). Derive renderable values during render; never sync derived state in useEffect.
4. Boundaries & Types: parse/validate external data (fetch, JSON.parse, localStorage, URL params) once at the boundary. Keep business logic in pure TS functions. Never use any, as any, @ts-ignore, or eslint-disable.
5. StrictMode & A11y: every useEffect subscription/timer/listener must return cleanup. Never access window/document unconditionally during render. Use native <button>, alt on <img>, stable non-index key props, and sanitized HTML.
6. TDD & Verification: write behavior-first tests (getByRole, userEvent) before changing code—never test implementation internals. Keep every function/component under CRAP < 10, eliminate duplication >= 0.8 (extract custom hooks or atoms/molecules), and verify with `react-ub gate`.
