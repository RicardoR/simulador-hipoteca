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

describe('characterization — the cases that are correct today', () => {
  it('100k / 15y / 2.25% → payment 655.08 and final balance 0.000000', () => {
    const result = calculateSimulation(fixedInput(100000, 15, 2.25));

    expect(result.initialPayment.toFixed(2)).toBe('655.08');

    const monthRows = result.rows.filter((row) => row.kind === 'month');
    expect(monthRows).toHaveLength(180);
    expect(monthRows[monthRows.length - 1].balance.toFixed(6)).toBe('0.000000');
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
    const monthRows = result.rows.filter((row) => row.kind === 'month');
    expect(monthRows[0].month).toBe(1);
    expect(monthRows[monthRows.length - 1].month).toBe(monthRows.length);
  });
});
