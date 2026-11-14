# AGENTS.md

Static Spanish-language mortgage simulator (no build system; npm only for Vitest tests, no CI). Plain HTML + jQuery loaded from `src/jquery.min.js`.

> **Active work plan:** `plan/fix-issues-and-refactor.md`. It documents 7 verified bugs in the calculation logic, the required order of phases, and the branch strategy. Read it before touching `calculateSimulation`, `getTable`, or `buildEuriborEvolutionSection`.

## Running

- No build step. Open `index.html` directly or serve the repo root with any static server (e.g. `python3 -m http.server`).
- `npm install && npm test` runs the Vitest suite (`test/`). No lint/typecheck tooling exists; verify UI changes manually in the browser.

## Structure

- `index.html` — all markup, including inline `onkeyup`/`onclick` handlers that call globals (`mainFunction.check`, `mainFunction.changes`). Keep those handler names in sync with `src/main.js`.
- `src/lib/simulation.js` — pure calculation: `calculateSimulation(input) -> { rows, initialPayment, totalInterest, warnings }`. No DOM, no jQuery, no React; loaded as a classic script exposing `globalThis.calculateSimulation`. This is the stable boundary between jQuery and React and it is covered by tests — keep it DOM-free.
- `src/main.js` — UI/DOM layer, single global `mainFunction` object: reads the form, calls `calculateSimulation`, renders `rows` to the DOM.
- `escenario.json` (repo root) — form defaults + seed amortizations, fetched at runtime by `mainFunction.loadScenario()` with a relative path. Each personal branch replaces this one data file instead of editing code. Served over HTTP it is applied on load; over `file://` the fetch fails, the HTML defaults stay and a Spanish warning is shown.
- `src/style.css` — styles only; visibility of the fixed/variable interest blocks is toggled by jQuery `.show()/.hide()` in JS, not CSS classes.

## Gotchas (easy to miss)

- **jQuery load order**: `jquery.min.js` and `main.js` are `async` in `<head>`, `lib/simulation.js` is `defer`. `mainFunction.init()` runs only after `window.jQuery` appears, via a 50 ms `setInterval` poll at the bottom of `main.js`. Do not add code that assumes jQuery is ready at parse time.
- **Global `parseInt` override**: `main.js` reassigns `parseInt` to force radix 10. Don't "fix" it by passing an explicit radix elsewhere without checking callers.
- **Euribor rebuild trigger**: editing the term (years) field calls `check({..., max: 50})`, and `check` rebuilds the whole Euribor section when `max == 50`. Changing input validation bounds on that field silently breaks Euribor slider regeneration.
- **Euribor input handler bound conditionally**: the `input` listener on range sliders is only attached when `euriborEvolutionUserData` starts empty. If user edits don't persist, this condition is the place to look.
- **Seed data**: form defaults and seed amortizations live in `escenario.json` (repo root), fetched by `mainFunction.loadScenario()`. The six demo `getAmortizationsData()` amortizations only exist on personal branches, not here.
- **Simulation loop** in `calculateSimulation` (`src/lib/simulation.js`) mutates shared `months`/`pendingAmount` across iterations (amortizations change the term mid-loop). Preserve that order if you touch the loop: euribor update → amortization apply → interest/capital calc → append row.
- **Year labels** in the table headers come from `new Date().getFullYear()` (there is no `START_DATE` constant), so they roll over with the calendar year.
- **Language**: visible UI strings are Spanish (`Plazo`, `Cuota`, …) and stay that way; identifiers, comments and tests are in English. Commit messages follow conventional commits.
