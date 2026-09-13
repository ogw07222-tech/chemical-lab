import { chromium } from 'playwright';

const baseURL = globalThis.process?.env?.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
function assert(value, message) { if (!value) throw new Error(message); }

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(baseURL, { waitUntil: 'networkidle' });

  const amount = page.getByRole('spinbutton', { name: '추가할 양' });
  await amount.fill('0.25');
  await page.getByRole('button', { name: /실험실에 추가/ }).click();

  const canvas = page.locator('.matter-particle-canvas');
  await canvas.waitFor();
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

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const frozenA = await canvas.evaluate((el) => el.toDataURL());
  await page.waitForTimeout(250);
  const frozenB = await canvas.evaluate((el) => el.toDataURL());
  assert(frozenA === frozenB, 'prefers-reduced-motion did not freeze particle rendering');
  assert((await page.locator('body').innerText()).includes('0.250 mol'), 'exact accessible amount disappeared');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(100);
  const movingA = await canvas.evaluate((el) => el.toDataURL());
  await page.waitForTimeout(300);
  const movingB = await canvas.evaluate((el) => el.toDataURL());
  assert(movingA !== movingB, 'normal-motion particle canvas did not animate');

  for (const width of [1536, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1024 ? 768 : 900 });
    await page.waitForTimeout(50);
    const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.innerWidth);
    assert(overflow <= 2, `${width}: horizontal overflow ${overflow}px`);
  }

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  globalThis.console.log('06C particle browser smoke PASS');
  await context.close();
} finally {
  await browser.close();
}
