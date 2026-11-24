import { describe, expect, it } from 'vitest';
import { MONTH_NAMES, loanCalendarMonth } from '../src/lib/loanCalendar.js';

describe('MONTH_NAMES', () => {
  it('has the twelve Spanish months in order, all three letters wide', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('Ene');
    expect(MONTH_NAMES[11]).toBe('Dic');
    for (const name of MONTH_NAMES) expect(name).toHaveLength(3);
  });
});

describe('loanCalendarMonth', () => {
  it('maps month 1 to the start month and year', () => {
    expect(loanCalendarMonth(1, 6, 2023)).toEqual({ monthIndex: 5, year: 2023 });
    expect(loanCalendarMonth(1, 1, 2026)).toEqual({ monthIndex: 0, year: 2026 });
  });

  it('rolls over the year at the calendar boundary', () => {
    // a loan starting in June: month 7 is December 2023, month 8 January 2024
    expect(loanCalendarMonth(7, 6, 2023)).toEqual({ monthIndex: 11, year: 2023 });
    expect(loanCalendarMonth(8, 6, 2023)).toEqual({ monthIndex: 0, year: 2024 });
    // and its loan year 1 ends in May 2024
    expect(loanCalendarMonth(12, 6, 2023)).toEqual({ monthIndex: 4, year: 2024 });
  });

  it('closes the create-own-amortizations scenario in May 2033 (month 120)', () => {
    expect(loanCalendarMonth(120, 6, 2023)).toEqual({ monthIndex: 4, year: 2033 });
  });

  it('works for a January start (the month equals the block label)', () => {
    expect(loanCalendarMonth(13, 1, 2026)).toEqual({ monthIndex: 0, year: 2027 });
  });
});
