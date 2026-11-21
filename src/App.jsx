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
    <div className="wrapper">
      <div className="top">
        <h1>Simulador de hipoteca de Roberto</h1>
        <div className="desc">
          <p>Herramienta de simulación de hipotecas que te permite calcular de manera precisa y fácil las amortizaciones parciales de tu préstamo hipotecario. </p>
          <p>Podrás visualizar cómo afecta el pago de amortizaciones parciales a la reducción de tu deuda hipotecaria y a la disminución de tus intereses. </p>
          <p>Además, podrás comparar diferentes escenarios de pago para tomar decisiones informadas sobre tu hipoteca. </p>
          <p>¡Calcula tu préstamo hipotecario con nuestro simulador y toma el control de tus finanzas!</p>
        </div>
      </div>

      <FormularioDatos state={state} dispatch={dispatch} />
      <Amortizaciones state={state} dispatch={dispatch} />
      <EuriborEvolucion state={state} dispatch={dispatch} />

      <div className="button">
        <a
          id="calcular"
          onClick={() => dispatch({ type: 'calculated' })}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') dispatch({ type: 'calculated' });
          }}
        >
          CALCULAR
        </a>
      </div>

      {warnings.length > 0 && (
        <div className="warnings" id="warningsContainer">
          {warnings.map((text, index) => (
            <div key={index}>{text}</div>
          ))}
        </div>
      )}

      {state.result && <ResultadoTabla result={state.result} startYear={state.startYear} />}
    </div>
  );
}
