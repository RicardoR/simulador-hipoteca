import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The scenario under test: this file is data, so personal branches only change
// it and the suite keeps passing there.
import scenarioFile from '../escenario.json';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function waitFor(predicate, timeout = 5000) {
  const start = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - start > timeout) throw new Error('timed out waiting for the page');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Loads the real index.html (jQuery + inline handlers + both scripts) in jsdom. */
async function loadPage(options = {}) {
  const dom = await JSDOM.fromFile(path.join(repoRoot, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    ...options,
  });
  const { window } = dom;
  await waitFor(() => window.document.getElementById('euribor').children.length > 0);
  return dom;
}

function typeIn(window, element, value) {
  element.value = value;
  element.dispatchEvent(new window.KeyboardEvent('keyup', { bubbles: true }));
}

describe('bug #3 — euribor slider value', () => {
  it('survives a rebuild and the table calculates with the visible value', async () => {
    const dom = await loadPage();
    try {
      const { window } = dom;
      const doc = window.document;

      // the user drags the first slider to 5.00
      const slider = doc.querySelector('#euribor input[type=range][month="0"]');
      slider.value = '5';
      slider.dispatchEvent(new window.Event('input', { bubbles: true }));
      expect(slider.nextElementSibling.textContent).toBe('5.00');

      // editing the term rebuilds the whole euribor section (check({..., max: 50}))
      typeIn(window, doc.getElementById('yearsField'), '30');

      const rebuilt = doc.querySelector('#euribor input[type=range][month="0"]');
      expect(rebuilt.value).toBe('5'); // visible…
      expect(rebuilt.nextElementSibling.textContent).toBe('5.00');

      // …and calculated: spread 1.5 + euribor 5 = 6.5%
      doc.getElementById('calcular').click();
      const tableRows = doc.querySelectorAll('#tableBody tr');
      const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
      const firstMonthCells = [...tableRows[1].querySelectorAll('td')].map((td) => td.textContent.trim());
      const interest = Number(firstMonthCells[4]);
      expect((interest * 12 * 100) / initialBalance).toBeCloseTo(1.5 + 5, 5);

      // a clean run adds no simulation warnings (jsdom has no fetch, so only
      // the escenario.json fallback warning may be present here)
      expect(doc.getElementById('warningsContainer').textContent).not.toContain('amortización');
    } finally {
      dom.window.close();
    }
  });
});

describe('bug #7 — amortization outside the term', () => {
  it('rebuilds the year select with the current term', async () => {
    const dom = await loadPage();
    try {
      const { window } = dom;
      const doc = window.document;

      doc.getElementById('addAmort').click();
      const yearSelect = doc.querySelector('#amort .am .anyo');
      expect(yearSelect.options.length).toBe(25); // default term is 25 years
      yearSelect.value = '20';

      typeIn(window, doc.getElementById('yearsField'), '15');

      expect(yearSelect.options.length).toBe(15);
      expect(yearSelect.value).toBe('15'); // clamped into the new term
    } finally {
      dom.window.close();
    }
  });

  it('shows a visible warning when an amortization falls outside the term', async () => {
    const dom = await loadPage();
    try {
      const { window } = dom;
      const doc = window.document;

      doc.getElementById('addAmort').click();
      doc.querySelector('#amort .am .anyo').value = '20';

      // the term drops below the amortization year without passing through check()
      doc.getElementById('yearsField').value = '15';
      doc.getElementById('calcular').click();

      const warnings = doc.getElementById('warningsContainer');
      expect(warnings.style.display).not.toBe('none');
      expect(warnings.textContent).toContain('año 20');
      expect(warnings.textContent).toContain('15 años');

      // and the amortization is not applied
      expect(doc.getElementById('tableBody').textContent).not.toContain('Amort. parcial');
    } finally {
      dom.window.close();
    }
  });
});

describe('phase 3 — escenario.json', () => {
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
    const dom = await loadPage({
      beforeParse(window) {
        window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(scenario) });
      },
    });
    try {
      const { window } = dom;
      const doc = window.document;

      await waitFor(
        () =>
          doc.getElementById('capital').value === '99999' &&
          doc.querySelectorAll('#euribor input[type=range]').length === 10 &&
          doc.querySelectorAll('#amort .am').length === 1
      );

      expect(doc.getElementById('yearsField').value).toBe('10');
      expect(doc.getElementById('typeField').value).toBe('Fijo');
      expect(doc.getElementById('fixedInterestField').value).toBe('3.1');
      expect(doc.querySelector('.inicial input[type=checkbox]').checked).toBe(true);
      expect(doc.querySelector('.fijo').style.display).not.toBe('none');
      expect(doc.querySelector('.variable').style.display).toBe('none');

      // year labels count from the scenario's startDate, not from today
      expect(doc.querySelector('#euribor .year').textContent).toBe('2023');

      const row = doc.querySelector('#amort .am');
      expect(row.querySelector('.anyo').value).toBe('1');
      expect(row.querySelector('.mes').value).toBe('1');
      expect(row.querySelector('.capital').value).toBe('4000');
      expect(row.querySelector('.tipo').value).toBe('Cuota');

      // no fallback warning when the scenario loads
      expect(doc.getElementById('warningsContainer').textContent).not.toContain('escenario.json');

      // and the simulation uses the scenario values
      doc.getElementById('calcular').click();
      const tableRows = doc.querySelectorAll('#tableBody tr');
      const initialBalance = Number(tableRows[0].querySelectorAll('td')[2].textContent);
      expect(initialBalance).toBe(99999);
      expect(doc.getElementById('mortgageContainer').textContent).not.toBe('');
    } finally {
      dom.window.close();
    }
  });

  it('keeps the HTML defaults and shows a warning when escenario.json cannot be loaded', async () => {
    // jsdom implements no fetch at all, so this exercises the fallback path
    const dom = await loadPage();
    try {
      const { window } = dom;
      const doc = window.document;

      await waitFor(() => doc.getElementById('warningsContainer').textContent.includes('escenario.json'));

      const warnings = doc.getElementById('warningsContainer');
      expect(warnings.style.display).not.toBe('none');
      expect(warnings.textContent).toContain('valores por defecto');

      // the HTML defaults are untouched
      expect(doc.getElementById('capital').value).toBe('150000');
      expect(doc.getElementById('yearsField').value).toBe('25');
      expect(doc.getElementById('typeField').value).toBe('Variable');
      expect(doc.querySelectorAll('#amort .am')).toHaveLength(0);
      expect(doc.querySelectorAll('#euribor input[type=range]').length).toBe(25);

      // and the page still calculates; the load warning stays visible
      doc.getElementById('calcular').click();
      expect(doc.querySelectorAll('#tableBody tr').length).toBeGreaterThan(1);
      expect(doc.getElementById('warningsContainer').textContent).toContain('escenario.json');
    } finally {
      dom.window.close();
    }
  });

  it('fetches the real escenario.json with a relative path over HTTP', async () => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filePath = path.join(repoRoot, urlPath === '/' ? 'index.html' : urlPath);
        if (!filePath.startsWith(repoRoot)) throw new Error('outside the repo');
        const data = await readFile(filePath);
        const type = filePath.endsWith('.html')
          ? 'text/html'
          : filePath.endsWith('.js')
            ? 'text/javascript'
            : filePath.endsWith('.css')
              ? 'text/css'
              : 'application/json';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    let dom;
    try {
      dom = await JSDOM.fromURL(base, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        beforeParse(window) {
          // jsdom implements no fetch; use Node's against the local server
          window.fetch = (input) => globalThis.fetch(new URL(input, base));
        },
      });
      const { window } = dom;
      await waitFor(() => window.document.getElementById('euribor').children.length > 0);
      // re-run the load explicitly to await the fetch + apply of the real file
      await window.eval('mainFunction.loadScenario()');

      const doc = window.document;
      expect(doc.getElementById('warningsContainer').textContent).not.toContain('escenario.json');
      // year labels count from the scenario's startDate (or from today if absent)
      const expectedStartYear = scenarioFile.startDate
        ? new Date(scenarioFile.startDate).getFullYear()
        : new Date().getFullYear();
      expect(doc.querySelector('#euribor .year').textContent).toBe(String(expectedStartYear));
      // values come from the branch's own escenario.json
      expect(doc.getElementById('capital').value).toBe(String(scenarioFile.capital));
      expect(doc.getElementById('yearsField').value).toBe(String(scenarioFile.years));
      expect(doc.getElementById('typeField').value).toBe(scenarioFile.type === 'fixed' ? 'Fijo' : 'Variable');
      expect(doc.querySelectorAll('#euribor input[type=range]').length).toBe(scenarioFile.years);
      expect(doc.querySelectorAll('#amort .am')).toHaveLength(scenarioFile.amortizations.length);
      if (scenarioFile.amortizations.length) {
        const row = doc.querySelector('#amort .am');
        expect(row.querySelector('.anyo').value).toBe(String(scenarioFile.amortizations[0].year));
        expect(row.querySelector('.mes').value).toBe(String(scenarioFile.amortizations[0].month));
        expect(row.querySelector('.capital').value).toBe(String(scenarioFile.amortizations[0].amount));
        expect(row.querySelector('.tipo').value).toBe(
          scenarioFile.amortizations[0].type === 'payment' ? 'Cuota' : 'Plazo'
        );
      }

      // and the simulation starts from the scenario's capital
      doc.getElementById('calcular').click();
      const firstCell = doc.querySelectorAll('#tableBody tr')[0].querySelectorAll('td')[2];
      expect(Number(firstCell.textContent)).toBe(scenarioFile.capital);

      // the first EURIBOR header also counts from the start year: it comes at
      // the end of the initial fixed period, or after the first year without one
      const header = [...doc.querySelectorAll('#tableBody tr')].find((tr) => tr.textContent.includes('EURIBOR:'));
      expect(header).toBeDefined();
      const expectedLoanYear = scenarioFile.initialPeriodActive ? scenarioFile.initialPeriodMonths / 12 : 1;
      expect(header.textContent).toContain(`AÑO ${expectedStartYear + expectedLoanYear} EURIBOR`);
    } finally {
      server.close();
      if (dom) dom.window.close();
    }
  });
});
