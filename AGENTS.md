# AGENTS.md

Static Spanish-language mortgage simulator. **React + Vite** frontend, npm only for Vitest tests, no CI. `src/lib/simulation.js` stays DOM-free and framework-free on purpose.

> **Active work plan:** `plan/fix-and-polish.md` (bugs, tests, docs and polish, branch `fix-and-polish`). The previous plans, `plan/redesign.md` (Hallmark redesign) and `plan/fix-issues-and-refactor.md` (Tramo A + B), are fully merged in master. Read a plan before touching `calculateSimulation`, the calculation order, or the UI system.

## Design

- **For any UI/design work, use the Hallmark skill** (`.agents/skills/hallmark`, invoke with `/hallmark`). It owns the visual system: tokens, colour, type, layout gates. Load it before restyling or building UI.
- Design checks: `node .agents/skills/hallmark/scripts/sloplint.mjs <target> --render --url http://localhost:5173/` (needs the dev server; `puppeteer-core` is a devDependency, Chrome on the machine). Without Chrome it runs static gates only — never claim a render pass that did not run.
- Hallmark's redesign verb (`/hallmark redesign <path>`) keeps content and wiring: `state.js`, `simulation.js`, handlers and the test suite are untouchable by it.

## Running

- `npm install`
- `npm run dev` — Vite dev server.
- `npm test` — Vitest suite (`test/simulation.test.js`, `test/state.test.js` + `test/App.test.jsx`). `vite.config.js` scopes discovery to `test/` (`test.include`), so the Hallmark skill's own tests are not picked up and no arguments are needed.
- `npm run build` → `dist/`. Check that `dist/` contains `escenario.json` before pushing.
- No lint/typecheck tooling exists; verify visual changes in the browser.

## Structure

- `index.html` — Vite entry point: `<div id="root">` + module script only. No inline handlers.
- `src/main.jsx` — mounts `<App />` and imports `src/style.css`.
- `src/App.jsx` — loads `escenario.json` on mount (relative path, fallback warning) and wires the components; collects warnings (scenario, invalid fields, simulation) and renders `ResultsTable` only after CALCULAR.
- `src/state.js` — the single `useReducer` state: form fields (strings, like the old DOM), validation, euribor overrides, amortizations, scenario application. **The value a slider shows is the value the calculation uses** — never duplicate a value into a second variable. Exports the euribor series/limits, the warning texts (`SCENARIO_WARNING`, `INVALID_FIELDS_WARNING`), `formatWarning`, the validators (`isValidField`, `isValidEuriborValue`, `isValidInitialPeriod`, `hasInvalidFields`, …) and the parsers — all exercised by `test/state.test.js`.
- `src/components/` — `MortgageForm`, `Amortizations`, `EuriborEvolution`, `ResultsTable`.
- `src/lib/simulation.js` — pure calculation: `calculateSimulation(input) -> { rows, initialPayment, totalInterest, warnings }`. No DOM, no jQuery, no React; imported as an ES module for its side effect (`globalThis.calculateSimulation`) and covered by tests. **Do not touch it outside a deliberate, tested change** (owner-approved: characterization tests first, then the fix — see `plan/fix-and-polish.md`).
- `src/lib/inputErrorProps.js` — shared invalid-input presentation (`aria-invalid`, `aria-describedby`, red surface) used by the form and the amortization rows.
- `src/lib/loanCalendar.js` — `MONTH_NAMES` + `loanCalendarMonth`: maps loan months (1-based) to Spanish calendar labels from `fields.startMonth`/`startYear`. Presentation only — `calculateSimulation` stays month-indexed; calendar-year headings begin in January, while rate reviews remain on the loan anniversary.
- `public/escenario.json` — form defaults + seed amortizations, fetched at runtime as `escenario.json`. Each personal branch replaces this one data file instead of editing code. Optional `startDate` (ISO date) seeds the form's "Inicio" field (year the loan starts counting from for euribor slider and table header labels). Served over HTTP it applies on load; if the fetch fails, the built-in defaults stay and a Spanish warning is shown. Vite copies `public/` to the root of `dist/`, so the URL is `/escenario.json` in production too.
- `src/style.css` — styles only. Visibility of results/blocks is conditional rendering in JSX, not CSS classes.
- `vercel.json` — Build Command `npm run build`, Output Directory `dist`, Install Command `npm install`, so deploys do not depend on dashboard settings.

## Gotchas (easy to miss)

- **Field values are strings in the reducer** (`state.fields`); parsing happens in `buildSimulationInput` and validation in `isValidField`. Invalid fields are marked red and **block** CALCULAR — that is intentional (it replaces the old NaN tables).
- **`state.termYears` / `state.startYear` are last-valid caches** of the `years` / `startYear` fields: sliders and selects derive from them so a half-typed field does not collapse the layout.
- **Any data change clears `state.result`** (no stale tables). Only `calculated` produces a result.
- **Amortization years are never silently clamped**: if the term drops below a stored year, the select keeps showing it (as an extra option) and the simulation reports it via `warnings` (bug #7).
- **Seed data**: form defaults and seed amortizations live in `public/escenario.json`. The demo `getAmortizationsData()` amortizations only exist on personal branches, not here.
- **Simulation loop** in `calculateSimulation` (`src/lib/simulation.js`) mutates shared `months`/`pendingAmount` across iterations (amortizations change the term mid-loop). Preserve that order if you touch the loop: euribor update → amortization apply → interest/capital calc → append row.
- **Year labels** come from `state.startYear` (form field "Inicio", seeded by `escenario.json` `startDate`, default = current year).
- **No CI** (no `.github/workflows`): the only safety net is local `npm test` → `npm run build` before pushing — every push deploys on Vercel.
- **Language**: visible UI strings are Spanish (`Plazo`, `Cuota`, …) and stay that way; identifiers, comments and tests are in English. Commit messages follow conventional commits.
