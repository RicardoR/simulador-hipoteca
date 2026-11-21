import { useEffect, useReducer } from 'react';
import { formatWarning, initialState, reducer } from './state.js';
import FormularioDatos from './components/FormularioDatos.jsx';
import Amortizaciones from './components/Amortizaciones.jsx';
import EuriborEvolucion from './components/EuriborEvolucion.jsx';
import ResultadoTabla from './components/ResultadoTabla.jsx';

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
        <p className="desc">
          Calcula la cuota, compara escenarios y observa cómo las amortizaciones parciales cambian
          el plazo, la deuda y los intereses.
        </p>
      </header>

      <div className="workspace">
        <FormularioDatos state={state} dispatch={dispatch} />
        <div className="amort-workspace">
          <Amortizaciones state={state} dispatch={dispatch} />
          <div className="button">
            <a
              id="calcular"
              className="calculate-action"
              onClick={() => dispatch({ type: 'calculated' })}
              role="button"
              tabIndex={0}
              onKeyDownCapture={(event) => {
                if (event.key === ' ') event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') dispatch({ type: 'calculated' });
              }}
              onKeyUp={(event) => {
                if (event.key === ' ') dispatch({ type: 'calculated' });
              }}
            >
              Calcular
            </a>
          </div>
        </div>
        <EuriborEvolucion state={state} dispatch={dispatch} />
      </div>

      {warnings.length > 0 && (
        <div className="warnings" id="warningsContainer" role="alert">
          {warnings.map((text, index) => (
            <div key={index}>{text}</div>
          ))}
        </div>
      )}

      {state.result && <ResultadoTabla result={state.result} startYear={state.startYear} />}
    </main>
  );
}
