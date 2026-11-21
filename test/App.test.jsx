import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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
      expect(document.querySelectorAll('#amort .am')).toHaveLength(1);
    });

    expect(document.getElementById('yearsField').value).toBe('10');
    expect(document.getElementById('typeField').value).toBe('fixed');
    expect(document.getElementById('typeField').closest('.select-wrap')).not.toBeNull();
    expect(document.getElementById('fixedInterestField').value).toBe('3.1');
    expect(document.querySelector('.fijo')).not.toBeNull();
    expect(document.querySelector('.variable')).toBeNull();

    // year labels count from the scenario's startDate, not from today
    expect(document.querySelector('#euribor .year').textContent).toBe('2023');

    const row = document.querySelector('#amort .am');
    expect(row.querySelector('.anyo').value).toBe('1');
    expect(row.querySelector('.mes').value).toBe('1');
    expect(row.querySelector('.capital').value).toBe('4000');
    expect(row.querySelector('.tipo').value).toBe('payment');

    // no fallback warning when the scenario loads
    expect(document.getElementById('warningsContainer')).toBeNull();

    // the initial-period settings survive a switch away from "Variable"
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'variable' } });
    expect(document.querySelector('.inicial input[type=checkbox]').checked).toBe(true);
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });

    // and the simulation starts from the scenario's capital
    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.getElementById('mortgageContainer')).not.toBeNull());
    const tableRows = document.querySelectorAll('#tableBody tr');
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
    expect(document.querySelector('.inicial input[type=checkbox]').checked).toBe(false);
    expect(document.querySelectorAll('#amort .am')).toHaveLength(0);
    expect(document.querySelectorAll('#euribor input[type=range]')).toHaveLength(25);
    // year labels default to the current calendar year
    expect(document.querySelector('#euribor .year').textContent).toBe(String(new Date().getFullYear()));
    expect(document.getElementById('tableBody')).toBeNull();

    // and the page still calculates; the load warning stays visible
    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.querySelectorAll('#tableBody tr').length).toBeGreaterThan(1));
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
    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.querySelectorAll('#tableBody tr').length).toBeGreaterThan(1));
    const tableRows = document.querySelectorAll('#tableBody tr');
    const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
    const firstMonthCells = [...tableRows[1].querySelectorAll('td')].map((td) => td.textContent.trim());
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

    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.querySelectorAll('#tableBody tr').length).toBeGreaterThan(1));

    const tableRows = document.querySelectorAll('#tableBody tr');
    const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
    const firstMonthCells = [...tableRows[1].querySelectorAll('td')].map((td) => td.textContent.trim());
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
    fireEvent.click(document.getElementById('calcular'));

    expect(document.getElementById('tableBody')).toBeNull();
    expect(document.getElementById('warningsContainer').textContent).toContain('no válidos');

    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    expect(valueInput.getAttribute('aria-invalid')).toBeNull();
    expect(valueInput.value).toBe('2.20');
    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.getElementById('tableBody')).not.toBeNull());
  });
});

describe('amortization year vs term (bug #7)', () => {
  it('rebuilds the year options with the term and warns about the out-of-term year', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('addAmort'));
    const yearSelect = document.querySelector('#amort .am .anyo');
    expect(yearSelect.options.length).toBe(25);
    fireEvent.change(yearSelect, { target: { value: '20' } });

    fireEvent.change(document.getElementById('yearsField'), { target: { value: '15' } });

    // the options follow the term; the stored year stays visible so it can be
    // reported instead of silently clamped
    const optionValues = [...yearSelect.options].map((option) => Number(option.value));
    for (let year = 1; year <= 15; year++) expect(optionValues).toContain(year);
    expect(optionValues).toContain(20);
    expect(yearSelect.value).toBe('20');

    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.getElementById('warningsContainer').textContent).toContain('año 20'));
    expect(document.getElementById('warningsContainer').textContent).toContain('15 años');
    // and the amortization is not applied
    expect(document.getElementById('tableBody').textContent).not.toContain('Amort. parcial');
  });
});

describe('characterization — the reference numbers through the UI', () => {
  it('100k / 15y / fixed 2.25% → cuota 655.08 and a schedule that ends at 0', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.change(document.getElementById('capital'), { target: { value: '100000' } });
    fireEvent.change(document.getElementById('yearsField'), { target: { value: '15' } });
    fireEvent.change(document.getElementById('typeField'), { target: { value: 'fixed' } });
    fireEvent.change(document.getElementById('fixedInterestField'), { target: { value: '2.25' } });

    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.getElementById('mortgageContainer')?.textContent).toBe('655.08€'));

    const rows = document.querySelectorAll('#tableBody tr');
    expect(rows).toHaveLength(181); // initial row + 180 monthly rows
    expect(rows[180].querySelectorAll('td')[2].textContent).toBe('0.00');
  });

  it('blocks the calculation while a field is invalid instead of rendering NaN', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    const capital = document.getElementById('capital');
    fireEvent.change(capital, { target: { value: '' } });
    expect(capital.style.backgroundColor).not.toBe('');

    fireEvent.click(document.getElementById('calcular'));
    expect(document.getElementById('tableBody')).toBeNull();
    const warnings = document.getElementById('warningsContainer');
    expect(warnings.textContent).toContain('no válidos');
    expect(warnings.textContent).toContain('escenario.json');
  });

  it('editing the form clears the last result: no stale tables', async () => {
    mockFetchScenario(null);
    render(<App />);
    await waitForScenarioWarning();

    fireEvent.click(document.getElementById('calcular'));
    await waitFor(() => expect(document.getElementById('tableBody')).not.toBeNull());

    fireEvent.change(document.getElementById('capital'), { target: { value: '120000' } });
    expect(document.getElementById('tableBody')).toBeNull();
    expect(document.getElementById('mortgageContainer')).toBeNull();
  });
});
