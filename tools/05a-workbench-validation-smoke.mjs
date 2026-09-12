import { chromium } from 'playwright';

const baseURL = globalThis.process?.env?.UI_BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const viewports = [
  [1536, 900],
  [1440, 900],
  [1024, 768],
  [390, 844],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseURL}/validation-05a.html`, { waitUntil: 'networkidle' });

    const metrics = await page.evaluate(() => ({
      scrollWidth: globalThis.document.documentElement.scrollWidth,
      innerWidth: globalThis.innerWidth,
    }));
    assert(metrics.scrollWidth <= metrics.innerWidth + 2, `${width}x${height}: horizontal overflow`);

    const surface = page.getByRole('region', { name: '기구 배치 영역' });
    const surfaceBox = await surface.boundingBox();
    assert(surfaceBox && surfaceBox.width > 0 && surfaceBox.height > 0, `${width}x${height}: placement surface missing/clipped`);

    for (const name of ['BEAKER 기구', 'HOT_PLATE 기구']) {
      const item = page.getByRole('group', { name });
      const box = await item.boundingBox();
      assert(box, `${width}x${height}: ${name} bounds unavailable`);
      assert(box.x >= surfaceBox.x - 1, `${width}x${height}: ${name} clipped left`);
      assert(box.y >= surfaceBox.y - 1, `${width}x${height}: ${name} clipped top`);
      assert(box.x + box.width <= surfaceBox.x + surfaceBox.width + 1, `${width}x${height}: ${name} clipped right`);
      assert(box.y + box.height <= surfaceBox.y + surfaceBox.height + 1, `${width}x${height}: ${name} clipped bottom`);
    }

    const beaker = page.getByRole('group', { name: 'BEAKER 기구' });
    await beaker.click();
    const selected = await beaker.evaluate((el) => ({
      cls: el.className,
      outlineColor: globalThis.getComputedStyle(el).outlineColor,
      outlineWidth: globalThis.getComputedStyle(el).outlineWidth,
    }));
    assert(String(selected.cls).includes('selected'), `${width}x${height}: selection state not applied`);
    assert(selected.outlineWidth !== '0px' && selected.outlineColor !== 'rgba(0, 0, 0, 0)', `${width}x${height}: selection frame invisible`);

    const plate = page.getByRole('group', { name: 'HOT_PLATE 기구' });
    await plate.focus();
    const focused = await plate.evaluate((el) => ({
      cls: el.className,
      zIndex: Number(globalThis.getComputedStyle(el).zIndex),
      outlineStyle: globalThis.getComputedStyle(el).outlineStyle,
    }));
    assert(String(focused.cls).includes('focused'), `${width}x${height}: focus state not applied`);
    assert(focused.zIndex >= 1004, `${width}x${height}: focused z-order elevation missing`);
    assert(focused.outlineStyle === 'dashed' || focused.outlineStyle === 'solid', `${width}x${height}: focus frame invisible`);

    assert(errors.length === 0, `${width}x${height}: console/page errors: ${errors.join(' | ')}`);
    await page.close();
  }
  globalThis.console.log('05A validation harness PASS: 1536x900, 1440x900, 1024x768, 390x844');
} finally {
  await browser.close();
}
