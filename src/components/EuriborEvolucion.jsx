import { EURIBOR_SERIES } from '../state.js';

/**
 * Euribor evolution: one slider per loan year. The stored override (or the
 * default series) is the single source of truth for both the visible value and
 * the calculation, so the slider can no longer show one number and calculate
 * with another (bug #3).
 */
export default function EuriborEvolucion({ state, dispatch }) {
  const sliders = [];
  for (let yearIndex = 0; yearIndex < state.termYears; yearIndex++) {
    const index = yearIndex * 12;
    const override = state.euriborOverrides[index];
    const value = typeof override === 'number' ? override : (EURIBOR_SERIES[yearIndex] ?? 0);
    sliders.push(
      <div data-year={state.startYear + yearIndex} key={index}>
        <span className="year">{state.startYear + yearIndex}</span>
        <input
          aria-label={`Euríbor ${state.startYear + yearIndex}`}
          type="range"
          min="-0.5"
          max="15"
          step="0.1"
          value={value}
          onChange={(event) =>
            dispatch({ type: 'euribor/changed', index, value: parseFloat(event.target.value) })
          }
        />
        <span className="val">{value.toFixed(2)}</span>
      </div>
    );
  }

  return (
    <div className={`euribor${state.euriborOpen ? ' open' : ''}`}>
      <h2 className="title">
        <span className="euribor-title-text">Evolución del Euríbor</span>
        <button
          type="button"
          className="euribor-toggle"
          aria-label={
            state.euriborOpen ? 'Ocultar evolución del Euríbor' : 'Mostrar evolución del Euríbor'
          }
          aria-expanded={state.euriborOpen}
          aria-controls="euribor"
          onClick={() => dispatch({ type: 'euribor/toggled' })}
        >
          Euríbor
          <span className="toggle-mark" aria-hidden="true"></span>
        </button>
      </h2>
      <div id="euribor">{sliders}</div>
    </div>
  );
}
