# AGENTS.md

Static Spanish-language mortgage simulator (no build system, no package manager, no tests, no CI). Plain HTML + jQuery loaded from `src/jquery.min.js`.

> **Active work plan:** `plan/fix-issues-and-refactor.md`. It documents 7 verified bugs in the calculation logic, the required order of phases, and the branch strategy. Read it before touching `getTable`, `buildEuriborEvolutionSection`, or `getAmortizationsData`.

## Running

- No build step. Open `index.html` directly or serve the repo root with any static server (e.g. `python3 -m http.server`).
- No lint/typecheck/test tooling exists. Verify changes manually in the browser.

## Structure

- `index.html` — all markup, including inline `onkeyup`/`onclick` handlers that call globals (`mainFunction.check`, `mainFunction.changes`). Keep those handler names in sync with `src/main.js`.
- `src/main.js` — all logic, single global `mainFunction` object. UI strings are Spanish (`Plazo`, `Cuota`, `FEE`/`TERM` constants) — keep them.
- `src/style.css` — styles only; visibility of the fixed/variable interest blocks is toggled by jQuery `.show()/.hide()` in JS, not CSS classes.

## Gotchas (easy to miss)

- **jQuery load order**: both scripts are `async` in `<head>`. `mainFunction.init()` runs only after `window.jQuery` appears, via a 50 ms `setInterval` poll at the bottom of `main.js`. Do not add code that assumes jQuery is ready at parse time.
- **Global `parseInt` override**: `main.js` reassigns `parseInt` to force radix 10. Don't "fix" it by passing an explicit radix elsewhere without checking callers.
- **Euribor rebuild trigger**: editing the term (years) field calls `check({..., max: 50})`, and `check` rebuilds the whole Euribor section when `max == 50`. Changing input validation bounds on that field silently breaks Euribor slider regeneration.
- **Euribor input handler bound conditionally**: the `input` listener on range sliders is only attached when `euriborEvolutionUserData` starts empty. If user edits don't persist, this condition is the place to look.
- **Seed data**: `getAmortizationsData()` at the bottom of `main.js` hardcodes six demo amortizations rendered on every page load. Demo values live here, not in HTML.
- **Simulation loop** in `getTable` mutates shared `months`/`pendingAmount` across iterations (amortizations change the term mid-loop). Preserve that order if you touch the loop: euribor update → amortization apply → interest/capital calc → append row.
- **`START_DATE`** (May 12, 2023) is hardcoded and drives year labels in the table.
- Language of UI and comments is Spanish (`src` strings, commit messages follow conventional commits).
