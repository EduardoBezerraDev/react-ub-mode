---
name: react-ub-mode
description: >
  Follow the React & TypeScript craftsmanship principles when building or changing
  frontend code. Every change follows First Make it Work, then Then Make it Right,
  then Follow Practice, enforced by deterministic React quality-gate tools
  (crapper, dryer, mutator, react-audit). Use when the user runs /react-ub-mode
  or works on React/TypeScript UI, hooks, state, or frontend architecture.
---

# react-ub-mode

Every time you are asked to build or change React / TypeScript frontend code, follow:
* First Make it Work.
* Then Make it Right.
* Follow Practice.

# First Make it Work

## Laziness Protocol

* One decision lives in one place: single source of truth for state, derived values, validation schemas, and design tokens.
* Ship the smallest edit that solves the user-visible problem.
* Do not invent premature component abstractions, context providers, or global stores for local UI state.

## Foundational Thinking

* Design the state shape and TypeScript contracts before writing JSX or effects.
* Derive whatever can be computed during render; store only minimal canonical state.
* Do first whatever unblocks every later phase (types, boundary schemas, test harness).
* If concurrent async requests or rapid user interactions would race, do not share mutable state across renders — use `AbortController`, request sequence IDs, or idempotent mutation keys.

## TDD (Behavior-First React)

* Write the failing test before changing component, hook, or domain code.
* Query the DOM the way a user does (`getByRole`, `getByLabelText`, `getByText`) and drive real interactions (`userEvent`).
* See the test fail for the exact reason you expect.
* Make the smallest change that makes it pass.
* If an honest behavioral test is impractical (e.g. pure visual CSS layout), do not write a brittle snapshot or mock-heavy test.

## Redesign From First Principles

* Do not bolt a new boolean flag (`isCompactV2`, `skipValidation`, `legacyMode`) onto an old component API.
* Ask what component composition (`children`, slots, compound components, or pure domain split) you would have built if the requirement had been there from the start, and deliver it in verifiable pieces.

## Attack the Premise

* When two fixes that share one premise fail the same gate (render loop, hydration mismatch, stale closure, flaky async test), write that premise in one sentence and identify which state owner or `useEffect` holds the imbalance.
* Remove the broken premise or effect instead of stacking another `useEffect`, `useRef`, or `setTimeout` patch.
* Do not start another fix until you have done that.

## Subtract Before You Add

* Delete redundant `useEffect`s, cargo-culted `useMemo`/`useCallback`, dead props, and wrapper elements before adding new state or hooks.

## Outcome-Oriented Execution

* Aim at a verifiable user outcome: accessible DOM roles, visible text, validated network contracts, and clean render behavior.
* A break in the middle is allowed when you planned it and can undo it cleanly.

## Build the Lever

* If repetitive frontend work (form migrations, typed API adapters, route audits) is not obvious at a glance, build the small script or codemod that does it.
* Do one component or module by hand, then make the tool match that unit.

## Architecture (React & Frontend)

### Model the Domain

* Put UI and async state in discriminated unions that make illegal states impossible (e.g. `{ status: 'idle' } | { status: 'loading' } | { status: 'error'; error: Error } | { status: 'success'; data: T }` instead of `{ isLoading, isError, data }`).
* Maintain a glossary of domain terms shared between API schemas, pure domain functions, and UI labels.
* If a component is already clear, local, and small, leave it alone.

### Boundary Discipline

* Parse and validate external data (`fetch` responses, `JSON.parse`, `localStorage`, URL search params, `FormData`, `postMessage`, server props) once at the boundary using a schema or explicit parser.
* Inside components and domain helpers, trust the validated types.
* Keep business logic, formatting, filtering, and state transitions in pure TypeScript functions outside React components.

### Type System Discipline

* Make illegal prop combinations impossible with discriminated union props instead of mutually exclusive booleans.
* Parse external data once where it enters.
* Never silence the compiler or linter (`any`, `as any`, `@ts-ignore`, `@ts-expect-error` without justification, unguarded `!.`, or `eslint-disable`). Fix the underlying type.

### Make Operations Idempotent & StrictMode-Safe

* Event handlers, form submissions, and async mutations must survive double-clicks and out-of-order responses.
* Every `useEffect` must survive React StrictMode double-invocation (`mount -> cleanup -> remount`).
* Any `useEffect` registering a listener, timer, or subscription must return a cleanup function.

### Separate Before Serializing Shared State (Colocation & Server/Client Split)

* Keep state as close as possible to the component that uses it; lift state only when siblings genuinely share it.
* Separate server/async cache state from ephemeral UI state (modals, hover, form drafts).
* In React Server Components / SSR frameworks, keep `'use client'` boundaries as leaf-level as possible and never read `window` or `document` unconditionally during render.

### Atomic Design Component Hierarchy

* Organize all React components into the five Atomic Design layers with **strictly downward dependencies** (`pages` -> `templates` -> `organisms` -> `molecules` -> `atoms`):
  * **Atoms (`atoms/`)**: Pure, reusable UI primitives (`Button`, `Input`, `Label`, `Badge`, `Icon`). No `fetch()`, no `useEffect`, no router/store coupling, and never import from higher layers.
  * **Molecules (`molecules/`)**: Small cohesive compositions of atoms (`FormField`, `SearchBar`, `StatTile`). Ephemeral UI state only; no network fetching or page routing.
  * **Organisms (`organisms/`)**: Self-contained UI sections (`Header`, `CheckoutForm`, `UserTable`) composing atoms and molecules, coordinating section state or feature callbacks.
  * **Templates (`templates/`)**: Page-level layout skeletons and composition slots (`DashboardLayout`, `AuthTemplate`). Compose structure via `children`/slot props; no `fetch()` or domain business logic.
  * **Pages (`pages/` or `app/**/page.tsx`)**: Route orchestrators that wire boundary-validated data, feature hooks, and templates/organisms together.
* Never import upward across layers; pass higher-level UI through `children`/slots or extract shared primitives down to `atoms/` or `molecules/`.

# Then Make it Right

## Fix Root Causes

* Reproduce bugs with a failing test (including StrictMode or async race cases).
* Fix the root cause.
* Adding `?.` optional chaining or `if (!data) return null` to hide an invalid state transition is not a fix.

## Sequence Work into Verifiable Units

* Finish one small component, hook, or pure domain module and verify it (tests + `react-ub gate`).
* Then start the next unit.

## Test Behavior, Not Implementation

* Tests must interact with rendered UI the way a user does and assert on observable outcomes (roles, text, disabled state, callback payloads, network calls).
* Never test private state, CSS class names, `container.querySelector` internals, or mock the module under test.
* If the test would still pass when every component rendered `null` or every handler was a no-op, throw it out.

## Crapper (`react-ub crapper`)

* Run `react-ub crapper` to measure cyclomatic complexity, coverage, and CRAP score per component, hook, and function.
* Reduce every unit under **CRAP 10** by extracting pure domain helpers, splitting subcomponents, or covering branches with behavioral tests.
* Consider whether explicit `switch` render dispatchers are clearer than nested ternaries.

## Dryer (`react-ub dryer`)

* Run `react-ub dryer` to detect structural duplication at similarity **0.8 or above** across components, hooks, and utilities.
* Extract duplicated stateful behavior into custom hooks, duplicated UI primitives into `atoms/` or `molecules/`, and duplicated domain logic into pure helpers.

## Mutator (`react-ub mutator`)

* Run `react-ub mutator` (and `react-ub mutator --run` when executing the test suite).
* Cover the uncovered branches and components.
* Kill the surviving mutants (strengthen assertions that miss conditional JSX, negated predicates, or broken callbacks).
* Delete dead props, unused exports, and unreachable branches.

## React Audit (`react-ub react-audit`)

* Run `react-ub react-audit` to verify:
  * Atomic Design compliance (components placed in `atoms/`, `molecules/`, `organisms/`, `templates/`, `pages/`, downward-only imports, pure `atoms/` and `templates/`)
  * Zero boundary leaks (unparsed `JSON.parse`, `res.json()`, `localStorage`)
  * Zero compiler/type suppressions (`any`, `@ts-ignore`)
  * Clean hooks (no derived state synced via `useEffect`, cleanup on subscriptions/timers)
  * Semantic HTML & accessibility (`<button>` over `<div onClick>`, `alt` on `<img>`, stable non-index `key`s, sanitized HTML, SSR-safe globals)
  * Focused component sizes and prop counts

## Refactoring

* Pin what the component or hook does with behavioral tests.
* Change the structure (extract domain logic, split subcomponents, simplify state).
* Prove the behavior did not change (tests green + `react-ub gate` passing).

# Practice

## Keep a Log

* Keep a concise log of each engineering action taken, the reason for it, and the gate metrics (`CRAP`, `Dryer`, `Mutator`, `React Audit`) before and after.
* Report that log upon completion.

## Guard the Context Window

* Keep the main thread focused on decisions and edits.
* Send broad codebase exploration or verbose tool logs to subagents or summary files, keeping only actionable results.

## Worktree Cleanup

* Find dead components, unused fixtures, and stale worktrees; confirm nothing in use references them, then reclaim disk space.
* Uncommitted work waits for an explicit decision.

## Commit and Push

* Commit often, in small ordered commits.
* Each commit message says why, what changed, and how you proved it (tests + `react-ub gate`).
* Push to the main line at the end.
