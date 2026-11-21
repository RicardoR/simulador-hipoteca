/**
 * The DATOS box: capital, term, start year, type and the interest fields.
 * All values live in the reducer (`state.fields`) as strings, exactly like the
 * old DOM inputs did; validation marks the field red and blocks CALCULAR.
 */
export default function FormularioDatos({ state, dispatch }) {
  const change = (name) => (event) =>
    dispatch({ type: 'field/changed', name, value: event.target.value });

  const inputProps = (name, width) => ({
    value: state.fields[name],
    onChange: change(name),
    style: {
      ...(width ? { width } : {}),
      ...(state.invalid[name] ? { backgroundColor: '#dd8585' } : {}),
    },
  });

  return (
    <div className="mainbox">
      <div className="title">DATOS</div>
      <div>
        <span>Capital:</span>
        <input id="capital" size="7" {...inputProps('capital')} />€
      </div>
      <div>
        <span>Plazo:</span>
        <input id="yearsField" size="2" {...inputProps('years')} />años
      </div>
      <div>
        <span>Inicio:</span>
        <input id="startYearField" size="4" {...inputProps('startYear')} />
      </div>
      <div>
        <span>Tipo:</span>
        <select id="typeField" value={state.fields.type} onChange={change('type')}>
          <option value="variable">Variable</option>
          <option value="fixed">Fijo</option>
        </select>
      </div>

      {state.fields.type === 'variable' ? (
        <div className="variable">
          <div>
            <span>Interés:</span>
            <label>EURIBOR</label> +{' '}
            <input id="variableInterestField" {...inputProps('euriborSpread', 40)} />%
          </div>
          <div className="inicial">
            <div>
              <label>
                {' '}
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
                Periodo inicial fijo{' '}
              </label>
            </div>
            <div>
              <input id="initialVariableInterestField" {...inputProps('initialFixedInterest', 45)} />
              <label className="low">% durante</label>{' '}
              <input id="fixedMonthsField" {...inputProps('initialPeriodMonths', 40)} />
              <label className="low">meses</label>
            </div>
          </div>
        </div>
      ) : (
        <div className="fijo">
          <div>
            <span>Interés:</span>
            <input id="fixedInterestField" {...inputProps('fixedInterest', 50)} />%
          </div>
        </div>
      )}
    </div>
  );
}
