import { chromium } from 'playwright';

const baseURL = globalThis.process?.env?.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
function assert(value, message) { if (!value) throw new Error(message); }
async function canvasData(locator) { return locator.evaluate((el) => el.toDataURL()); }

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  // Real application smoke: interaction boundary, accessibility, DPR, exact amount, responsive overflow.
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  const amount = page.getByRole('spinbutton', { name: '추가할 양' });
  await amount.fill('0.25');
  await page.getByRole('button', { name: /실험실에 추가/ }).click();
  const appCanvas = page.locator('.matter-particle-canvas');
  await appCanvas.waitFor();
  const metrics = await page.evaluate(() => {
    const canvasElement = globalThis.document.querySelector('.matter-particle-canvas');
    const hostElement = globalThis.document.querySelector('.matter-particle-host');
    if (!(canvasElement instanceof globalThis.HTMLCanvasElement) || !(hostElement instanceof globalThis.HTMLElement)) return null;
    const r = hostElement.getBoundingClientRect();
    return {
      cssWidth: r.width,
      cssHeight: r.height,
      backingWidth: canvasElement.width,
      backingHeight: canvasElement.height,
      pointerEvents: globalThis.getComputedStyle(hostElement).pointerEvents,
      label: canvasElement.getAttribute('aria-label'),
      role: canvasElement.getAttribute('role'),
    };
  });
  assert(metrics, 'particle canvas metrics unavailable');
  assert(metrics.pointerEvents === 'none', `particle host blocks pointer events: ${metrics.pointerEvents}`);
  assert(metrics.role === 'img' && metrics.label, 'particle canvas accessibility role/label missing');
  assert(metrics.backingWidth <= Math.ceil(metrics.cssWidth * 2) + 2, 'DPR width cap exceeded');
  assert(metrics.backingHeight <= Math.ceil(metrics.cssHeight * 2) + 2, 'DPR height cap exceeded');
  assert((await page.locator('body').innerText()).includes('0.250 mol'), 'exact accessible amount disappeared');

  for (const width of [1536, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1024 ? 768 : 900 });
    await page.waitForTimeout(50);
    const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.innerWidth);
    assert(overflow <= 2, `${width}: horizontal overflow ${overflow}px`);
  }

  // Validation-only phase fixture imports the production MatterParticleCanvas without changing production source.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseURL}/tests/validation/06c-particle-browser-fixture.html`, { waitUntil: 'networkidle' });
  const gas = page.locator('[data-fixture="gas"] canvas');
  const liquid = page.locator('[data-fixture="liquid"] canvas');
  const solid = page.locator('[data-fixture="solid"] canvas');
  await gas.waitFor();

  const gasA = await canvasData(gas); const liquidA = await canvasData(liquid); const solidA = await canvasData(solid);
  await page.waitForTimeout(350);
  const gasB = await canvasData(gas); const liquidB = await canvasData(liquid); const solidB = await canvasData(solid);
  assert(gasA !== gasB, 'gas canvas did not animate under normal motion');
  assert(liquidA !== liquidB, 'liquid canvas did not animate under normal motion');
  assert(solidA === solidB, 'solid canvas translated under normal motion');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(120);
  const reducedGasA = await canvasData(gas); const reducedLiquidA = await canvasData(liquid); const reducedSolidA = await canvasData(solid);
  await page.waitForTimeout(300);
  const reducedGasB = await canvasData(gas); const reducedLiquidB = await canvasData(liquid); const reducedSolidB = await canvasData(solid);
  assert(reducedGasA === reducedGasB, 'reduced motion did not freeze gas');
  assert(reducedLiquidA === reducedLiquidB, 'reduced motion did not freeze liquid');
  assert(reducedSolidA === reducedSolidB, 'reduced motion changed solid');
  assert(await gas.getAttribute('aria-label'), 'gas fixture accessibility label disappeared');
  assert(await liquid.getAttribute('aria-label'), 'liquid fixture accessibility label disappeared');
  assert(await solid.getAttribute('aria-label'), 'solid fixture accessibility label disappeared');

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  globalThis.console.log('06C particle browser smoke PASS');
  await context.close();
} finally {
  await browser.close();
}
