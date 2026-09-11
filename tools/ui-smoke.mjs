import { chromium } from 'playwright';

const baseURL = globalThis.process?.env?.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

async function openAt(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`[${width}x${height}] ${message.text()}`); });
  page.on('pageerror', (error) => consoleErrors.push(`[${width}x${height}] ${error.message}`));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  return page;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
async function text(page) { return page.locator('body').innerText(); }
async function noHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({ scrollWidth: globalThis.document.documentElement.scrollWidth, innerWidth: globalThis.innerWidth }));
  assert(metrics.scrollWidth <= metrics.innerWidth + 2, `${label}: horizontal overflow ${metrics.scrollWidth} > ${metrics.innerWidth}`);
}

try {
  const desktop = await openAt(1440, 900);
  let body = await text(desktop);
  assert(body.includes('Materials'), 'desktop: inventory missing');
  assert(body.includes('Primary vessel'), 'desktop: vessel missing');
  assert(body.includes('Environment'), 'desktop: controls missing');
  assert(body.includes('Unlimited stock'), 'desktop: unlimited stock missing');
  assert(body.includes('Hydrogen') && body.includes('Oxygen') && body.includes('Nitrogen'), 'desktop: starter inventory missing');
  assert(!body.includes('Water') && !body.includes('Methane'), 'desktop: undiscovered species identity leaked before analysis/dev mode');
  await noHorizontalOverflow(desktop, 'desktop');

  const amountInput = desktop.getByLabel('Amount');
  const addButton = desktop.getByRole('button', { name: /Add H₂ to vessel/i });
  assert((await amountInput.inputValue()) === '0.25', 'desktop: finite amount input default is not 0.25 mol');
  assert(!(await addButton.isDisabled()), 'desktop: finite amount add button unexpectedly disabled');
  await addButton.click();
  const compositionRows = await desktop.locator('.analysis-content tbody tr').allInnerTexts();
  const vesselChips = await desktop.locator('.composition-chip').allInnerTexts();
  assert(compositionRows.some((row) => row.includes('H₂') && row.includes('unknown') && row.includes('0.250 mol')) && vesselChips.some((chip) => chip.includes('H₂') && chip.includes('0.250 mol')), 'desktop: finite amount add failed');

  await desktop.getByLabel('Heater power').fill('250');
  await desktop.getByLabel('Cooler power').fill('150');
  body = await text(desktop);
  assert(body.includes('250 W') && body.includes('150 W'), 'desktop: heater/cooler control failed');

  await desktop.getByRole('checkbox', { name: 'Thermostat' }).check();
  body = await text(desktop);
  assert(body.includes('Thermostat enabled'), 'desktop: thermostat command feedback missing');

  await desktop.getByRole('button', { name: 'Phase' }).click();
  await desktop.getByRole('img', { name: 'Phase diagram' }).waitFor();
  body = await text(desktop);
  assert(body.includes('UI-only illustrative fixture'), 'desktop: supplied phase-diagram fixture label missing');

  await desktop.getByRole('button', { name: 'Run' }).click();
  assert((await text(desktop)).includes('RUNNING'), 'desktop: run failed');
  await desktop.getByRole('button', { name: 'Pause' }).click();
  assert((await text(desktop)).includes('PAUSED'), 'desktop: pause failed');

  await desktop.getByRole('button', { name: 'Analyze' }).click();
  body = await text(desktop);
  assert(body.includes('Identity confirmed: Water'), 'desktop: discovery confirmation missing');
  assert(body.includes('Water'), 'desktop: encyclopedia/inventory unlock missing after analysis');

  await desktop.getByLabel(/Dev/i).check();
  body = await text(desktop);
  assert(body.includes('Methane'), 'desktop: Developer Mode all-species access failed');
  await desktop.close();

  const tablet = await openAt(1024, 768);
  body = await text(tablet);
  assert(body.includes('Materials') && body.includes('Primary vessel') && body.includes('Environment'), 'tablet: core laboratory surfaces missing');
  await noHorizontalOverflow(tablet, 'tablet');
  await tablet.close();

  const mobile = await openAt(390, 844);
  body = await text(mobile);
  assert(body.includes('Primary vessel'), 'mobile: Lab should prioritize vessel');
  for (const nav of ['Inventory', 'Lab', 'Controls', 'Analysis', 'Log']) assert(body.includes(nav), `mobile: ${nav} navigation missing`);
  await mobile.getByRole('button', { name: 'Inventory', exact: true }).click();
  assert((await text(mobile)).includes('Materials'), 'mobile: Inventory view failed');
  await mobile.getByRole('button', { name: 'Controls', exact: true }).click();
  assert((await text(mobile)).includes('Environment'), 'mobile: Controls view failed');
  await mobile.getByRole('button', { name: 'Analysis', exact: true }).click();
  assert((await text(mobile)).includes('No vessel contents.'), 'mobile: Analysis view failed');
  await mobile.getByRole('button', { name: 'Log', exact: true }).click();
  assert((await text(mobile)).includes('recorded mock events'), 'mobile: Log view failed');
  await noHorizontalOverflow(mobile, 'mobile');
  await mobile.close();

  if (consoleErrors.length) throw new Error(`browser console/page errors:\n${consoleErrors.join('\n')}`);
  globalThis.console.log('UI browser smoke PASS: desktop 1440x900, tablet 1024x768, mobile 390x844');
} finally {
  await browser.close();
}
