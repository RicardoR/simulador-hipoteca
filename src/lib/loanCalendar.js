/**
 * Loan calendar helpers: map loan months (1-based, month 1 = loan start) to
 * Spanish calendar labels, given the start month/year from the form.
 * Pure presentation — `calculateSimulation` stays month-indexed and knows
 * nothing about calendar dates.
 */

/** Spanish month abbreviations, 3 letters so every label occupies the same
 * width in the select and in the table (revised decision 3). */
export const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
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
