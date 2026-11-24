/**
 * Mortgage simulation calculation.
 *
 * No DOM, no jQuery, no React: this is the stable boundary between the jQuery
 * code and the React frontend (phase 2). Any change here must be covered by
 * tests (see `test/simulation.test.js`).
 *
 * Imported as an ES module (since the React rewrite; `index.html` loads the
 * bundled app) and exposes `globalThis.calculateSimulation` so the tests and
 * `src/state.js` can call it.
 *
 * Monthly model:
 *   annual review -> payment = annuity(balance, monthsLeft, rate)
 *   amortization  -> 'payment': balance -= c; payment = annuity(balance, monthsLeft, rate)
 *                    'term':    balance -= c; monthsLeft = solveMonths(balance, payment, rate)
 *   interest   = balance * rate/12/100
 *   principal  = min(payment - interest, balance)
 *   balance   -= principal
 *   monthsLeft--
 *   stop when balance == 0 or monthsLeft == 0
 */
(function (root) {
  'use strict';

  function getPeriodInterest(interest) {
    return interest / 12 / 100;
  }

  /**
   * Payment that pays off `pendingAmount` in `pendingMonths` months.
   * Bug #1: without the zero-rate guard the annuity is 0/0 = NaN and the whole
   * schedule becomes NaN (reachable from the UI with a 0% fixed rate).
   */
  function calculateMonthlyPayment(pendingAmount, pendingMonths, interest) {
    const periodInterest = getPeriodInterest(interest);
    if (periodInterest === 0) return pendingAmount / pendingMonths;
    return (
      pendingAmount *
      ((periodInterest * Math.pow(1 + periodInterest, pendingMonths)) /
        (Math.pow(1 + periodInterest, pendingMonths) - 1))
    );
  }

  /**
   * Months needed to pay off `balance` with an unchanged `payment`
   * (closed form: n = -ln(1 - balance*i/payment) / ln(1+i)).
   * Bug #6: the old code used `months -= Math.floor(amount / payment)`, which
   * ignores interest and deviates from the bank's reference (173 vs 176 months).
   * Returns NaN when the payment cannot cover the interest (no finite term).
   */
  function solveMonths(balance, payment, interest) {
    const periodInterest = getPeriodInterest(interest);
    if (periodInterest === 0) return balance / payment;
    const argument = 1 - (balance * periodInterest) / payment;
    if (argument <= 0) return NaN;
    return -Math.log(argument) / Math.log(1 + periodInterest);
  }

  /** Whole months, rounding up so the schedule never stops with money owed. */
  function toWholeMonths(months) {
    if (!Number.isFinite(months)) return NaN;
    const nearest = Math.round(months);
    return Math.abs(months - nearest) < 1e-9 ? nearest : Math.ceil(months);
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
   * @returns {{rows: Array<object>, initialPayment: number|null, totalInterest: number, warnings: Array<object>}}
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

    const rows = [];
    const warnings = [];

    // Bug #2: amortizations are kept as a list per month, so two amortizations
    // in the same month no longer overwrite each other. Bug #7: ones scheduled
    // beyond the term are dropped with a warning instead of being silently ignored.
    const amortizationByMonth = Object.create(null);
    amortizations.forEach(function (amortization) {
      const index = (amortization.year - 1) * 12 + amortization.month - 1;
      if (index < 0 || index >= years * 12) {
        warnings.push({
          type: 'amortization-out-of-term',
          year: amortization.year,
          month: amortization.month,
          amount: amortization.amount,
          termYears: years,
        });
        return;
      }
      if (!amortizationByMonth[index]) amortizationByMonth[index] = [];
      amortizationByMonth[index].push({
        year: amortization.year,
        month: amortization.month,
        amount: amortization.amount,
        type: amortization.type,
      });
    });

    const fixedMonths = hasInitialPeriod ? initialPeriodMonths : 12;
    let remainingMonths = years * 12;
    let interest;
    // Fase 2.4: a variable mortgage without a euribor series used to produce
    // spread + undefined → NaN in the whole table. The lib is pure and
    // self-contained, so a missing series defaults to a 0% euribor.
    let euriborValue = typeof euribor[0] == 'number' ? euribor[0] : 0;
    let pendingAmount = capital;
    let totalInterest = 0;
    let initialPayment = null;
    let month = 0;

    rows.push({ kind: 'initial', balance: pendingAmount });

    if (type == 'fixed') {
      interest = fixedInterest;
    } else if (hasInitialPeriod) {
      interest = initialFixedInterest;
    } else {
      interest = euriborSpread + euriborValue;
    }

    let monthlyPayment = calculateMonthlyPayment(pendingAmount, remainingMonths, interest);

    // Fase 2.3 (owner decision a): 'Tu cuota inicial' is the original offer
    // payment — the annuity over capital/term/rate before any amortization
    // applies. It used to be captured at month 0 after the amortizations,
    // which showed the recalculated payment for 'payment' reductions but the
    // original one for 'term' reductions. A zero capital has no payment.
    initialPayment = pendingAmount > 0 ? monthlyPayment : null;

    while (remainingMonths > 0 && pendingAmount > 0) {
      // Fase 2.1: floored — with an initial period that is not a multiple of
      // 12 the header used to render a fractional year ('Año 2027.5').
      // Math.abs was a no-op here: month is never negative.
      const loanYear = Math.floor(month / 12);
      if (typeof euribor[month] == 'number') {
        euriborValue = euribor[month];
      }
      if (
        type == 'variable' &&
        (month == fixedMonths || (month > fixedMonths && typeof euribor[month] == 'number'))
      ) {
        if (hasInitialPeriod && month == fixedMonths) {
          rows.push({ kind: 'period-end' });
        }
        rows.push({ kind: 'header', loanYear: loanYear, euribor: euriborValue });
        interest = euriborSpread + euriborValue;
        monthlyPayment = calculateMonthlyPayment(pendingAmount, remainingMonths, interest);
      }

      const amortizationsThisMonth = amortizationByMonth[month];
      if (amortizationsThisMonth) {
        for (let a = 0; a < amortizationsThisMonth.length; a++) {
          const amortization = amortizationsThisMonth[a];
          if (pendingAmount <= 0) break;
          rows.push({
            kind: 'amortization',
            amount: amortization.amount,
            reduction: amortization.type,
          });

          if (amortization.amount >= pendingAmount) {
            // Bug #4: an amortization bigger than the balance closes the loan
            // instead of producing a negative payment/interest/balance.
            warnings.push({
              type: 'amortization-exceeds-balance',
              year: amortization.year,
              month: amortization.month,
              amount: amortization.amount,
              balance: pendingAmount,
            });
            pendingAmount = 0;
            monthlyPayment = 0;
            remainingMonths = 0;
          } else {
            pendingAmount -= amortization.amount;
            if (amortization.type == 'term') {
              const months = toWholeMonths(solveMonths(pendingAmount, monthlyPayment, interest));
              if (Number.isFinite(months)) remainingMonths = months;
            } else {
              monthlyPayment = calculateMonthlyPayment(pendingAmount, remainingMonths, interest);
            }
          }
        }
      }

      const monthInterest = pendingAmount * getPeriodInterest(interest);
      // Bug #5: clamping to the balance keeps the last row at zero instead of negative.
      const monthPrincipal = Math.min(monthlyPayment - monthInterest, pendingAmount);

      pendingAmount -= monthPrincipal;
      totalInterest += monthInterest;
      rows.push({
        kind: 'month',
        month: month + 1,
        payment: monthlyPayment,
        balance: pendingAmount,
        principal: monthPrincipal,
        interest: monthInterest,
        remainingMonths: Math.max(0, remainingMonths - 1),
      });
      month++;
      remainingMonths--;
    }

    // Fase 2.2 (owner decision a): the schedule ends with an explicit closing
    // row, so the last (often partial) loan year is visible. The last header
    // only renders at a review, which the final year never reaches.
    rows.push({
      kind: 'end',
      months: month,
      loanYear: Math.floor(month / 12),
    });

    return {
      rows: rows,
      initialPayment: initialPayment,
      totalInterest: totalInterest,
      warnings: warnings,
    };
  }

  root.calculateSimulation = calculateSimulation;
})(typeof globalThis !== 'undefined' ? globalThis : this);
