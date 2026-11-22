/**
 * Partial amortizations list. The rows are state, not DOM: adding, editing or
 * removing one invalidates the last result (like the old `mainFunction.changes`)
 * and the year options always follow the current term (bug #7). A year stored
 * outside the term stays visible so the simulation can warn about it.
 */
export default function Amortizations({ state, dispatch }) {
  const termYears = state.termYears;

  const update = (id, patch) => dispatch({ type: 'amortization/updated', id, patch });

  const yearOptions = (amortization) => {
    const options = [];
    for (let year = 1; year <= termYears; year++) options.push(year);
    if (amortization.year > termYears) options.push(amortization.year);
    return options;
  };

  return (
    <div className="amortizations-panel">
      <h2 className="title">Amortizaciones parciales</h2>
      <div id="amortizationsList">
        {state.amortizations.map((amortization) => (
          <div className="amortization-row" key={amortization.id}>
            <label>
              Año
              <span className="select-wrap year-select-wrap">
                <select
                  className="year-select"
                  value={String(amortization.year)}
                  onChange={(event) => update(amortization.id, { year: Number(event.target.value) })}
                >
                  {yearOptions(amortization).map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label>
              Mes
              <span className="select-wrap month-select-wrap">
                <select
                  className="month-select"
                  value={String(amortization.month)}
                  onChange={(event) => update(amortization.id, { month: Number(event.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={String(month)}>
                      {month}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="amount-field">
              Capital
              <input
                size="5"
                className="amount-input"
                value={amortization.amount}
                aria-invalid={amortization.invalidAmount || undefined}
                style={
                  amortization.invalidAmount
                    ? { backgroundColor: 'var(--color-error-surface)' }
                    : undefined
                }
                onChange={(event) => update(amortization.id, { amount: event.target.value })}
              />
              <span>€</span>
            </label>
            <label className="reduction-field">
              Reducción
              <span className="select-wrap reduction-type-wrap">
                <select
                  className="reduction-type-select"
                  value={amortization.type}
                  onChange={(event) => update(amortization.id, { type: event.target.value })}
                >
                  <option value="term">Plazo</option>
                  <option value="payment">Cuota</option>
                </select>
              </span>
            </label>
            <button
              type="button"
              className="text-action remove-amortization-action"
              onClick={() => dispatch({ type: 'amortization/removed', id: amortization.id })}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
      <div className="add-amortization-action-wrapper">
        <button
          id="addAmortizationButton"
          type="button"
          className="text-action add-amortization-action"
          onClick={() => dispatch({ type: 'amortization/added' })}
        >
          Añadir amortización
        </button>
      </div>
    </div>
  );
}
