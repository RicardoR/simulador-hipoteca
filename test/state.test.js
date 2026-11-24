import { describe, expect, it } from 'vitest';
import {
  INVALID_FIELDS_WARNING,
  formatWarning,
  hasInvalidFields,
  initialState,
  isValidAmortizationAmount,
  isValidEuriborValue,
  isValidField,
  parseFloatField,
  parseIntField,
  reducer,
} from '../src/state.js';

// Characterization tests: they pin the behavior that exists today, including
// the quirks that plan/fix-and-polish.md Fases 1.x will deliberately change.
// Each quirk is marked so flipping it means editing that assertion on purpose.

describe('parseIntField (characterization)', () => {
  it('parses clean digit strings', () => {
    expect(parseIntField('1500')).toBe(1500);
    expect(parseIntField('0')).toBe(0);
  });

  it('strips dots, commas and spaces as thousands separators', () => {
    // Known quirk, pinned on purpose: separators are removed, so '1.5'
    // parses as 15. Fase 1.4 of plan/fix-and-polish.md makes this invalid.
    expect(parseIntField('1.5')).toBe(15);
    expect(parseIntField('1,5')).toBe(15);
    expect(parseIntField('1 500')).toBe(1500);
    expect(parseIntField('150.000')).toBe(150000);
  });

  it('rejects anything that is not digits after stripping', () => {
    expect(parseIntField('')).toBe(NaN);
    expect(parseIntField('   ')).toBe(NaN);
    expect(parseIntField('abc')).toBe(NaN);
    expect(parseIntField('-5')).toBe(NaN);
    expect(parseIntField('12a')).toBe(NaN);
  });
});

describe('parseFloatField (characterization)', () => {
  it('accepts a dot or a comma as the decimal separator', () => {
    expect(parseFloatField('2.25')).toBe(2.25);
    expect(parseFloatField('2,25')).toBe(2.25);
    expect(parseFloatField('-0.5')).toBe(-0.5);
  });

  it('is strict about the empty string but lenient about whitespace', () => {
    expect(parseFloatField('')).toBe(NaN);
    // Known quirk, pinned on purpose: Number('   ') === 0, so a blank field
    // reaches the calculation as 0% interest. Fase 1.3 trims before validating.
    expect(parseFloatField('   ')).toBe(0);
  });

  it('delegates to Number(), so exponent and sign forms pass through', () => {
    expect(parseFloatField('1e3')).toBe(1000);
    expect(parseFloatField('+3')).toBe(3);
    expect(parseFloatField('2.2.3')).toBe(NaN);
    expect(parseFloatField('abc')).toBe(NaN);
  });
});

describe('isValidField (characterization)', () => {
  it('validates int rules (capital, startYear, initialPeriodMonths)', () => {
    expect(isValidField('capital', '150000')).toBe(true);
    expect(isValidField('capital', '-5')).toBe(false);
    expect(isValidField('capital', '')).toBe(false);
    // '1.5' parses as 15 today (see parseIntField): valid until Fase 1.4.
    expect(isValidField('capital', '1.5')).toBe(true);
    expect(isValidField('startYear', '1900')).toBe(true);
    expect(isValidField('startYear', '1899')).toBe(false);
    expect(isValidField('startYear', '2200')).toBe(true);
    expect(isValidField('startYear', '2201')).toBe(false);
    expect(isValidField('initialPeriodMonths', '0')).toBe(true);
    expect(isValidField('initialPeriodMonths', '-1')).toBe(false);
  });

  it('validates number rules (years, interests) with min and max', () => {
    expect(isValidField('years', '25')).toBe(true);
    // years is a 'number' rule: '12.5' is valid today and the calculation
    // truncates it to 12 (see the termYears cache test below).
    expect(isValidField('years', '12.5')).toBe(true);
    expect(isValidField('years', '12,5')).toBe(true);
    expect(isValidField('years', '0')).toBe(false);
    expect(isValidField('years', '50')).toBe(true);
    expect(isValidField('years', '51')).toBe(false);
    expect(isValidField('fixedInterest', '0')).toBe(true);
    expect(isValidField('fixedInterest', '-1')).toBe(false);
    expect(isValidField('euriborSpread', 'abc')).toBe(false);
  });

  it('accepts unknown field names and coerces non-string values', () => {
    expect(isValidField('nonexistent', 'whatever')).toBe(true);
    expect(isValidField('capital', 150000)).toBe(true);
  });
});

describe('isValidEuriborValue (characterization)', () => {
  it('accepts values within [-0.5, 15] on the 0.1 step', () => {
    expect(isValidEuriborValue('2.2')).toBe(true);
    expect(isValidEuriborValue('-0.5')).toBe(true);
    expect(isValidEuriborValue('15')).toBe(true);
    expect(isValidEuriborValue('5.4')).toBe(true);
  });

  it('rejects out-of-range, off-step, empty and non-string entries', () => {
    expect(isValidEuriborValue('15.1')).toBe(false);
    expect(isValidEuriborValue('-0.6')).toBe(false);
    expect(isValidEuriborValue('2.25')).toBe(false);
    expect(isValidEuriborValue('')).toBe(false);
    expect(isValidEuriborValue('   ')).toBe(false);
    expect(isValidEuriborValue('abc')).toBe(false);
  });

  it('tolerates float noise on the step grid; a comma is rejected today', () => {
    // (2.2 + 0.5) / 0.1 is not exactly 27 in floating point: the epsilon
    // in the implementation keeps on-step values valid.
    expect(isValidEuriborValue('2.2')).toBe(true);
    expect(isValidEuriborValue('8.7')).toBe(true);
    // Known quirk, pinned on purpose: a comma is rejected here while every
    // other numeric field accepts it (gap noted in plan/fix-and-polish.md).
    expect(isValidEuriborValue('5,4')).toBe(false);
    // The draft always comes from an input, so numbers are not accepted.
    expect(isValidEuriborValue(5.4)).toBe(false);
  });
});

describe('isValidAmortizationAmount (characterization)', () => {
  it('accepts whole amounts including zero and rejects negatives and junk', () => {
    expect(isValidAmortizationAmount('1000')).toBe(true);
    expect(isValidAmortizationAmount('0')).toBe(true);
    expect(isValidAmortizationAmount('-5')).toBe(false);
    expect(isValidAmortizationAmount('')).toBe(false);
    expect(isValidAmortizationAmount('abc')).toBe(false);
    // '1.5' parses as 15 today (see parseIntField): valid until Fase 1.4.
    expect(isValidAmortizationAmount('1.5')).toBe(true);
  });
});

describe('hasInvalidFields (characterization)', () => {
  it('is false for the initial state', () => {
    expect(hasInvalidFields(initialState())).toBe(false);
  });

  it('sees invalid form fields and invalid amortization amounts', () => {
    const invalidField = initialState();
    invalidField.invalid.capital = true;
    expect(hasInvalidFields(invalidField)).toBe(true);

    const badAmount = initialState();
    badAmount.amortizations = [
      { id: 1, year: 1, month: 1, amount: 'abc', type: 'term', invalidAmount: true },
    ];
    expect(hasInvalidFields(badAmount)).toBe(true);
  });

  it('gates euribor drafts by type, by term and by validity', () => {
    const variable = initialState(); // type 'variable', 25 years
    variable.euriborDrafts = { 0: 'nope' };
    expect(hasInvalidFields(variable)).toBe(true);

    // the same draft is ignored under a fixed type
    const fixed = { ...variable, fields: { ...variable.fields, type: 'fixed' } };
    expect(hasInvalidFields(fixed)).toBe(false);

    // drafts beyond the term don't count (month index 600 = loan year 50)
    const beyond = initialState();
    beyond.euriborDrafts = { 600: 'nope' };
    expect(hasInvalidFields(beyond)).toBe(false);

    // a valid draft within the term is not invalid
    const validDraft = initialState();
    validDraft.euriborDrafts = { 0: '5.4' };
    expect(hasInvalidFields(validDraft)).toBe(false);
  });
});

describe('hasInvalidFields — hidden fields do not block (Fase 1.1)', () => {
  it('ignores the invalid flag of a field hidden by the current type', () => {
    const state = initialState();
    state.invalid.fixedInterest = true;
    expect(state.fields.type).toBe('variable');
    expect(hasInvalidFields(state)).toBe(false); // "Interés fijo" is not rendered

    state.fields.type = 'fixed';
    expect(hasInvalidFields(state)).toBe(true); // visible again → blocks
  });

  it('ignores invalid variable-only fields under a fixed type', () => {
    const state = initialState();
    state.fields.type = 'fixed';
    state.invalid.euriborSpread = true;
    state.invalid.initialFixedInterest = true;
    state.invalid.initialPeriodMonths = true;
    expect(hasInvalidFields(state)).toBe(false);
  });
});

describe('formatWarning (characterization)', () => {
  it('formats the out-of-term warning in Spanish', () => {
    expect(
      formatWarning({ type: 'amortization-out-of-term', year: 20, month: 1, amount: 5000, termYears: 15 })
    ).toBe(
      'Aviso: la amortización de 5000 € del año 20, mes 1, está fuera del plazo de 15 años y no se ha tenido en cuenta.'
    );
  });

  it('formats the exceeds-balance warning with the balance to 2 decimals', () => {
    expect(
      formatWarning({ type: 'amortization-exceeds-balance', year: 1, month: 2, amount: 150000, balance: 99234.561 })
    ).toBe(
      'Aviso: la amortización de 150000 € del año 1, mes 2, supera el saldo pendiente (99234.56 €): el préstamo termina en ese mes.'
    );
  });

  it('returns an empty string for unknown warnings', () => {
    expect(formatWarning({ type: 'something-else' })).toBe('');
  });
});

describe('reducer — field/changed (characterization)', () => {
  it('updates the field and its invalid flag', () => {
    let state = reducer(initialState(), { type: 'field/changed', name: 'capital', value: 'abc' });
    expect(state.fields.capital).toBe('abc');
    expect(state.invalid.capital).toBe(true);

    state = reducer(state, { type: 'field/changed', name: 'capital', value: '200000' });
    expect(state.fields.capital).toBe('200000');
    expect(state.invalid.capital).toBe(false);
  });

  it('clears any previous result: no stale tables', () => {
    let state = reducer(initialState(), { type: 'calculated' });
    expect(state.result).not.toBeNull();

    state = reducer(state, { type: 'field/changed', name: 'capital', value: '200000' });
    expect(state.result).toBeNull();
    expect(state.calcWarning).toBeNull();
  });

  it('keeps termYears and startYear as last-valid caches', () => {
    let state = reducer(initialState(), { type: 'field/changed', name: 'years', value: '12.9' });
    expect(state.termYears).toBe(12); // trunc of the valid float

    state = reducer(state, { type: 'field/changed', name: 'years', value: 'abc' });
    expect(state.termYears).toBe(12); // invalid input keeps the cache

    state = reducer(state, { type: 'field/changed', name: 'startYear', value: '2030' });
    expect(state.startYear).toBe(2030);

    state = reducer(state, { type: 'field/changed', name: 'startYear', value: 'junk' });
    expect(state.startYear).toBe(2030); // invalid input keeps the cache
  });

  it('drops euribor drafts only when switching to fixed', () => {
    let state = initialState();
    state.euriborDrafts = { 0: '2.25' };
    state = reducer(state, { type: 'field/changed', name: 'type', value: 'fixed' });
    expect(state.euriborDrafts).toEqual({});

    let kept = initialState();
    kept.euriborDrafts = { 0: '2.25' };
    kept = reducer(kept, { type: 'field/changed', name: 'euriborSpread', value: '2' });
    expect(kept.euriborDrafts).toEqual({ 0: '2.25' });
  });
});

describe('reducer — euribor actions (characterization)', () => {
  it('euribor/changed stores the number override, clears the draft and clears the result', () => {
    let state = initialState();
    state.euriborDrafts = { 0: '5' };
    state = reducer(state, { type: 'euribor/changed', index: 0, value: 5 });
    expect(state.euriborOverrides[0]).toBe(5);
    expect(state.euriborDrafts).toEqual({});
    expect(state.result).toBeNull();
  });

  it('euribor/inputChanged keeps the draft and only commits valid values to the override', () => {
    let state = reducer(initialState(), { type: 'euribor/inputChanged', index: 0, value: '5.4' });
    expect(state.euriborDrafts[0]).toBe('5.4');
    expect(state.euriborOverrides[0]).toBe(5.4);

    state = reducer(state, { type: 'euribor/inputChanged', index: 0, value: '2.25' });
    expect(state.euriborDrafts[0]).toBe('2.25');
    expect(state.euriborOverrides[0]).toBe(5.4); // off-step value: override untouched
  });

  it('euribor/inputCommitted clears a valid draft and keeps an invalid one visible', () => {
    let state = reducer(initialState(), { type: 'euribor/inputChanged', index: 0, value: '5.4' });
    state = reducer(state, { type: 'euribor/inputCommitted', index: 0 });
    expect(state.euriborDrafts).toEqual({});
    expect(state.euriborOverrides[0]).toBe(5.4);

    state = reducer(state, { type: 'euribor/inputChanged', index: 0, value: '2.25' });
    state = reducer(state, { type: 'euribor/inputCommitted', index: 0 });
    expect(state.euriborDrafts[0]).toBe('2.25'); // stays so the error stays visible
  });

  it('euribor/toggled flips the panel without clearing the result', () => {
    let state = reducer(initialState(), { type: 'calculated' });
    const result = state.result;

    state = reducer(state, { type: 'euribor/toggled' });
    expect(state.euriborOpen).toBe(true);
    expect(state.result).toBe(result);
  });
});

describe('reducer — amortization actions (characterization)', () => {
  it('amortization/added appends a default row and bumps the id counter', () => {
    let state = reducer(initialState(), { type: 'amortization/added' });
    expect(state.amortizations).toEqual([
      { id: 1, year: 1, month: 1, amount: '1000', type: 'term', invalidAmount: false },
    ]);
    expect(state.nextAmortizationId).toBe(2);
    expect(state.result).toBeNull();

    state = reducer(state, { type: 'amortization/added' });
    expect(state.amortizations[1].id).toBe(2);
  });

  it('amortization/updated patches fields and revalidates the amount', () => {
    let state = reducer(initialState(), { type: 'amortization/added' });

    state = reducer(state, { type: 'amortization/updated', id: 1, patch: { year: 3, month: 6 } });
    expect(state.amortizations[0].year).toBe(3);
    expect(state.amortizations[0].month).toBe(6);

    state = reducer(state, { type: 'amortization/updated', id: 1, patch: { amount: 'abc' } });
    expect(state.amortizations[0].invalidAmount).toBe(true);
    expect(state.result).toBeNull();

    state = reducer(state, { type: 'amortization/updated', id: 1, patch: { amount: '750' } });
    expect(state.amortizations[0].amount).toBe('750');
    expect(state.amortizations[0].invalidAmount).toBe(false);
  });

  it('amortization/removed deletes only the matching id', () => {
    let state = reducer(initialState(), { type: 'amortization/added' });
    state = reducer(state, { type: 'amortization/added' });
    state = reducer(state, { type: 'amortization/removed', id: 1 });
    expect(state.amortizations.map((amortization) => amortization.id)).toEqual([2]);
  });
});

describe('reducer — calculated and scenario actions (characterization)', () => {
  it('calculated stores the simulation result for the defaults', () => {
    const state = reducer(initialState(), { type: 'calculated' });
    expect(state.calcWarning).toBeNull();
    expect(state.result.rows.length).toBeGreaterThan(0);
    expect(state.result.initialPayment).toBeGreaterThan(0);
    expect(typeof state.result.totalInterest).toBe('number');
  });

  it('calculated with invalid fields blocks the result with the warning', () => {
    const state = initialState();
    state.invalid.capital = true;

    const next = reducer(state, { type: 'calculated' });
    expect(next.result).toBeNull();
    expect(next.calcWarning).toBe(INVALID_FIELDS_WARNING);
  });

  it('scenario/loaded applies numbers, dates and amortizations, and clears drafts', () => {
    const state = initialState();
    state.euriborDrafts = { 0: '2.25' };

    const next = reducer(state, {
      type: 'scenario/loaded',
      scenario: {
        capital: 99999,
        years: 10,
        type: 'fixed',
        startDate: '2023-06-01',
        fixedInterest: 3.1,
        amortizations: [
          { year: 2, month: 15, amount: 4000, type: 'payment' }, // month clamped to 12
          { year: 0, month: 1, amount: 500, type: 'term' }, // implausible year clamped to 1
          { year: 3, month: 1, type: 'term' }, // missing amount → default
          'junk', // not an object: skipped
        ],
      },
    });

    expect(next.fields.capital).toBe('99999');
    expect(next.fields.years).toBe('10');
    expect(next.fields.type).toBe('fixed');
    expect(next.fields.fixedInterest).toBe('3.1');
    expect(next.termYears).toBe(10);
    expect(next.startYear).toBe(2023);
    expect(next.euriborDrafts).toEqual({});
    expect(next.result).toBeNull();
    expect(next.amortizations).toEqual([
      { id: 1, year: 2, month: 12, amount: '4000', type: 'payment', invalidAmount: false },
      { id: 2, year: 1, month: 1, amount: '500', type: 'term', invalidAmount: false },
      { id: 3, year: 3, month: 1, amount: '1000', type: 'term', invalidAmount: false },
    ]);
  });

  it('scenario/loaded ignores wrong-typed fields and invalid startDates', () => {
    const state = initialState();
    const next = reducer(state, {
      type: 'scenario/loaded',
      scenario: {
        capital: '99999', // string: ignored, the default stays
        years: '10', // string: ignored, the default stays
        startDate: 'not-a-date', // unparseable: startYear untouched
      },
    });
    expect(next.fields.capital).toBe('150000');
    expect(next.fields.years).toBe('25');
    expect(next.startYear).toBe(state.startYear);
  });

  it('scenario/failed shows the fallback warning and keeps the defaults', () => {
    const state = reducer(initialState(), { type: 'scenario/failed' });
    expect(state.scenarioWarning).toContain('escenario.json');
    expect(state.fields.capital).toBe('150000');
  });

  it('ignores unknown actions', () => {
    const state = initialState();
    expect(reducer(state, { type: 'nope' })).toBe(state);
  });
});
