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

    // known quirk, pinned on purpose: an initial period that is not a multiple
    // of 12 yields a fractional loanYear ('Año … año 1.5 del préstamo').
    // Fase 2.1 of plan/fix-and-polish.md will floor it.
    expect(result.rows[headerIndex].loanYear).toBe(1.5);
    // the review reuses the last euribor read (index 12) until the next
    // multiple of 12
    expect(result.rows[headerIndex].euribor).toBe(3);

    // month 19 already runs at the variable rate: 0.5 + euribor[12] = 3.5%
    expect(rows[18].interest).toBeCloseTo(rows[17].balance * periodRate(3.5), 6);
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

  it('initialPayment is captured after the month-0 amortization (current behavior)', () => {
    const rate = 2.25;
    const original = annuity(100000, 240, rate);
    const result = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 1, month: 1, amount: 1000, type: 'payment' }],
    });
    const rows = monthRows(result);

    // pinned on purpose: today 'Tu cuota inicial' shows the recalculated
    // payment when month 1 carries a 'payment' amortization. Fase 2.3 of
    // plan/fix-and-polish.md will flip this to the original payment.
    expect(result.initialPayment).toBeCloseTo(rows[0].payment, 6);
    expect(result.initialPayment).not.toBeCloseTo(original, 3);

    // with a 'term' reduction the payment never changes, so both coincide —
    // the inconsistency between the two reduction types is what Fase 2.3 fixes
    const termResult = calculateSimulation({
      ...fixedInput(100000, 20, rate),
      amortizations: [{ year: 1, month: 1, amount: 1000, type: 'term' }],
    });
    expect(termResult.initialPayment).toBeCloseTo(original, 6);
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
});
