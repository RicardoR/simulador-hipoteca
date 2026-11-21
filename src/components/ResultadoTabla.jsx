/** Result summary + amortization table, rendered only after CALCULAR. */
export default function ResultadoTabla({ result, startYear }) {
  return (
    <>
      {result.initialPayment != null && (
        <div className="mortgage">
          Tu cuota inicial: <span id="mortgageContainer">{result.initialPayment.toFixed(2)}€</span>
          <br />
          Total de intereses: <span id="interestTotalContainer">{result.totalInterest.toFixed(2)}€</span>
        </div>
      )}

      <div className="draw">
        <div className="table_wrapper">
          <table>
            <caption>
              <strong>CUADRO DE AMORTIZACIÓN:</strong>
            </caption>
            <thead>
              <tr style={{ fontWeight: 'bold' }}>
                <th>Mes</th>
                <th>Cuota</th>
                <th>Pendiente</th>
                <th>Capital</th>
                <th>Intereses</th>
              </tr>
            </thead>
            <tbody id="tableBody">
              {result.rows.map((row, index) => renderRow(row, index, startYear))}
            </tbody>
          </table>
        </div>
        <div className="right"></div>
        <div className="clear"></div>
      </div>
    </>
  );
}

function renderRow(row, key, startYear) {
  switch (row.kind) {
    case 'initial':
      return (
        <tr key={key}>
          <td>0</td>
          <td>-</td>
          <td>{row.balance.toFixed(2)}</td>
          <td>-</td>
          <td>-</td>
        </tr>
      );
    case 'period-end':
      return (
        <tr key={key}>
          <td colSpan={5} style={{ fontWeight: 'bold', color: '#e24a4a', textAlign: 'center' }}>
            Fin periodo inicial fijo
          </td>
        </tr>
      );
    case 'header':
      return (
        <tr key={key}>
          <td colSpan={5} style={{ fontWeight: 'bold', textAlign: 'center' }}>
            AÑO {startYear + row.loanYear} EURIBOR: {row.euribor} - AÑO {row.loanYear} DEL PRÉSTAMO
          </td>
        </tr>
      );
    case 'amortization':
      return (
        <tr key={key}>
          <td
            colSpan={5}
            style={{ fontWeight: 'bold', textAlign: 'center', color: '#1E83CE' }}
          >
            Amort. parcial de {row.amount} € - reducción de {row.reduction === 'term' ? 'Plazo' : 'Cuota'}{' '}
            <br />
          </td>
        </tr>
      );
    case 'month':
      return (
        <tr key={key}>
          <td>{row.month}</td>
          <td>{row.payment.toFixed(2)}</td>
          <td>{row.balance.toFixed(2)}</td>
          <td>{row.principal.toFixed(2)}</td>
          <td>{row.interest.toFixed(2)}</td>
        </tr>
      );
    default:
      return null;
  }
}
