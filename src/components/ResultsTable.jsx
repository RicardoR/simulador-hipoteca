/** Result summary + amortization table, rendered only after calculation. */
import { memo } from 'react';
import { MONTH_NAMES, loanCalendarMonth } from '../lib/loanCalendar.js';

/** "Junio 2023" for a loan month, given the form's start month/year. */
function monthLabel(loanMonth, startMonth, startYear) {
  const { monthIndex, year } = loanCalendarMonth(loanMonth, startMonth, startYear);
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function ResultsTable({ result, startMonth, startYear }) {
  return (
    <>
      {result.initialPayment != null && (
        <div className="mortgage">
          <p>
            Tu cuota inicial
            <span id="mortgageContainer" className="num">
              {result.initialPayment.toFixed(2)}€
            </span>
          </p>
          <p>
            Total de intereses
            <span id="interestTotalContainer" className="num">
              {result.totalInterest.toFixed(2)}€
            </span>
          </p>
        </div>
      )}

       <div className="results-table-section">
        <div className="table-scroll-container">
          <table>
            <caption>Cuadro de amortización</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Cuota</th>
                <th scope="col">Pendiente</th>
                <th scope="col">Capital</th>
                <th scope="col">Intereses</th>
              </tr>
            </thead>
            <tbody id="resultsTableBody">
              {result.rows.map((row, index) => renderRow(row, index, startMonth, startYear))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function renderRow(row, key, startMonth, startYear) {
  switch (row.kind) {
    case 'initial':
      return (
        <tr key={key}>
          <td className="num">0</td>
          <td className="num">-</td>
          <td className="num">{row.balance.toFixed(2)}</td>
          <td className="num">-</td>
          <td className="num">-</td>
        </tr>
      );
    case 'period-end':
      return (
        <tr className="table-event table-event--period" key={key}>
          <td colSpan={5}>
            Fin periodo inicial fijo
          </td>
        </tr>
      );
    case 'header':
      return (
        <tr className="table-event table-event--year" key={key}>
          <td colSpan={5}>
            Año {startYear + row.loanYear}, Euríbor: {row.euribor}, año {row.loanYear} del préstamo
          </td>
        </tr>
      );
    case 'amortization':
      return (
        <tr className="table-event table-event--amortization" key={key}>
          <td colSpan={5}>
            Amort. parcial de <span className="num">{row.amount} €</span>, reducción de{' '}
            {row.reduction === 'term' ? 'plazo' : 'cuota'} ({monthLabel(row.month, startMonth, startYear)})
          </td>
        </tr>
      );
    case 'end':
      return (
        <tr className="table-event" key={key}>
          <td colSpan={5}>
            {row.months > 0
              ? `Fin del préstamo (${monthLabel(row.months, startMonth, startYear)} · mes ${row.months})`
              : 'Fin del préstamo'}
          </td>
        </tr>
      );
    case 'month':
      return (
        <tr key={key}>
          <td className="num">
            {row.month} · {monthLabel(row.month, startMonth, startYear)}
          </td>
          <td className="num">{row.payment.toFixed(2)}</td>
          <td className="num">{row.balance.toFixed(2)}</td>
          <td className="num">{row.principal.toFixed(2)}</td>
          <td className="num">{row.interest.toFixed(2)}</td>
        </tr>
      );
    default:
      return null;
  }
}

/**
 * Memoized (Fase 4.4 of plan/fix-and-polish.md): the result is kept across
 * actions that do not touch the data (the euribor panel toggle) and the table
 * reaches ~650 rows at a 50-year term — rebuilding it on unrelated state
 * changes is the most expensive render in the app.
 */
export default memo(ResultsTable);
