/**
 * Mortgage simulation calculation.
 *
 * No DOM, no jQuery, no React: this is the stable boundary between the jQuery
 * code (phases 0-1) and the React frontend (phase 2). Any change here must be
 * covered by tests (see `test/simulation.test.js`).
 *
 * Loaded as a classic script from `index.html` (it also works when opening the
 * file directly, without a server) and exposes `globalThis.calculateSimulation`.
 */
(function (root) {
  'use strict';

  function getPeriodInterest(interest) {
    return interest / 12 / 100;
  }

  function calculateMonthlyPayment(pendingAmount, pendingMonths, interest) {
    const periodInterest = getPeriodInterest(interest);
    return (
      pendingAmount *
      ((periodInterest * Math.pow(1 + periodInterest, pendingMonths)) /
        (Math.pow(1 + periodInterest, pendingMonths) - 1))
    );
  }

  /**
   * Calculates the full amortization schedule.
   *
   * @param {object} input
   * @param {number} input.capital               loan principal
   * @param {number} input.years                 term in years
   * @param {string} input.type                  'fixed' | 'variable'
   * @param {number} input.fixedInterest         fixed annual interest (%)
   * @param {number} input.euriborSpread         spread over euribor (%)
   * @param {number} input.initialFixedInterest  fixed interest of the initial period (%)
   * @param {number} input.initialPeriodMonths   duration of the initial fixed period (months)
   * @param {boolean} input.initialPeriodActive
   * @param {Array<number>} input.euribor        array indexed by month (only multiples of 12 are set)
   * @param {Array<{year:number, month:number, amount:number, type:'term'|'payment'}>} input.amortizations
   * @returns {{rows: Array<object>, initialPayment: number|null, totalInterest: number, warnings: string[]}}
   */
  function calculateSimulation(input) {
    const capital = input.capital;
    const years = input.years;
    const type = (input.type || '').toLowerCase();
    const fixedInterest = input.fixedInterest;
    const euriborSpread = input.euriborSpread;
    const initialFixedInterest = input.initialFixedInterest;
    const initialPeriodMonths = input.initialPeriodMonths;
    const hasInitialPeriod = !!input.initialPeriodActive;
    const euribor = input.euribor || [];
    const amortizations = input.amortizations || [];

    const fixedMonths = hasInitialPeriod ? initialPeriodMonths : 12;

    // Phase 0: month indexing is preserved, exactly as the DOM does it today
    // (two amortizations in the same month overwrite each other — bug #2, fixed
    // in phase 1 by replacing this with a list).
    const amortizationByMonth = Object.create(null);
    amortizations.forEach(function (amortization) {
      const index = (amortization.year - 1) * 12 + amortization.month - 1;
      amortizationByMonth[index] = { amount: amortization.amount, type: amortization.type };
    });

    const rows = [];
    let months = years * 12;
    let interest;
    let euriborValue = euribor[0];
    let pendingAmount = capital;
    let totalInterest = 0;
    let initialPayment = null;
    const warnings = [];

    rows.push({ kind: 'initial', balance: pendingAmount });

    if (type == 'fixed') {
      interest = fixedInterest;
    } else if (hasInitialPeriod) {
      interest = initialFixedInterest;
    } else {
      interest = euriborSpread + euriborValue;
    }

    let monthlyPayment = calculateMonthlyPayment(pendingAmount, months, interest);

    for (let i = 0; i < months; i++) {
      const loanYear = Math.abs(i / 12);
      if (typeof euribor[i] == 'number') {
        euriborValue = euribor[i];
      }
      if (type == 'variable' && (i == fixedMonths || (i > fixedMonths && typeof euribor[i] == 'number'))) {
        if (hasInitialPeriod && i == fixedMonths) {
          rows.push({ kind: 'period-end' });
        }
        rows.push({ kind: 'header', loanYear: loanYear, euribor: euriborValue });
        interest = euriborSpread + euriborValue;
        monthlyPayment = calculateMonthlyPayment(pendingAmount, months - i, interest);
      }
      if (typeof amortizationByMonth[i] == 'object') {
        const amortization = amortizationByMonth[i];
        rows.push({ kind: 'amortization', amount: amortization.amount, reduction: amortization.type });

        if (amortization.type == 'term') {
          months -= Math.floor(amortization.amount / monthlyPayment);
        } else {
          monthlyPayment = monthlyPayment * (1 - amortization.amount / pendingAmount);
        }
        pendingAmount -= amortization.amount;
      }
      const monthInterest = pendingAmount * getPeriodInterest(interest);
      const monthPrincipal = monthlyPayment - monthInterest;

      pendingAmount -= monthPrincipal;
      totalInterest += monthInterest;
      rows.push({
        kind: 'month',
        month: i + 1,
        payment: monthlyPayment,
        balance: pendingAmount,
        principal: monthPrincipal,
        interest: monthInterest,
      });
      if (i == 0) {
        initialPayment = monthlyPayment;
      }
      if (pendingAmount < 0) {
        break;
      }
    }

    return {
      rows: rows,
      initialPayment: initialPayment,
      totalInterest: totalInterest,
      warnings: warnings,
    };
  }

  root.calculateSimulation = calculateSimulation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
