import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
async function loadPage() {
  const dom = await JSDOM.fromFile(path.join(repoRoot, 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
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

      // no warnings on a clean run
      expect(doc.getElementById('warningsContainer').textContent).toBe('');
      expect(doc.getElementById('warningsContainer').style.display).toBe('none');
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
