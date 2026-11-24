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

describe('bug #6 — term reduction', () => {
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

// Sparse euribor array like the app builds it: one value per loan year,
// stored at the month index yearIndex * 12.
function sparseEuribor(valuesPerYear) {
  const euribor = [];
  valuesPerYear.forEach((value, yearIndex) => {
    euribor[yearIndex * 12] = value;
  });
  return euribor;
}

describe('characterization — variable type: the annual review', () => {
  it('reviews every 12 months: header row, spread + euribor, re-annuitization over the months left', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 5, 0),
      type: 'variable',
      euriborSpread: 1.5,
      euribor: sparseEuribor([2, 3, 4, 2.5, 3.5]),
    });

    // reviews at months 12/24/36/48; month 0 runs on euribor[0] with no header
    const headers = result.rows.filter((row) => row.kind === 'header');
    expect(headers.map((row) => row.loanYear)).toEqual([1, 2, 3, 4]);
    expect(headers.map((row) => row.euribor)).toEqual([3, 4, 2.5, 3.5]);
    expect(result.rows[1].kind).toBe('month');

    // year 1 runs at 1.5 + 2 = 3.5%
    const rows = monthRows(result);
    expect(rows[0].payment).toBeCloseTo(annuity(100000, 60, 3.5), 6);

    // after the review the annuity is rebuilt with the current balance and
    // the months left (60 - 12 = 48)
    const balanceAfterYear1 = rows[11].balance;
    expect(rows[12].payment).toBeCloseTo(annuity(balanceAfterYear1, 48, 4.5), 6);
    expect(rows[12].interest).toBeCloseTo(balanceAfterYear1 * periodRate(4.5), 6);
  });
});

describe('characterization — variable type: the initial fixed period', () => {
  it('keeps the initial fixed interest until fixedMonths, then ends the period', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 10, 0),
      type: 'variable',
      euriborSpread: 0.5,
      initialPeriodActive: true,
      initialFixedInterest: 1.25,
      initialPeriodMonths: 18,
      euribor: sparseEuribor([2, 3, 4, 2.5, 3.5, 3, 2.8, 3.2, 3.6, 3.1]),
    });
    const rows = monthRows(result);

    // months 1-18 run at the initial fixed rate
    expect(rows[0].interest).toBeCloseTo(100000 * periodRate(1.25), 6);
    expect(rows[17].interest).toBeCloseTo(rows[16].balance * periodRate(1.25), 6);

    // the period ends at month 18: period-end row right before the review header
    const headerIndex = result.rows.findIndex((row) => row.kind === 'header');
    expect(result.rows[headerIndex - 1].kind).toBe('period-end');
    expect(result.rows.filter((row) => row.kind === 'period-end')).toHaveLength(1);

    // Fixed by Fase 2.1 of plan/fix-and-polish.md: the loan year is floored
    // (it used to render as 1.5 — 'Año … año 1.5 del préstamo').
    expect(result.rows[headerIndex].loanYear).toBe(1);
    // the review reuses the last euribor read (index 12) until the next
    // multiple of 12
    expect(result.rows[headerIndex].euribor).toBe(3);

    // month 19 already runs at the variable rate: 0.5 + euribor[12] = 3.5%
    expect(rows[18].interest).toBeCloseTo(rows[17].balance * periodRate(3.5), 6);
  });

  it('every header shows a whole loan year (Fase 2.1)', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 10, 0),
      type: 'variable',
      euriborSpread: 0.5,
      initialPeriodActive: true,
      initialFixedInterest: 1.25,
      initialPeriodMonths: 18,
      euribor: sparseEuribor([2, 3, 4, 2.5, 3.5, 3, 2.8, 3.2, 3.6, 3.1]),
    });

    const loanYears = result.rows
      .filter((row) => row.kind === 'header')
      .map((row) => row.loanYear);
    expect(loanYears.length).toBeGreaterThan(0);
    for (const loanYear of loanYears) expect(Number.isInteger(loanYear)).toBe(true);
  });

  it('a 1-year term never reaches its month-12 review without an initial period', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 1, 0),
      type: 'variable',
      euriborSpread: 1.5,
      euribor: sparseEuribor([2, 3]),
    });

    // the single review point coincides with the end: the whole year runs on
    // euribor[0] + spread, no header row at all
    expect(result.rows.filter((row) => row.kind === 'header')).toHaveLength(0);
    const rows = monthRows(result);
    expect(rows).toHaveLength(12);
    expect(rows[0].payment).toBeCloseTo(annuity(100000, 12, 3.5), 6);
    expect(rows[11].interest).toBeCloseTo(rows[10].balance * periodRate(3.5), 6);
  });

  it('a 1-year term with a 6-month initial period gets exactly one review', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 1, 0),
      type: 'variable',
      euriborSpread: 0.5,
      initialPeriodActive: true,
      initialFixedInterest: 1.25,
      initialPeriodMonths: 6,
      euribor: sparseEuribor([2, 3]),
    });

    const headers = result.rows.filter((row) => row.kind === 'header');
    expect(headers).toHaveLength(1);
    expect(result.rows.filter((row) => row.kind === 'period-end')).toHaveLength(1);
    // months 1-6 at the initial fixed rate, month 7 onwards at the review rate
    expect(monthRows(result)[0].interest).toBeCloseTo(100000 * periodRate(1.25), 6);
    expect(monthRows(result)[6].payment).toBeCloseTo(
      annuity(monthRows(result)[5].balance, 6, 0.5 + 2),
      6
    );
  });
});

describe('Fase 2.2 — the schedule ends with an explicit closing row', () => {
  it('a 10-year loan closes with the end row at month 120, loan year 10', () => {
    const result = calculateSimulation(fixedInput(100000, 10, 2.25));
    expect(result.rows[result.rows.length - 1]).toEqual({
      kind: 'end',
      months: 120,
      loanYear: 10,
    });
  });

  it('the end row is present and has a whole loan year when the loan closes early', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 20, 2.25),
      amortizations: [{ year: 1, month: 2, amount: 150000, type: 'payment' }],
    });
    const end = result.rows[result.rows.length - 1];
    expect(end.kind).toBe('end');
    expect(Number.isInteger(end.loanYear)).toBe(true);
  });
});

describe('characterization — amortization reductions', () => {
  it('a "payment" reduction recalculates the annuity over the reduced balance and the months left', () => {
    const rate = 2.25;
    const result = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 2, month: 1, amount: 10000, type: 'payment' }],
    });
    const rows = monthRows(result);

    // year 2 month 1 → month index 12: from month 13 on the payment is a new
    // annuity over the reduced balance and the remaining 240 - 12 = 228 months
    const balanceBefore = rows[11].balance;
    expect(rows[12].payment).toBeCloseTo(annuity(balanceBefore - 10000, 228, rate), 6);
    expect(rows[12].payment).toBeLessThan(rows[11].payment);
  });

  it('amortization rows carry their loan month so the table can date them', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 20, 2.25),
      amortizations: [{ year: 2, month: 1, amount: 10000, type: 'payment' }],
    });
    // year 2 month 1 → loan month 13
    expect(result.rows.find((row) => row.kind === 'amortization')).toEqual({
      kind: 'amortization',
      month: 13,
      amount: 10000,
      reduction: 'payment',
    });
  });

  it('initialPayment is the original offer payment, before any amortization (Fase 2.3)', () => {
    const rate = 2.25;
    const original = annuity(100000, 240, rate);
    const result = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 1, month: 1, amount: 1000, type: 'payment' }],
    });
    const rows = monthRows(result);

    // Fixed by owner decision a (Fase 2.3 of plan/fix-and-polish.md): it used
    // to be captured after the month-0 amortization, showing the recalculated
    // payment for 'payment' reductions. Now it is the offer payment.
    expect(result.initialPayment).toBeCloseTo(original, 6);
    expect(result.initialPayment).not.toBeCloseTo(rows[0].payment, 3);

    // with a 'term' reduction the payment never changes, so both are the same
    const termResult = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 1, month: 1, amount: 1000, type: 'term' }],
    });
    expect(termResult.initialPayment).toBeCloseTo(original, 6);
  });

  it('a zero capital keeps initialPayment null (the UI hides the summary)', () => {
    const result = calculateSimulation(fixedInput(0, 20, 2.25));
    expect(result.initialPayment).toBeNull();
    expect(result.rows[0]).toEqual({ kind: 'initial', balance: 0 });
  });

  it('totalInterest equals the sum of the monthly interest rows', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 10, 0),
      type: 'variable',
      euriborSpread: 0.9,
      initialPeriodActive: true,
      initialFixedInterest: 1.1,
      initialPeriodMonths: 6,
      euribor: sparseEuribor([1.8, 2.4, 3, 2.6, 2.2, 2.9, 3.3, 2.7, 3.1, 2.5]),
      amortizations: [
        { year: 3, month: 4, amount: 5000, type: 'payment' },
        { year: 7, month: 2, amount: 3000, type: 'term' },
      ],
    });
    const sum = monthRows(result).reduce((acc, row) => acc + row.interest, 0);
    expect(result.totalInterest).toBeCloseTo(sum, 8);
  });

  it('a variable mortgage without euribor series runs at the spread, not NaN (Fase 2.4)', () => {
    const result = calculateSimulation({
      ...fixedInput(100000, 5, 0),
      type: 'variable',
      euriborSpread: 1.5,
      euribor: [],
    });
    const rows = monthRows(result);

    // the euribor defaults to 0: 0% euribor + 1.5% spread
    expect(rows[0].payment).toBeCloseTo(annuity(100000, 60, 1.5), 6);
    expect(
      rows.every((row) =>
        [row.payment, row.balance, row.principal, row.interest].every((value) => !Number.isNaN(value))
      )
    ).toBe(true);
  });
});
