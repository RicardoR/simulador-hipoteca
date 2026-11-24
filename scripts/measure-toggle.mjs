/**
 * Rough interaction timing for the memoization check (Fase 4.4 of
 * plan/fix-and-polish.md): 50-year term, table calculated, then time the
 * euribor panel toggle (which used to rebuild the ~600-row table and the
 * 101 euribor inputs on every toggle) and a form keystroke.
 *
 * Usage: node scripts/measure-toggle.mjs [url]
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const chrome = CHROMES.find((x) => x && existsSync(x));
if (!chrome) {
  console.error('no Chrome found');
  process.exit(1);
}

const url = process.argv[2] || 'http://localhost:4173/';
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle0' });

// 50 years → 50 sliders, ~600 table rows
await page.evaluate(() => {
  const el = document.querySelector('#yearsField');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, '50');
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.click('#calculateButton');
await page.waitForSelector('#resultsTableBody tr', { timeout: 10000 });

const rows = await page.$$eval('#resultsTableBody tr', (trs) => trs.length);
// Time from click until the DOM actually changes (first mutation). React 19
// schedules the render, so timing the click() call itself measures nothing;
// a MutationObserver resolves when the commit lands.
const times = [];
for (let i = 0; i < 41; i++) {
  times.push(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const panel = document.querySelector('.euribor');
          const t0 = performance.now();
          const observer = new MutationObserver(() => {
            observer.disconnect();
            resolve(performance.now() - t0);
          });
          observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
          document.querySelector('.euribor-toggle').click();
        })
    )
  );
}
times.sort((a, b) => a - b);
const median = times[20];
const p90 = times[36];
console.log(`rows: ${rows}`);
console.log(`euribor toggle — median ${median.toFixed(2)} ms, p90 ${p90.toFixed(2)} ms`);

// a keystroke in the form while the result is kept is not measurable this way
// (editing clears the result); the toggle is the expensive kept-result case.
await browser.close();
