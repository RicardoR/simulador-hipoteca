/**
 * The mortgage form: capital, term, start year, type and interest fields.
 * All values live in the reducer (`state.fields`) as strings, exactly like the
 * old DOM inputs did; validation marks the field red and blocks calculation.
 */
import { inputClass, inputErrorProps } from '../lib/inputErrorProps.js';

export default function MortgageForm({ state, dispatch }) {
  const change = (name) => (event) =>
    dispatch({ type: 'field/changed', name, value: event.target.value });

  const inputProps = (name, size = '') => ({
    value: state.fields[name],
    onChange: change(name),
    ...inputErrorProps(state.invalid[name], `${name}-error`),
    className: inputClass('field-input', state.invalid[name], size),
  });

  /** Hidden but announced description for invalid fields (Fase 4.3). */
  const errorHint = (name) =>
    state.invalid[name] ? (
      <span className="visually-hidden" id={`${name}-error`}>
        Valor no válido: revísalo.
      </span>
    ) : null;

  return (
    <div className="mortgage-form">
      <h2 className="title">Datos de la hipoteca</h2>
      <div className="form-field">
        <label htmlFor="capital">Capital</label>
        <div className="field-control">
          <input id="capital" size="7" {...inputProps('capital')} />
          <span>€</span>
        </div>
        {errorHint('capital')}
      </div>
      <div className="form-field">
        <label htmlFor="yearsField">Plazo</label>
        <div className="field-control">
          <input id="yearsField" size="2" {...inputProps('years')} />
          <span>años</span>
        </div>
        {errorHint('years')}
      </div>
      <div className="form-field">
        <label htmlFor="startYearField">Inicio</label>
        <input id="startYearField" size="4" {...inputProps('startYear')} />
        {errorHint('startYear')}
      </div>
      <div className="form-field">
        <label htmlFor="typeField">Tipo</label>
        <div className="select-wrap">
          <select
            id="typeField"
            className="field-input select-input"
            value={state.fields.type}
            onChange={change('type')}
          >
            <option value="variable">Variable</option>
            <option value="fixed">Fijo</option>
          </select>
        </div>
      </div>

      {state.fields.type === 'variable' ? (
        <div className="variable-rate-fields">
          <div className="form-field">
            <label htmlFor="variableInterestField">Interés</label>
            <div className="field-control">
              <span>EURIBOR +</span>
              <input
                id="variableInterestField"
                {...inputProps('euriborSpread', 'field-input--short')}
              />
              <span>%</span>
            </div>
            {errorHint('euriborSpread')}
          </div>
          <fieldset className="initial-period-options">
            <legend className="visually-hidden">Opciones del periodo inicial</legend>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={state.fields.initialPeriodActive}
                onChange={(event) =>
                  dispatch({
                    type: 'field/changed',
                    name: 'initialPeriodActive',
                    value: event.target.checked,
                  })
                }
              />{' '}
              <span>Periodo inicial fijo</span>
            </label>
            <div className="initial-controls">
              <label htmlFor="initialVariableInterestField">Interés fijo</label>
              <div className="field-control">
                <input
                  id="initialVariableInterestField"
                  {...inputProps('initialFixedInterest', 'field-input--short')}
                />
                <span>%</span>
              </div>
              {errorHint('initialFixedInterest')}
              <label htmlFor="fixedMonthsField">Duración</label>
              <div className="field-control">
                <input
                  id="fixedMonthsField"
                  {...inputProps('initialPeriodMonths', 'field-input--short')}
                />
                <span>meses</span>
              </div>
              {errorHint('initialPeriodMonths')}
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="fixed-rate-fields">
          <div className="form-field">
            <label htmlFor="fixedInterestField">Interés</label>
            <div className="field-control">
              <input
                id="fixedInterestField"
                {...inputProps('fixedInterest', 'field-input--short')}
              />
              <span>%</span>
            </div>
            {errorHint('fixedInterest')}
          </div>
        </div>
      )}
    </div>
  );
}
