# AGENTS.md

Static Spanish-language mortgage simulator. **React + Vite** frontend, npm only for Vitest tests, no CI. `src/lib/simulation.js` stays DOM-free and framework-free on purpose.

> **Active work plan:** `plan/fix-issues-and-refactor.md`. Tramo A (Fases 0/1/3: tests, 7 bugs, JSON) is merged in master; Tramo B (Fase 2 React + Fase 4 limpieza) lives on the `react-rewrite` branch. Read the plan before touching `calculateSimulation` or the calculation order.

## Running

- `npm install`
- `npm run dev` — Vite dev server.
- `npm test` — Vitest suite (`test/simulation.test.js` + `test/App.test.jsx`).
- `npm run build` → `dist/`. Check that `dist/` contains `escenario.json` before pushing.
- No lint/typecheck tooling exists; verify visual changes in the browser.

## Structure

- `index.html` — Vite entry point: `<div id="root">` + module script only. No inline handlers.
- `src/main.jsx` — mounts `<App />` and imports `src/style.css`.
- `src/App.jsx` — loads `escenario.json` on mount (relative path, fallback warning) and wires the components; collects warnings (scenario, invalid fields, simulation) and renders `ResultadoTabla` only after CALCULAR.
- `src/state.js` — the single `useReducer` state: form fields (strings, like the old DOM), validation, euribor overrides, amortizations, scenario application. **The value a slider shows is the value the calculation uses** — never duplicate a value into a second variable. Exports `EURIBOR_SERIES`, `SCENARIO_WARNING`, `formatWarning`.
- `src/components/` — `FormularioDatos`, `Amortizaciones`, `EuriborEvolucion`, `ResultadoTabla`.
- `src/lib/simulation.js` — pure calculation: `calculateSimulation(input) -> { rows, initialPayment, totalInterest, warnings }`. No DOM, no jQuery, no React; loaded for its side effect (`globalThis.calculateSimulation`) and covered by tests. **Do not touch it outside a deliberate, tested change.**
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
