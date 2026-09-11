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
  for (const width of [1536, 1440]) {
    const desktop = await openAt(width, 900);
    let body = await text(desktop);
    assert(body.includes('도감'), `${width}: catalog missing`);
    assert(body.includes('LAB WORKSPACE'), `${width}: workbench missing`);
    assert(body.includes('물질 정보') && body.includes('내 메모'), `${width}: inspector tabs missing`);
    assert(body.includes('실험 조건') && body.includes('조작') && body.includes('폐기'), `${width}: experiment console missing`);
    assert(body.includes('수소') && body.includes('산소') && body.includes('질소'), `${width}: starter catalog missing`);
    assert(!body.includes('메테인') && !body.includes('물\nH₂O'), `${width}: undiscovered identity leaked`);
    await noHorizontalOverflow(desktop, `desktop-${width}`);

    if (width === 1536) {
      const amount = desktop.getByRole('spinbutton', { name: '추가할 양' });
      await amount.fill('0.25');
      const add = desktop.getByRole('button', { name: /실험실에 추가/ });
      assert(!(await add.isDisabled()), 'desktop: finite add unexpectedly disabled');
      await add.click();
      body = await text(desktop);
      assert(body.includes('0.250 mol'), 'desktop: finite AddSubstance state not visible');

      const actualTemperature = desktop.getByText(/실제 298.1 K \/ 25.0 °C/);
      await actualTemperature.waitFor();
      await desktop.getByRole('spinbutton', { name: '온도' }).fill('37');
      body = await text(desktop);
      assert(body.includes('실제 298.1 K / 25.0 °C'), 'desktop: temperature target teleported actual temperature');
      assert(await desktop.getByRole('checkbox', { name: '온도 제어' }).isChecked(), 'desktop: temperature controller request not enabled');

      await desktop.getByRole('spinbutton', { name: '압력' }).fill('2');
      body = await text(desktop);
      assert(body.includes('실제 1.00 atm'), 'desktop: pressure target overwrote actual pressure');

      await desktop.getByRole('button', { name: /혼합/ }).click();
      await desktop.getByRole('button', { name: /교반/ }).click();
      await desktop.getByRole('button', { name: '타임라인' }).click();
      body = await text(desktop);
      assert(body.includes('Mix request accepted') && body.includes('Stir request accepted'), 'desktop: operation requests missing');

      await desktop.getByRole('button', { name: '상' }).click();
      await desktop.getByRole('img', { name: 'Phase diagram' }).waitFor();
      assert((await text(desktop)).includes('UI-only illustrative fixture'), 'desktop: phase fixture label missing');

      await desktop.getByRole('button', { name: '내 메모' }).click();
      const note = desktop.getByLabel('내 메모');
      await note.fill('관찰 메모 테스트');
      assert((await note.inputValue()) === '관찰 메모 테스트', 'desktop: notes draft failed');

      await desktop.getByRole('button', { name: '분석' }).click();
      body = await text(desktop);
      assert(body.includes('물'), 'desktop: discovery unlock missing');
      await desktop.getByRole('button', { name: '타임라인' }).click();
      assert((await text(desktop)).includes('Identity confirmed: Water'), 'desktop: discovery event missing');

      await desktop.getByRole('checkbox', { name: 'Developer Mode' }).check();
      assert((await text(desktop)).includes('메테인'), 'desktop: Developer Mode access failed');

      await desktop.getByRole('button', { name: '선택 물질 폐기' }).click();
      await desktop.getByRole('button', { name: '폐기 확인' }).click();
      await desktop.getByRole('button', { name: '구성' }).click();
      const compositionRowsAfterDisposal = await desktop.locator('.analysis-body tbody tr').allInnerTexts();
      assert(compositionRowsAfterDisposal.some((row) => row.includes('실험 용기가 비어 있습니다.')), 'desktop: disposal did not clear authoritative composition state');
      await desktop.getByRole('button', { name: '타임라인' }).click();
      assert((await text(desktop)).includes('Disposed H₂ from vessel'), 'desktop: disposal provider event missing');
    }
    await desktop.close();
  }

  const tablet = await openAt(1024, 768);
  let body = await text(tablet);
  assert(body.includes('도감') && body.includes('LAB WORKSPACE') && body.includes('물질 정보'), 'tablet: core workbench surfaces missing');
  await noHorizontalOverflow(tablet, 'tablet');
  await tablet.close();

  const mobile = await openAt(390, 844);
  body = await text(mobile);
  for (const label of ['도감','실험실','정보','조작','메모']) assert(body.includes(label), `mobile: ${label} navigation missing`);
  assert(body.includes('Untitled experiment') && body.includes('주 용기'), 'mobile: lab view should be initial');
  await mobile.getByRole('button',{name:'도감',exact:true}).click();
  assert((await text(mobile)).includes('물질 검색'), 'mobile: catalog view failed');
  await mobile.getByRole('button',{name:'정보',exact:true}).click();
  assert((await text(mobile)).includes('과학 상태'), 'mobile: info view failed');
  await mobile.getByRole('button',{name:'조작',exact:true}).click();
  assert((await text(mobile)).includes('실험 조건'), 'mobile: controls view failed');
  await mobile.getByRole('button',{name:'메모',exact:true}).click();
  await mobile.getByLabel('내 메모').waitFor();
  await noHorizontalOverflow(mobile, 'mobile');
  await mobile.close();

  if (consoleErrors.length) throw new Error(`browser console/page errors:\n${consoleErrors.join('\n')}`);
  globalThis.console.log('UI browser smoke PASS: desktop 1536/1440x900, tablet 1024x768, mobile 390x844');
} finally {
  await browser.close();
}
