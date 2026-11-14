import { describe, expect, it } from 'vitest';
import '../src/lib/simulation.js';

// `src/lib/simulation.js` is loaded as a classic script (so it also works when
// opening index.html directly, without a server) and exposes a global function.
const calculateSimulation = globalThis.calculateSimulation;

function fixedInput(capital, years, fixedInterest) {
  return {
    capital,
    years,
    type: 'fixed',
    fixedInterest,
    euriborSpread: 0,
    initialFixedInterest: 0,
    initialPeriodMonths: 12,
    initialPeriodActive: false,
    euribor: [],
    amortizations: [],
  };
}

function monthRows(result) {
  return result.rows.filter((row) => row.kind === 'month');
}

// Reference helpers, written independently from the implementation under test.
function periodRate(rate) {
  return rate / 12 / 100;
}

function annuity(principal, months, rate) {
  const i = periodRate(rate);
  if (i === 0) return principal / months;
  return principal * ((i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1));
}

function monthsNeeded(balance, payment, rate) {
  const i = periodRate(rate);
  if (i === 0) return balance / payment;
  return -Math.log(1 - (balance * i) / payment) / Math.log(1 + i);
}

function toWholeMonths(months) {
  const nearest = Math.round(months);
  return Math.abs(months - nearest) < 1e-9 ? nearest : Math.ceil(months);
}

describe('characterization — the cases that are correct today', () => {
  it('100k / 15y / 2.25% → payment 655.08 and final balance 0.000000', () => {
    const result = calculateSimulation(fixedInput(100000, 15, 2.25));

    expect(result.initialPayment.toFixed(2)).toBe('655.08');

    const rows = monthRows(result);
    expect(rows).toHaveLength(180);
    expect(rows[rows.length - 1].balance.toFixed(6)).toBe('0.000000');
    expect(result.warnings).toEqual([]);
  });

  it('100k / 15y / fixed 0.01% → payment 555.97 and interest 75.44', () => {
    const result = calculateSimulation(fixedInput(100000, 15, 0.01));

    expect(result.initialPayment.toFixed(2)).toBe('555.97');
    expect(result.totalInterest.toFixed(2)).toBe('75.44');
  });

  it('first row is the initial outstanding balance and month rows are sequential', () => {
    const result = calculateSimulation(fixedInput(100000, 15, 2.25));

    expect(result.rows[0]).toEqual({ kind: 'initial', balance: 100000 });
    const rows = monthRows(result);
    expect(rows[0].month).toBe(1);
    expect(rows[rows.length - 1].month).toBe(rows.length);
  });
});

describe('bug #1 — zero interest rate', () => {
  it('0% → payment 555.56 and a schedule without a single NaN', () => {
    const result = calculateSimulation(fixedInput(100000, 15, 0));

    expect(result.initialPayment.toFixed(2)).toBe('555.56');
    expect(result.totalInterest).toBe(0);
    expect(
      monthRows(result).some((row) =>
        [row.payment, row.balance, row.principal, row.interest].some((value) => Number.isNaN(value))
      )
    ).toBe(false);
  });
});

describe('bug #2 — two amortizations in the same month', () => {
  const base = fixedInput(100000, 20, 2.25);

  it('applies both (1000 + 2000) instead of letting the second overwrite the first', () => {
    const both = calculateSimulation({
      ...base,
      amortizations: [
        { year: 2, month: 3, amount: 1000, type: 'payment' },
        { year: 2, month: 3, amount: 2000, type: 'payment' },
      ],
    });
    const onlySecond = calculateSimulation({
      ...base,
      amortizations: [{ year: 2, month: 3, amount: 2000, type: 'payment' }],
    });

    expect(both.rows.filter((row) => row.kind === 'amortization')).toHaveLength(2);
    expect(onlySecond.rows.filter((row) => row.kind === 'amortization')).toHaveLength(1);

    // both amortizations reach the balance: 3000€ paid off, not 2000€
    expect(monthRows(both)[14].balance).toBeLessThan(monthRows(onlySecond)[14].balance);
    expect(both.totalInterest).not.toBe(onlySecond.totalInterest);
  });
});

describe('bug #4 — amortization bigger than the balance', () => {
  it('closes the loan with a zero balance, no negative cell and a warning', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 20, 2.25),
      amortizations: [{ year: 1, month: 2, amount: 150000, type: 'payment' }],
    });
    const rows = monthRows(result);

    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.payment).toBeGreaterThanOrEqual(0);
      expect(row.balance).toBeGreaterThanOrEqual(0);
      expect(row.principal).toBeGreaterThanOrEqual(0);
      expect(row.interest).toBeGreaterThanOrEqual(0);
    });
    expect(rows[rows.length - 1].balance).toBe(0);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        type: 'amortization-exceeds-balance',
        year: 1,
        month: 2,
        amount: 150000,
      })
    );
  });
});

describe('bug #5 — the last row is never negative', () => {
  it('ends at (or above) zero with an amortization in month 1', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 20, 2.25),
      amortizations: [{ year: 1, month: 1, amount: 1000, type: 'payment' }],
    });
    const rows = monthRows(result);

    expect(rows.every((row) => row.balance >= 0)).toBe(true);
    expect(rows[rows.length - 1].balance).toBeGreaterThanOrEqual(0);
    expect(rows[rows.length - 1].balance).toBeLessThan(0.01);
  });
});

describe('bug #6 — term ("plazo") reduction', () => {
  it('keeps the payment and derives the remaining term from the annuity equality', () => {
    const rate = 2.25;
    const result = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 3, month: 6, amount: 5000, type: 'term' }],
    });
    const rows = monthRows(result);
    const amortizationMonth = rows[29]; // (3-1)*12 + 6 → month 30

    // the payment is untouched by a term reduction
    expect(amortizationMonth.payment).toBe(rows[28].payment);

    // months left are exactly the ones the annuity equality demands
    const balanceAfterAmortization = amortizationMonth.balance + amortizationMonth.principal;
    expect(amortizationMonth.remainingMonths + 1).toBe(
      toWholeMonths(monthsNeeded(balanceAfterAmortization, amortizationMonth.payment, rate))
    );

    // sanity: that equality is what pays the loan off
    expect(annuity(balanceAfterAmortization, amortizationMonth.remainingMonths + 1, rate)).toBeCloseTo(
      amortizationMonth.payment,
      0
    );

    const last = rows[rows.length - 1];
    expect(last.balance).toBeGreaterThanOrEqual(0);
    expect(last.balance).toBeLessThan(0.01);
  });
});

describe('bug #7 — amortization outside the term', () => {
  it('is ignored with a warning: the result matches having no amortization at all', () => {
    const base = fixedInput(100000, 15, 2.25);
    const withOutside = calculateSimulation({
      ...base,
      amortizations: [{ year: 20, month: 1, amount: 5000, type: 'term' }],
    });
    const without = calculateSimulation(base);

    expect(withOutside.rows).toEqual(without.rows);
    expect(withOutside.warnings).toEqual([
      { type: 'amortization-out-of-term', year: 20, month: 1, amount: 5000, termYears: 15 },
    ]);
  });
});
