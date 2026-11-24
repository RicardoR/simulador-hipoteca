/**
 * Single source of truth for the React frontend: one reducer owns the form,
 * euribor overrides and editing drafts, and amortizations. The last valid
 * Euribor value drives both controls and the calculation (bug #3); amortizations
 * can never overwrite each other (bug #2).
 *
 * `src/lib/simulation.js` is imported for its side effect only (it exposes
 * `globalThis.calculateSimulation`) and is the stable boundary between the old
 * jQuery code and React. Changes are owner-approved but tests-first:
 * characterization tests pin the current behavior, then the fix lands
 * (`plan/fix-and-polish.md`). Covered by `test/state.test.js` and
 * `test/simulation.test.js`.
 */
import './lib/simulation.js';

const calculateSimulation = globalThis.calculateSimulation;

/**
 * Default euribor series, one value per loan year: 51 entries for the
 * 50-year max term (only indexes 0..49 are read; the extra entry is inert).
 */
export const EURIBOR_SERIES = [
  2.2, 2.1, 2, 2.3, 2.4, 2.3, 2.2, 2.4, 3.1, 3.9, 4.5, 5, 5.1,
  4.7, 4.6, 4.1, 3.9, 3.5, 3, 2.4, 2.2, 2.6, 3, 3.3, 3.5, 3.6, 3.8,
  3.7, 3.8, 3.8, 3.9, 4.1, 4, 4.1, 4.1, 4.3, 4.3, 4.2, 4.3, 4.4, 4.5,
  4.2, 4.3, 4.4, 4.1, 4.3, 4.5, 4.4, 4.1, 4, 3.7,
];

export const EURIBOR_MIN = -0.5;
export const EURIBOR_MAX = 15;
export const EURIBOR_STEP = 0.1;

export const SCENARIO_WARNING =
  'Aviso: no se pudo cargar escenario.json; se están usando los valores por defecto.';

export const INVALID_FIELDS_WARNING =
  'Aviso: hay campos con valores no válidos; revísalos en rojo antes de calcular.';

/** Default amount for a newly added amortization row. */
const DEFAULT_AMORTIZATION = { amount: '1000' };

/** HTML defaults — the same the static page had before the scenario loads. */
const DEFAULT_FIELDS = {
  capital: '150000',
  years: '25',
  startYear: String(new Date().getFullYear()),
  type: 'variable',
  fixedInterest: '2.25',
  euriborSpread: '1.5',
  initialFixedInterest: '1.25',
  initialPeriodMonths: '12',
  initialPeriodActive: false,
};

/**
 * Field validation, ported from the old `check()` helpers:
 * 'int' strips separators and requires a whole number, 'number' allows a
 * decimal comma. Empty strings are invalid here (they used to slip through
 * and reach the calculation as NaN).
 */
const FIELD_RULES = {
  capital: { kind: 'int', min: 0 },
  // Owner decision 1 (Fase 1.4): the term is integer-only too, like every
  // other amount field — '12.5' years would truncate to 12 while shown.
  years: { kind: 'int', min: 1, max: 50 },
  startYear: { kind: 'int', min: 1900, max: 2200 },
  fixedInterest: { kind: 'number', min: 0 },
  euriborSpread: { kind: 'number', min: 0 },
  initialFixedInterest: { kind: 'number', min: 0 },
  initialPeriodMonths: { kind: 'int', min: 0 },
};

export function parseIntField(value) {
  // Strict digits (owner decision 1, Fase 1.4 of plan/fix-and-polish.md):
  // no separator stripping — '1.5' must never become 15 in a capital field.
  // Edge whitespace is trimmed; dots, commas or inner spaces are invalid.
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return NaN;
  return parseInt(trimmed, 10);
}

export function parseFloatField(value) {
  // Fase 1.3 of plan/fix-and-polish.md: trim first — Number('   ') === 0 used
  // to let a blank field through as 0% interest.
  const normalized = String(value).trim().replace(',', '.');
  if (normalized === '') return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function isValidField(name, value) {
  const rule = FIELD_RULES[name];
  if (!rule) return true;
  const parsed = rule.kind === 'int' ? parseIntField(value) : parseFloatField(value);
  if (!Number.isFinite(parsed)) return false;
  if (rule.min !== undefined && parsed < rule.min) return false;
  if (rule.max !== undefined && parsed > rule.max) return false;
  return true;
}

/**
 * Cross-field rule (Fase 1.2 of plan/fix-and-polish.md): the initial fixed
 * period must be strictly shorter than the whole term, or no annual review
 * would ever happen — the interest would stay fixed for the whole loan and
 * the euribor overrides would be silently ignored.
 */
export function isValidInitialPeriod(value, termYears) {
  const parsed = parseIntField(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < termYears * 12;
}

export function isValidAmortizationAmount(value) {
  return Number.isFinite(parseIntField(value)) && parseIntField(value) >= 0;
}

export function isValidEuriborValue(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < EURIBOR_MIN || parsed > EURIBOR_MAX) return false;
  const stepPosition = (parsed - EURIBOR_MIN) / EURIBOR_STEP;
  return Math.abs(stepPosition - Math.round(stepPosition)) < 1e-8;
}

export function initialState() {
  const invalid = {};
  Object.keys(FIELD_RULES).forEach((name) => {
    invalid[name] = !isValidField(name, DEFAULT_FIELDS[name]);
  });
  return {
    fields: { ...DEFAULT_FIELDS },
    invalid,
    // Last valid numeric caches: the sliders/options derive from these so a
    // half-typed field does not collapse the layout (the old page kept the
    // last rebuild for the same reason).
    termYears: parseInt(DEFAULT_FIELDS.years, 10),
    startYear: parseInt(DEFAULT_FIELDS.startYear, 10),
    euriborOverrides: {},
    euriborDrafts: {},
    euriborOpen: false,
    amortizations: [],
    nextAmortizationId: 1,
    scenarioWarning: null,
    calcWarning: null,
    result: null,
  };
}

function applyScenario(state, scenario) {
  const fields = { ...state.fields };
  const invalid = { ...state.invalid };
  let termYears = state.termYears;
  let startYear = state.startYear;

  const setField = (name, value) => {
    fields[name] = value;
    invalid[name] = !isValidField(name, value);
  };

  if (typeof scenario.capital === 'number') setField('capital', String(scenario.capital));
  if (typeof scenario.years === 'number') {
    setField('years', String(scenario.years));
    if (!invalid.years) termYears = Math.trunc(parseFloatField(scenario.years));
  }
  if (typeof scenario.startDate === 'string') {
    const startDate = new Date(scenario.startDate);
    if (!isNaN(startDate.getTime())) {
      setField('startYear', String(startDate.getFullYear()));
      startYear = startDate.getFullYear();
    }
  }
  if (scenario.type === 'fixed' || scenario.type === 'variable') {
    setField('type', scenario.type);
  }
  if (typeof scenario.euriborSpread === 'number') setField('euriborSpread', String(scenario.euriborSpread));
  if (typeof scenario.initialFixedInterest === 'number') {
    setField('initialFixedInterest', String(scenario.initialFixedInterest));
  }
  if (typeof scenario.fixedInterest === 'number') setField('fixedInterest', String(scenario.fixedInterest));
  if (typeof scenario.initialPeriodMonths === 'number') {
    setField('initialPeriodMonths', String(scenario.initialPeriodMonths));
  }
  if (typeof scenario.initialPeriodActive === 'boolean') {
    setField('initialPeriodActive', scenario.initialPeriodActive);
  }

  // Cross-field rule (Fase 1.2): an out-of-range initial period loads marked
  // so the user sees it in red before the first calculation.
  invalid.initialPeriodMonths = !isValidInitialPeriod(fields.initialPeriodMonths, termYears);

  const amortizations = [];
  let nextId = state.nextAmortizationId;
  if (Array.isArray(scenario.amortizations)) {
    scenario.amortizations.forEach((amortization) => {
      if (!amortization || typeof amortization !== 'object') return;
      const year = Number(amortization.year);
      const amount =
        typeof amortization.amount === 'number' ? String(amortization.amount) : DEFAULT_AMORTIZATION.amount;
      amortizations.push({
        id: nextId++,
        // The year is stored as given when it is a plausible year: if it falls
        // outside the term the select still shows it (with the term's options
        // around it) and the simulation reports it as out of term instead of
        // silently clamping (bug #7).
        year: Number.isFinite(year) && year >= 1 ? Math.trunc(year) : 1,
        month: Math.min(Math.max(Number(amortization.month) || 1, 1), 12),
        amount,
        type: amortization.type === 'payment' ? 'payment' : 'term',
        // Decision 1 (Fase 1.4): a non-integer scenario amount is marked
        // instead of reaching the calculation unparsed.
        invalidAmount: !isValidAmortizationAmount(amount),
      });
    });
  }

  return {
    ...state,
    fields,
    invalid,
    termYears,
    startYear,
    euriborDrafts: {},
    amortizations,
    nextAmortizationId: nextId,
    result: null,
    calcWarning: null,
  };
}

/** Sparse euribor array for the simulation: one entry per loan year. */
function buildEuriborInput(state) {
  const euribor = [];
  for (let i = 0; i < state.termYears; i++) {
    const index = i * 12;
    const override = state.euriborOverrides[index];
    euribor[index] = typeof override === 'number' ? override : EURIBOR_SERIES[i] ?? 0;
  }
  return euribor;
}

function buildSimulationInput(state) {
  return {
    capital: parseIntField(state.fields.capital),
    years: state.termYears,
    type: state.fields.type,
    fixedInterest: parseFloatField(state.fields.fixedInterest),
    euriborSpread: parseFloatField(state.fields.euriborSpread),
    initialFixedInterest: parseFloatField(state.fields.initialFixedInterest),
    initialPeriodMonths: parseIntField(state.fields.initialPeriodMonths),
    initialPeriodActive: state.fields.initialPeriodActive,
    euribor: buildEuriborInput(state),
    amortizations: state.amortizations.map((amortization) => ({
      year: amortization.year,
      month: amortization.month,
      amount: parseIntField(amortization.amount),
      type: amortization.type,
    })),
  };
}

/** Fields rendered only for one mortgage type; the rest are always visible. */
const ALWAYS_VISIBLE_FIELDS = ['capital', 'years', 'startYear'];
const TYPE_ONLY_FIELDS = {
  variable: ['euriborSpread', 'initialFixedInterest', 'initialPeriodMonths'],
  fixed: ['fixedInterest'],
};

export function hasInvalidFields(state) {
  // Only the fields rendered for the current type can block the calculation
  // (Fase 1.1 of plan/fix-and-polish.md): a hidden field cannot show its red
  // state, so it must not block silently either. The flags stay untouched, so
  // a field that reappears after switching the type is red again immediately.
  // Symmetric with the euribor drafts gate below, and it also covers a
  // scenario that switches the type with garbage left in the hidden fields.
  const visibleFields = [...ALWAYS_VISIBLE_FIELDS, ...(TYPE_ONLY_FIELDS[state.fields.type] || [])];
  if (visibleFields.some((name) => state.invalid[name])) return true;
  if (state.amortizations.some((amortization) => amortization.invalidAmount)) return true;
  if (state.fields.type !== 'variable') return false;
  return Object.entries(state.euriborDrafts).some(
    ([index, value]) =>
      Math.floor(Number(index) / 12) < state.termYears && !isValidEuriborValue(value)
  );
}

/** Every data change invalidates the last result: no stale tables. */
function withFreshResult(state) {
  return { ...state, result: null, calcWarning: null };
}

/** Spanish texts for the warnings emitted by `calculateSimulation`. */
export function formatWarning(warning) {
  if (warning.type === 'amortization-out-of-term') {
    return `Aviso: la amortización de ${warning.amount} € del año ${warning.year}, mes ${warning.month}, está fuera del plazo de ${warning.termYears} años y no se ha tenido en cuenta.`;
  }
  if (warning.type === 'amortization-exceeds-balance') {
    return `Aviso: la amortización de ${warning.amount} € del año ${warning.year}, mes ${warning.month}, supera el saldo pendiente (${warning.balance.toFixed(2)} €): el préstamo termina en ese mes.`;
  }
  return '';
}

export function reducer(state, action) {
  switch (action.type) {
    case 'scenario/loaded':
      return applyScenario(state, action.scenario);

    case 'scenario/failed':
      return { ...state, scenarioWarning: SCENARIO_WARNING };

    case 'field/changed': {
      const { name, value } = action;
      const fields = { ...state.fields, [name]: value };
      const invalid = { ...state.invalid, [name]: !isValidField(name, value) };
      const euriborDrafts = name === 'type' && value === 'fixed' ? {} : state.euriborDrafts;

      // Cross-field rule (Fase 1.2): the initial period is re-checked against
      // the term when either of the two changes.
      if (name === 'initialPeriodMonths' || name === 'years') {
        const termYears =
          name === 'years' && !invalid.years ? Math.trunc(parseFloatField(value)) : state.termYears;
        invalid.initialPeriodMonths = !isValidInitialPeriod(fields.initialPeriodMonths, termYears);
      }

      const next = withFreshResult({ ...state, fields, invalid, euriborDrafts });
      if (name === 'years' && !invalid.years) {
        next.termYears = Math.trunc(parseFloatField(value));
      }
      if (name === 'startYear' && !invalid.startYear) {
        next.startYear = parseIntField(value);
      }
      return next;
    }

    case 'euribor/changed': {
      const euriborDrafts = { ...state.euriborDrafts };
      delete euriborDrafts[action.index];
      return withFreshResult({
        ...state,
        euriborOverrides: { ...state.euriborOverrides, [action.index]: action.value },
        euriborDrafts,
      });
    }

    case 'euribor/inputChanged': {
      const euriborDrafts = { ...state.euriborDrafts, [action.index]: action.value };
      const euriborOverrides = isValidEuriborValue(action.value)
        ? { ...state.euriborOverrides, [action.index]: Number(action.value) }
        : state.euriborOverrides;
      return withFreshResult({ ...state, euriborDrafts, euriborOverrides });
    }

    case 'euribor/inputCommitted': {
      if (!isValidEuriborValue(state.euriborDrafts[action.index])) return state;
      const euriborDrafts = { ...state.euriborDrafts };
      delete euriborDrafts[action.index];
      return { ...state, euriborDrafts };
    }

    case 'euribor/toggled':
      return { ...state, euriborOpen: !state.euriborOpen };

    case 'amortization/added': {
      const id = state.nextAmortizationId;
      return withFreshResult({
        ...state,
        nextAmortizationId: id + 1,
        amortizations: [
          ...state.amortizations,
          { id, year: 1, month: 1, amount: DEFAULT_AMORTIZATION.amount, type: 'term', invalidAmount: false },
        ],
      });
    }

    case 'amortization/updated': {
      const amortizations = state.amortizations.map((amortization) => {
        if (amortization.id !== action.id) return amortization;
        const updated = { ...amortization, ...action.patch };
        if ('amount' in action.patch) updated.invalidAmount = !isValidAmortizationAmount(action.patch.amount);
        return updated;
      });
      return withFreshResult({ ...state, amortizations });
    }

    case 'amortization/removed':
      return withFreshResult({
        ...state,
        amortizations: state.amortizations.filter((amortization) => amortization.id !== action.id),
      });

    case 'calculated': {
      if (hasInvalidFields(state)) {
        return { ...state, result: null, calcWarning: INVALID_FIELDS_WARNING };
      }
      return {
        ...state,
        result: calculateSimulation(buildSimulationInput(state)),
        calcWarning: null,
      };
    }

    default:
      return state;
  }
}
