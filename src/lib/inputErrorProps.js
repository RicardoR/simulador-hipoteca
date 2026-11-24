/**
 * Shared presentation for invalid inputs (Fase 4.5 of plan/fix-and-polish.md):
 * the red surface, `aria-invalid` and an optional `aria-describedby` link,
 * used by the mortgage form and the amortization rows alike so the triple
 * (class + attribute + inline style) is defined once.
 */

/** Props to spread on an input when it is invalid; empty when it is valid. */
export function inputErrorProps(invalid, errorId) {
  if (!invalid) return {};
  return {
    'aria-invalid': true,
    ...(errorId ? { 'aria-describedby': errorId } : {}),
    style: { backgroundColor: 'var(--color-error-surface)' },
  };
}

/** Class list for an input, appending the shared is-invalid state class. */
export function inputClass(base, invalid, modifier = '') {
  return `${base}${modifier ? ` ${modifier}` : ''}${invalid ? ' is-invalid' : ''}`;
}
