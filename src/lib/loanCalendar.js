/**
 * Loan calendar helpers: map loan months (1-based, month 1 = loan start) to
 * Spanish calendar labels, given the start month/year from the form.
 * Pure presentation — `calculateSimulation` stays month-indexed and knows
 * nothing about calendar dates.
 */

/** Spanish month names, capitalized as table labels. */
export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Calendar month and year of a loan month.
 * `loanMonth` is 1-based (the schedule's Mes column), as are `startMonth` and
 * the returned `monthIndex` + 1; `year` is the calendar year.
 */
export function loanCalendarMonth(loanMonth, startMonth, startYear) {
  const offset = startMonth - 1 + (loanMonth - 1);
  return {
    monthIndex: offset % 12,
    year: startYear + Math.floor(offset / 12),
  };
}
