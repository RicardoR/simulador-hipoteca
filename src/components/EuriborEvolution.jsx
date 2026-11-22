import {
  EURIBOR_MAX,
  EURIBOR_MIN,
  EURIBOR_SERIES,
  EURIBOR_STEP,
  isValidEuriborValue,
} from '../state.js';

/**
 * Euribor evolution: a range and number input per loan year. The last valid
 * override (or the default series) drives the slider and calculation; raw
 * drafts let the user edit decimals without diverging from that value (bug #3).
 */
export default function EuriborEvolution({ state, dispatch }) {
  const sliders = [];
  for (let yearIndex = 0; yearIndex < state.termYears; yearIndex++) {
    const index = yearIndex * 12;
    const override = state.euriborOverrides[index];
    const value = typeof override === 'number' ? override : (EURIBOR_SERIES[yearIndex] ?? 0);
    const draft = state.euriborDrafts[index];
    const year = state.startYear + yearIndex;
    const inputInvalid = typeof draft === 'string' && !isValidEuriborValue(draft);
    sliders.push(
      <div data-year={year} key={index}>
        <span className="year">{year}</span>
        <input
          id={`euribor-slider-${index}`}
          aria-label={`Euríbor ${state.startYear + yearIndex}`}
          type="range"
          min={EURIBOR_MIN}
          max={EURIBOR_MAX}
          step={EURIBOR_STEP}
          value={value}
          onChange={(event) =>
            dispatch({ type: 'euribor/changed', index, value: parseFloat(event.target.value) })
          }
        />
        <label className="euribor-value-field">
          <span className="visually-hidden">Valor del Euríbor {year}</span>
          <input
            id={`euribor-value-${index}`}
            className="euribor-value"
            type="number"
            min={EURIBOR_MIN}
            max={EURIBOR_MAX}
            step={EURIBOR_STEP}
            inputMode="decimal"
            value={typeof draft === 'string' ? draft : value.toFixed(2)}
            aria-invalid={inputInvalid || undefined}
            aria-describedby={inputInvalid ? `euribor-error-${index}` : undefined}
            onChange={(event) =>
              dispatch({
                type: 'euribor/inputChanged',
                index,
                value: event.target.value,
              })
            }
            onBlur={() => dispatch({ type: 'euribor/inputCommitted', index })}
          />
        </label>
        {inputInvalid && (
          <span className="euribor-error" id={`euribor-error-${index}`}>
            Usa valores entre -0,5 y 15, en pasos de 0,1.
          </span>
        )}
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
