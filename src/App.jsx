import { useEffect, useReducer } from 'react';
import { formatWarning, hasInvalidFields, initialState, reducer } from './state.js';
import MortgageForm from './components/MortgageForm.jsx';
import Amortizations from './components/Amortizations.jsx';
import EuriborEvolution from './components/EuriborEvolution.jsx';
import ResultsTable from './components/ResultsTable.jsx';

/**
 * Loads /escenario.json (relative path, so it also works under a subpath).
 * Returns the parsed scenario or null; the caller turns null into a warning
 * and keeps the HTML defaults.
 */
function fetchScenario() {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch('escenario.json')
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then((scenario) => {
      if (!scenario || typeof scenario !== 'object') throw new Error('invalid scenario');
      return scenario;
    })
    .catch(() => null);
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    let alive = true;
    fetchScenario().then((scenario) => {
      if (!alive) return;
      dispatch(scenario ? { type: 'scenario/loaded', scenario } : { type: 'scenario/failed' });
    });
    return () => {
      alive = false;
    };
  }, []);

  const warnings = [];
  if (state.scenarioWarning) warnings.push(state.scenarioWarning);
  if (state.calcWarning) warnings.push(state.calcWarning);
  if (state.result) {
    state.result.warnings.forEach((warning) => {
      const text = formatWarning(warning);
      if (text) warnings.push(text);
    });
  }

  return (
    <main className="wrapper">
      <header className="top">
        <h1>Simulador de hipoteca</h1>
        <p className="description">
          Calcula la cuota, compara escenarios y observa cómo las amortizaciones parciales cambian
          el plazo, la deuda y los intereses.
        </p>
      </header>

      <div className="workspace">
        <MortgageForm state={state} dispatch={dispatch} />
        <div className="amortization-workspace">
          <Amortizations state={state} dispatch={dispatch} />
          <div className="calculate-action-wrapper">
            {/* A real button: Enter/Space activation and focus come for free.
            aria-disabled (not disabled) keeps it clickable so the warning
            explains what is wrong; the reducer blocks the calculation anyway
            (Fase 4.1 of plan/fix-and-polish.md). */}
            <button
              id="calculateButton"
              type="button"
              className="calculate-action"
              aria-disabled={hasInvalidFields(state) || undefined}
              onClick={() => dispatch({ type: 'calculated' })}
            >
              Calcular
            </button>
          </div>
        </div>
        <EuriborEvolution state={state} dispatch={dispatch} />
      </div>

      {warnings.length > 0 && (
        <div className="warnings" id="warningsContainer" role="alert">
          {warnings.map((text, index) => (
            <div key={index}>{text}</div>
          ))}
        </div>
      )}

      {state.result && (
        <ResultsTable
          result={state.result}
          startMonth={Number(state.fields.startMonth)}
          startYear={state.startYear}
        />
      )}
    </main>
  );
}
