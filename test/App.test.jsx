import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Resolves with the scenario, or rejects like an offline/missing file. */
function mockFetchScenario(scenario) {
  vi.stubGlobal(
    'fetch',
    scenario === null
      ? vi.fn(() => Promise.reject(new Error('offline')))
      : vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(scenario) }))
  );
}

/** The scenario fallback is dispatched asynchronously: wait for it everywhere. */
async function waitForScenarioWarning() {
  await waitFor(() => expect(document.getElementById('warningsContainer')).not.toBeNull());
}

describe('escenario.json', () => {
  const scenario = {
    startDate: '2023-06-01',
    capital: 99999,
    years: 10,
    type: 'fixed',
    euriborSpread: 1.5,
    initialFixedInterest: 1.25,
    fixedInterest: 3.1,
    initialPeriodMonths: 12,
    initialPeriodActive: true,
    amortizations: [{ year: 1, month: 1, amount: 4000, type: 'payment' }],
  };

  it('applies the form defaults and amortizations from escenario.json', async () => {
    mockFetchScenario(scenario);
    render(<App />);

    await waitFor(() => {
      expect(document.getElementById('capital').value).toBe('99999');
      expect(document.querySelectorAll('#euribor input[type=range]')).toHaveLength(10);
      expect(document.querySelectorAll('#amortizationsList .amortization-row')).toHaveLength(1);
    });

    expect(document.getElementById('yearsField').value).toBe('10');
    expect(document.getElementById('typeField').value).toBe('fixed');
    expect(document.getElementById('typeField').closest('.select-wrap')).not.toBeNull();
    expect(document.getElementById('fixedInterestField').value).toBe('3.1');
    expect(document.querySelector('.fixed-rate-fields')).not.toBeNull();
    expect(document.querySelector('.variable-rate-fields')).toBeNull();

    // year labels count from the scenario's startDate, not from today
    expect(document.querySelector('#euribor .year').textContent).toBe('2023');

    const row = document.querySelector('#amortizationsList .amortization-row');
    expect(row.querySelector('.year-select').value).toBe('1');
    expect(row.querySelector('.month-select').value).toBe('1');
    expect(row.querySelector('.amount-input').value).toBe('4000');
    expect(row.querySelector('.reduction-type-select').value).toBe('payment');

    // no fallback warning when the scenario loads
    expect(document.getElementById('warningsContainer')).toBeNull();

    // the initial-period settings survive a switch away from "Variable"
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'variable' } });
    expect(document.querySelector('.initial-period-options input[type=checkbox]').checked).toBe(true);
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });

    // and the simulation starts from the scenario's capital
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('mortgageContainer')).not.toBeNull());
    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    expect(Number(tableRows[0].querySelectorAll('td')[2].textContent)).toBe(99999);
  });

  it('keeps the HTML defaults and shows a warning when escenario.json cannot be loaded', async () => {
    mockFetchScenario(null);
    render(<App />);

    const warnings = await waitFor(() => {
      const container = document.getElementById('warningsContainer');
      expect(container).not.toBeNull();
      expect(container.textContent).toContain('escenario.json');
      return container;
    });
    expect(warnings.textContent).toContain('valores por defecto');

    // the defaults are untouched
    expect(document.getElementById('capital').value).toBe('150000');
    expect(document.getElementById('yearsField').value).toBe('25');
    expect(document.getElementById('typeField').value).toBe('variable');
    expect(document.querySelector('.initial-period-options input[type=checkbox]').checked).toBe(false);
    expect(document.querySelectorAll('#amortizationsList .amortization-row')).toHaveLength(0);
    expect(document.querySelectorAll('#euribor input[type=range]')).toHaveLength(25);
    // year labels default to the current calendar year
    expect(document.querySelector('#euribor .year').textContent).toBe(String(new Date().getFullYear()));
    expect(document.getElementById('resultsTableBody')).toBeNull();

    // and the page still calculates; the load warning stays visible
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.querySelectorAll('#resultsTableBody tr').length).toBeGreaterThan(1));
    expect(document.getElementById('warningsContainer').textContent).toContain('escenario.json');
  });
});

describe('the visible euribor value is the calculated one (bug #3)', () => {
  it('survives a term change and the first month calculates with it', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const slider = document.querySelector('#euribor input[type=range]');
    const valueInput = document.getElementById('euribor-value-0');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(valueInput.value).toBe('5.00');

    // the sliders are derived from state: nothing is rebuilt from the default
    // series, so the user's value survives the term change
    fireEvent.change(document.getElementById('yearsField'), { target: { value: '30' } });
    const rebuilt = document.querySelector('#euribor input[type=range]');
    const rebuiltValueInput = document.getElementById('euribor-value-0');
    expect(rebuilt.value).toBe('5');
    expect(rebuiltValueInput.value).toBe('5.00');
    expect(document.querySelectorAll('#euribor input[type=range]')).toHaveLength(30);

    // spread 1.5 + euribor 5 = 6.5% on the first month
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.querySelectorAll('#resultsTableBody tr').length).toBeGreaterThan(1));
    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
    const firstMonthRow = [...tableRows].find((row) =>
      row.querySelector('td')?.textContent.trim().startsWith('1 ·')
    );
    const firstMonthCells = [...firstMonthRow.querySelectorAll('td')].map((td) => td.textContent.trim());
    const interest = Number(firstMonthCells[4]);
    expect((interest * 12 * 100) / initialBalance).toBeCloseTo(1.5 + 5, 5);
  });

  it('accepts a direct Euribor value and uses it in the calculation', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const valueInput = document.getElementById('euribor-value-0');
    fireEvent.change(valueInput, { target: { value: '5.4' } });

    expect(document.getElementById('euribor-slider-0').value).toBe('5.4');
    expect(valueInput.value).toBe('5.4');

    fireEvent.blur(valueInput);
    expect(valueInput.value).toBe('5.40');

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.querySelectorAll('#resultsTableBody tr').length).toBeGreaterThan(1));

    const tableRows = document.querySelectorAll('#resultsTableBody tr');
    const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
    const firstMonthRow = [...tableRows].find((row) =>
      row.querySelector('td')?.textContent.trim().startsWith('1 ·')
    );
    const firstMonthCells = [...firstMonthRow.querySelectorAll('td')].map((td) => td.textContent.trim());
    const interest = Number(firstMonthCells[4]);
    expect((interest * 12 * 100) / initialBalance).toBeCloseTo(1.5 + 5.4, 5);
  });

  it('keeps the last valid Euribor value and blocks calculation for an invalid direct entry', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const valueInput = document.getElementById('euribor-value-0');
    const slider = document.getElementById('euribor-slider-0');
    fireEvent.change(valueInput, { target: { value: '15.5' } });

    expect(valueInput.getAttribute('aria-invalid')).toBe('true');
    expect(slider.value).toBe('2.2');
    fireEvent.change(valueInput, { target: { value: '2.25' } });
    expect(valueInput.getAttribute('aria-invalid')).toBe('true');
    expect(slider.value).toBe('2.2');
    fireEvent.click(document.getElementById('calculateButton'));

    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');

    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    expect(valueInput.getAttribute('aria-invalid')).toBeNull();
    expect(valueInput.value).toBe('2.20');
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });
});

describe('amortization year vs term (bug #7)', () => {
  it('rebuilds the year options with the term and warns about the out-of-term year', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('addAmortizationButton'));
    const yearSelect = document.querySelector('#amortizationsList .amortization-row .year-select');
    expect(yearSelect.options.length).toBe(25);
    fireEvent.change(yearSelect, { target: { value: '20' } });

    fireEvent.change(document.getElementById('yearsField'), { target: { value: '15' } });

    // the options follow the term; the stored year stays visible so it can be
    // reported instead of silently clamped
    const optionValues = [...yearSelect.options].map((option) => Number(option.value));
    for (let year = 1; year <= 15; year++) expect(optionValues).toContain(year);
    expect(optionValues).toContain(20);
    expect(yearSelect.value).toBe('20');

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('warningsContainer').textContent).toContain('año 20'));
    expect(document.getElementById('warningsContainer').textContent).toContain('15 años');
    // and the amortization is not applied
    expect(document.getElementById('resultsTableBody').textContent).not.toContain('Amort. parcial');
  });
});

describe('amortization editing in the UI (Fase 3.2)', () => {
  it('removes exactly the row whose button was clicked', async () => {
    mockFetchScenario({
      capital: 150000,
      years: 25,
      amortizations: [
        { year: 5, month: 3, amount: 1000, type: 'term' },
        { year: 7, month: 1, amount: 2000, type: 'payment' },
      ],
    });
    render(<App />);
    await waitFor(() =>
      expect(document.querySelectorAll('#amortizationsList .amortization-row')).toHaveLength(2)
    );

    const rows = document.querySelectorAll('#amortizationsList .amortization-row');
    expect(rows[0].querySelector('.amount-input').value).toBe('1000');
    expect(rows[1].querySelector('.amount-input').value).toBe('2000');
    // each button names the row it deletes; the amount disambiguates twin
    // rows in the same year and month (Fase 4.2 + 6.3)
    expect(rows[0].querySelector('.remove-amortization-action').getAttribute('aria-label')).toBe(
      'Eliminar la amortización de 1000 € del año 5, mes 3'
    );
    expect(rows[1].querySelector('.remove-amortization-action').getAttribute('aria-label')).toBe(
      'Eliminar la amortización de 2000 € del año 7, mes 1'
    );

    fireEvent.click(rows[0].querySelector('.remove-amortization-action'));
    const remaining = document.querySelectorAll('#amortizationsList .amortization-row');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].querySelector('.amount-input').value).toBe('2000');
  });

  it('an amortization exceeding the balance closes the loan and warns in the UI (Fase 6.4)', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('addAmortizationButton'));
    const amount = document.querySelector('#amortizationsList .amount-input');
    fireEvent.change(amount, { target: { value: '999999' } });

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    // the loan closes at the amortization month and the lib warning reaches
    // the warnings container through formatWarning
    expect(document.getElementById('resultsTableBody').textContent).toContain(
      'Fin del préstamo'
    );
    expect(document.getElementById('warningsContainer').textContent).toContain(
      'supera el saldo pendiente'
    );
  });
});

describe('the schedule is dated with month names (plan/mejoras-tabla.md)', () => {
  it('dates the schedule with real month names (plan/mejoras-tabla.md)', async () => {
    mockFetchScenario({
      startDate: '2023-06-01',
      capital: 71000,
      years: 15,
      type: 'variable',
      euriborSpread: 1,
      initialFixedInterest: 2.25,
      fixedInterest: 2.25,
      initialPeriodMonths: 60,
      initialPeriodActive: true,
      amortizations: [
        { year: 1, month: 1, amount: 4000, type: 'payment' },
        { year: 1, month: 2, amount: 6000, type: 'term' },
        { year: 1, month: 3, amount: 5000, type: 'term' },
        { year: 1, month: 5, amount: 4000, type: 'term' },
        { year: 2, month: 4, amount: 500, type: 'term' },
        { year: 3, month: 8, amount: 5000, type: 'term' },
      ],
    });
    render(<App />);

    // the form select picks the start month up from startDate
    await waitFor(() => expect(document.getElementById('startMonthField').value).toBe('6'));

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    // month rows keep the number (how many payments) and add the month;
    // with the amortization at month 1, the order is initial → amort. → cuota 1
    const amortizationRow = document.querySelector('#resultsTableBody .table-event--amortization');
    expect(amortizationRow.textContent).toContain('reducción de cuota (Jun 2023)');

    const firstMonth = [...document.querySelectorAll('#resultsTableBody tr')]
      .find((row) => row.querySelector('td')?.textContent.trim().startsWith('1 ·'))
      .querySelector('td');
    expect(firstMonth.textContent).toContain('1 · Jun 2023');

    // the closing row shows the exact calendar month, no block approximation
    const rows = document.querySelectorAll('#resultsTableBody tr');
    expect(rows[rows.length - 1].textContent).toContain('Fin del préstamo (May 2033 · mes 120)');
  });
});

describe('an invalid amortization amount blocks the calculation (Fase 3.2)', () => {
  it('blocks the calculation while an amortization amount is invalid', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('addAmortizationButton'));
    const amount = document.querySelector('#amortizationsList .amount-input');
    fireEvent.change(amount, { target: { value: 'abc' } });
    expect(amount.getAttribute('aria-invalid')).toBe('true');

    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');

    fireEvent.change(amount, { target: { value: '500' } });
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });
});

describe('a malformed scenario does not break the app (Fase 3.2)', () => {
  it('ignores an invalid startDate and wrong-typed fields, and still calculates', async () => {
    mockFetchScenario({
      startDate: 'not-a-date',
      capital: '99999', // string: ignored
      years: '10', // string: ignored
      type: 'variable',
      amortizations: [{ year: 1, month: 1, amount: 4000, type: 'payment' }],
    });
    render(<App />);

    // the scenario loads (no fallback warning) and the amortization row appears
    await waitFor(() =>
      expect(document.querySelectorAll('#amortizationsList .amortization-row')).toHaveLength(1)
    );
    expect(document.getElementById('warningsContainer')).toBeNull();

    // the wrong-typed fields are ignored: the HTML defaults stay, and the
    // invalid startDate falls back to the current year
    expect(document.getElementById('capital').value).toBe('150000');
    expect(document.getElementById('yearsField').value).toBe('25');
    expect(document.querySelector('#euribor .year').textContent).toBe(
      String(new Date().getFullYear())
    );

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
    expect(document.getElementById('resultsTableBody').textContent).toContain('Amort. parcial');
  });
});

describe('the Inicio field drives the year labels (Fase 3.2)', () => {
  it('the table headers and euribor labels follow startYear', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    // calendar-year labels use the calendar, not the loan anniversary
    const firstHeader = document.querySelector('#resultsTableBody .table-event--year');
    expect(firstHeader.textContent).toContain(`Año ${new Date().getFullYear()}`);

    fireEvent.change(document.getElementById('startYearField'), { target: { value: '2030' } });
    expect(document.getElementById('resultsTableBody')).toBeNull(); // editing clears the result
    expect(document.querySelector('#euribor .year').textContent).toBe('2030');

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() =>
      expect(document.querySelectorAll('#resultsTableBody .table-event--year').length).toBeGreaterThan(0)
    );
    expect(document.querySelector('#resultsTableBody .table-event--year').textContent).toContain(
      'Año 2030'
    );
  });
});

describe('calendar year labels and anniversary reviews are separate', () => {
  it('starts calendar headings in January and keeps the rate review on the September anniversary', async () => {
    mockFetchScenario({
      startDate: '2026-09-01',
      capital: 150000,
      years: 3,
      type: 'variable',
      euriborSpread: 1.5,
    });
    render(<App />);

    await waitFor(() => expect(document.getElementById('startMonthField').value).toBe('9'));
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    const rows = [...document.querySelectorAll('#resultsTableBody tr')];
    const year2026 = rows.findIndex((row) => row.classList.contains('table-event--year') && row.textContent.includes('2026'));
    const year2027 = rows.findIndex((row) => row.classList.contains('table-event--year') && row.textContent.includes('2027'));
    const month1 = rows.findIndex((row) => row.textContent.includes('1 · Sep 2026'));
    const month4 = rows.findIndex((row) => row.textContent.includes('4 · Dec 2026'));
    const month5 = rows.findIndex((row) => row.textContent.includes('5 · Ene 2027'));
    const month12 = rows.findIndex((row) => row.textContent.includes('12 · Ago 2027'));
    const review = rows.findIndex((row) => row.classList.contains('table-event--review'));
    const month13 = rows.findIndex((row) => row.textContent.includes('13 · Sep 2027'));

    expect(year2026).toBeGreaterThan(-1);
    expect(year2026).toBeLessThan(month1);
    expect(month4).toBeLessThan(year2027);
    expect(year2027).toBeLessThan(month5);
    expect(month12).toBeLessThan(review);
    expect(review).toBeLessThan(month13);
    expect(rows[review].textContent).toContain('Revisión anual de cuota');
    expect(rows[review].textContent).toContain('Sep 2027');
  });
});

describe('the calculate control works from the keyboard (Fase 3.2)', () => {
  it('is a real button: Enter and Space activate it natively', async () => {
    const user = userEvent.setup();
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const control = document.getElementById('calculateButton');
    expect(control.tagName).toBe('BUTTON');
    control.focus();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    // editing clears the result; Space must recalculate it
    fireEvent.change(document.getElementById('capital'), { target: { value: '120000' } });
    expect(document.getElementById('resultsTableBody')).toBeNull();

    await user.keyboard(' ');
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });

  it('is aria-disabled while fields are invalid, and clicking it still explains why', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const control = document.getElementById('calculateButton');
    expect(control.getAttribute('aria-disabled')).toBeNull();

    fireEvent.change(document.getElementById('capital'), { target: { value: '' } });
    expect(control.getAttribute('aria-disabled')).toBe('true');

    // aria-disabled instead of disabled: the click still runs and the
    // warning tells the user what to fix, instead of a silent no-op
    fireEvent.click(control);
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');
  });
});

describe('hidden invalid fields do not block the calculation (Fase 1.1)', () => {
  it('garbage in "Interés fijo" stops blocking after switching to Variable', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    fireEvent.change(document.getElementById('fixedInterestField'), { target: { value: 'abc' } });
    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');

    fireEvent.change(document.getElementById('typeField'), { target: { value: 'variable' } });
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });

  it('the reverse case: garbage in variable-only fields stops blocking under Fijo', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('variableInterestField'), { target: { value: 'abc' } });
    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();

    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });

  it('capital rejects decimals and separators, whole digits pass (Fase 1.4)', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const capital = document.getElementById('capital');
    for (const bad of ['1.5', '1,5', '1 500']) {
      fireEvent.change(capital, { target: { value: bad } });
      expect(capital.getAttribute('aria-invalid')).toBe('true');
      fireEvent.click(document.getElementById('calculateButton'));
      expect(document.getElementById('resultsTableBody')).toBeNull();
    }

    fireEvent.change(capital, { target: { value: '1500' } });
    expect(capital.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());
  });

  it('a whitespace-only interest field is invalid instead of 0% (Fase 1.3)', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const interest = document.getElementById('variableInterestField');
    fireEvent.change(interest, { target: { value: '   ' } });
    expect(interest.getAttribute('aria-invalid')).toBe('true');

    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');
  });

  it('invalid fields announce their error via aria-describedby (Fase 4.3)', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('capital'), { target: { value: '' } });
    const capital = document.getElementById('capital');
    expect(capital.getAttribute('aria-describedby')).toBe('capital-error');
    const hint = document.getElementById('capital-error');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toContain('no válido');

    // valid again: the link and the hint are gone
    fireEvent.change(capital, { target: { value: '150000' } });
    expect(capital.getAttribute('aria-describedby')).toBeNull();
    expect(document.getElementById('capital-error')).toBeNull();
  });

  it('blocks the calculation when the initial period reaches the term (Fase 1.2)', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('yearsField'), { target: { value: '10' } });
    const period = document.getElementById('fixedMonthsField');
    fireEvent.change(period, { target: { value: '120' } }); // 120 >= 10 * 12
    expect(period.getAttribute('aria-invalid')).toBe('true');

    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');
  });
});

describe('characterization — the reference numbers through the UI', () => {
  it('100k / 15y / fixed 2.25% → payment 655.08 and a schedule that ends at 0', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('capital'), { target: { value: '100000' } });
    fireEvent.change(document.getElementById('yearsField'), { target: { value: '15' } });
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    fireEvent.change(document.getElementById('fixedInterestField'), { target: { value: '2.25' } });

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('mortgageContainer')?.textContent).toBe('655.08€'));

    const rows = document.querySelectorAll('#resultsTableBody tr');
    expect(rows.length).toBeGreaterThan(182); // calendar-year labels are inserted too
    const lastMonthRow = [...rows].filter((row) => row.querySelectorAll('td').length === 5).at(-1);
    expect(lastMonthRow.querySelectorAll('td')[2].textContent).toBe('0.00');
    expect(rows[rows.length - 1].textContent).toContain('Fin del préstamo');
  });

  it('blocks the calculation while a field is invalid instead of rendering NaN', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const capital = document.getElementById('capital');
    fireEvent.change(capital, { target: { value: '' } });
    expect(capital.style.backgroundColor).not.toBe('');

    fireEvent.click(document.getElementById('calculateButton'));
    expect(document.getElementById('resultsTableBody')).toBeNull();
    const warnings = document.getElementById('warningsContainer');
    expect(warnings.textContent).toContain('no válidos');
    expect(warnings.textContent).toContain('escenario.json');
  });

  it('editing the form clears the last result: no stale tables', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('calculateButton'));
    await waitFor(() => expect(document.getElementById('resultsTableBody')).not.toBeNull());

    fireEvent.change(document.getElementById('capital'), { target: { value: '120000' } });
    expect(document.getElementById('resultsTableBody')).toBeNull();
    expect(document.getElementById('mortgageContainer')).toBeNull();
  });
});
