/**
 * Partial amortizations list. The rows are state, not DOM: adding, editing or
 * removing one invalidates the last result (like the old `mainFunction.changes`)
 * and the year options always follow the current term (bug #7). A year stored
 * outside the term stays visible so the simulation can warn about it.
 */
export default function Amortizaciones({ state, dispatch }) {
  const termYears = state.termYears;

  const update = (id, patch) => dispatch({ type: 'amortization/updated', id, patch });

  const yearOptions = (amortization) => {
    const options = [];
    for (let year = 1; year <= termYears; year++) options.push(year);
    if (amortization.year > termYears) options.push(amortization.year);
    return options;
  };

  return (
    <div className="amort">
      <div className="title">AMORTIZACIONES PARCIALES</div>
      <div id="amort">
        {state.amortizations.map((amortization) => (
          <div className="am" key={amortization.id}>
            Año:
            <select
              className="anyo"
              style={{ width: 42 }}
              value={String(amortization.year)}
              onChange={(event) => update(amortization.id, { year: Number(event.target.value) })}
            >
              {yearOptions(amortization).map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
            <span>Mes:</span>
            <select
              className="mes"
              style={{ width: 42 }}
              value={String(amortization.month)}
              onChange={(event) => update(amortization.id, { month: Number(event.target.value) })}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={String(month)}>
                  {month}
                </option>
              ))}
            </select>
            <span>Capital:</span>{' '}
            <input
              size="5"
              className="capital"
              value={amortization.amount}
              style={amortization.invalidAmount ? { backgroundColor: '#dd8585' } : undefined}
              onChange={(event) => update(amortization.id, { amount: event.target.value })}
            />
            €{' '}
            <span>
              con reducción de{' '}
              <select
                className="tipo"
                style={{ width: 68 }}
                value={amortization.type}
                onChange={(event) => update(amortization.id, { type: event.target.value })}
              >
                <option value="term">Plazo</option>
                <option value="payment">Cuota</option>
              </select>
            </span>
            <a onClick={() => dispatch({ type: 'amortization/removed', id: amortization.id })}>
              Eliminar
            </a>
          </div>
        ))}
      </div>
      <div className="add">
        <a id="addAmort" onClick={() => dispatch({ type: 'amortization/added' })}>
          Añadir
        </a>
      </div>
    </div>
  );
}
