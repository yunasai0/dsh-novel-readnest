import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [runtimeArg, homeArg] = process.argv.slice(2);
if (!runtimeArg || !homeArg) throw new Error('Usage: node scripts/validate-fullscreen.mjs <DSH runtime directory> <isolated test DSH_HOME>');
const runtime = resolve(runtimeArg), home = resolve(homeArg);
const require = createRequire(join(root, 'vendor/readest/apps/readest-app/package.json'));
const { chromium, expect } = require('@playwright/test');
const output = join(root, 'dist/fullscreen-validation');
await mkdir(output, { recursive: true });
const child = spawn(process.execPath, [join(runtime, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
  'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
  cwd: runtime, env: { ...process.env, DSH_HOME: home }, windowsHide: true,
});
let logs = '', browser, page;
child.stdout.on('data', chunk => { logs += chunk.toString(); });
child.stderr.on('data', chunk => { logs += chunk.toString(); });
const results = [], errors = [];
const redact = text => text.replace(/([?&]token=)[^\s]+/g, '$1[redacted]');
try {
  const url = await new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => { clearInterval(poll); reject(new Error('DSH start timeout')); }, 45000);
    const poll = setInterval(() => {
      const match = logs.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/);
      if (match) { clearTimeout(timer); clearInterval(poll); resolveUrl(match[0]); }
    }, 100);
    child.once('exit', code => { clearTimeout(timer); clearInterval(poll); reject(new Error('DSH exited ' + code)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(12000);
  await page.goto(url);
  await page.getByText('继续', { exact: true }).click({ timeout: 2000 }).catch(() => {});
  await page.getByText('小说阅读', { exact: true }).first().click();
  const frame = page.frameLocator('iframe[title="Readest 小说书库"]');
  const panel = page.locator('[data-dsh-reader-root]');
  const toggle = async () => {
    await frame.getByRole('button', { name: /设置菜单|Settings Menu/ }).click();
    await frame.getByText(/^(全屏显示|Fullscreen)$/).click();
  };
  const platform = async (name, nativeFullscreen = false) => page.evaluate(({ name, nativeFullscreen }) => {
    const html = document.documentElement;
    html.dataset.platform = name;
    html.toggleAttribute('data-fullscreen', nativeFullscreen);
    html.toggleAttribute('data-windows-titlebar', name === 'win32');
    html.style.setProperty('--dsh-windows-titlebar-height', name === 'win32' ? '32px' : '0px');
    html.style.setProperty('--dsh-frame-top-clearance', name === 'darwin' ? '48px' : name === 'win32' ? '32px' : '0px');
    html.style.setProperty('--dsh-frame-chrome-top', name === 'win32' && !nativeFullscreen ? '32px' : '0px');
  }, { name, nativeFullscreen });
  const geometry = () => panel.evaluate(element => {
    const rect = element.getBoundingClientRect(), iframe = element.querySelector('iframe');
    const frameRect = iframe.getBoundingClientRect();
    return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right,
      frameTop: frameRect.top, frameBottom: frameRect.bottom,
      topCovered: element.contains(document.elementFromPoint(267, 20)),
      paper: getComputedStyle(element).backgroundColor,
      dragHeight: getComputedStyle(element, '::before').height };
  });
  await platform('darwin');
  await toggle();
  await expect(panel).toHaveAttribute('data-dsh-reader-fullscreen', '');

  if (process.env.FULLSCREEN_COMPARE_BETA12 === '1') {
    const previous = execFileSync('git', ['show', 'v0.2.0-beta.12:src/companion-style.ts'], { cwd: root, encoding: 'utf8' });
    const oldStyle = previous.slice(previous.indexOf('`') + 1, previous.lastIndexOf('`'));
    const currentStyle = await panel.locator('style').textContent();
    await panel.locator('style').evaluate((element, css) => { element.textContent = css; }, oldStyle);
    const before = await geometry();
    assert.equal(before.top, 48); assert.equal(before.topCovered, false);
    await page.screenshot({ path: join(output, 'mac-window-before.png') });
    await panel.locator('style').evaluate((element, css) => { element.textContent = css; }, currentStyle);
    results.push({ case: 'beta12-gap-reproduced', ...before });
  }
  for (const [name, nativeFullscreen, top, frameTop] of [
    ['darwin', false, 0, 48], ['darwin', true, 0, 0], ['darwin', false, 0, 48],
    ['win32', false, 32, 32], ['win32', true, 32, 32], ['browser', false, 0, 0],
  ]) {
    await platform(name, nativeFullscreen);
    await expect.poll(async () => (await geometry()).frameTop).toBe(frameTop);
    const value = await geometry();
    assert.equal(value.top, top); assert.equal(value.left, 0); assert.equal(value.right, 1280);
    assert.equal(value.bottom, 820); assert.equal(value.frameBottom, 820);
    if (name === 'darwin') {
      assert.equal(value.topCovered, true);
      assert.equal(value.dragHeight, nativeFullscreen ? '0px' : '48px');
    }
    results.push({ case: name + (nativeFullscreen ? '-native-fullscreen' : '-window'), ...value });
    await page.screenshot({ path: join(output, name + (nativeFullscreen ? '-fullscreen' : '-window') + '.png') });
  }
  await platform('darwin');
  const light = (await geometry()).paper;
  const libraryPaper = () => frame.locator('.library-page').evaluate(element => getComputedStyle(element).backgroundColor);
  assert.equal(light, await libraryPaper());
  await frame.locator('html').evaluate(element => { element.dataset.theme = 'default-dark'; });
  await expect.poll(async () => (await geometry()).paper).not.toBe(light);
  assert.equal((await geometry()).paper, await libraryPaper());
  results.push({ case: 'theme-synchronized', light, dark: (await geometry()).paper });
  await page.screenshot({ path: join(output, 'mac-window-dark.png') });
  await platform('browser');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await geometry();
  assert.equal(mobile.top, 0); assert.equal(mobile.right, 390); assert.equal(mobile.frameBottom, 844);
  results.push({ case: 'narrow-browser', ...mobile });
  await toggle();
  await expect(panel).not.toHaveAttribute('data-dsh-reader-fullscreen');
  await expect(panel).toHaveCSS('position', 'relative');

  await page.setViewportSize({ width: 1280, height: 820 });
  await platform('darwin', true);
  await toggle();
  await frame.getByRole('button', { name: '导入书籍', exact: true }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await frame.getByText('从本地文件导入', { exact: true }).click();
  await (await chooser).setFiles({ name: '全屏主题验证.txt', mimeType: 'text/plain',
    buffer: Buffer.from('第一章 窗边\n\n' + '这是检查阅读主题与全屏边缘是否一致的测试正文。\n'.repeat(80)) });
  await frame.getByText('全屏主题验证', { exact: true }).first().click();
  await frame.locator('foliate-view').waitFor();
  const readerPaper = await frame.locator('.header-bar').first().evaluate(element => getComputedStyle(element).backgroundColor);
  await expect.poll(async () => (await geometry()).paper).toBe(readerPaper);
  assert.equal((await geometry()).frameTop, 0);
  results.push({ case: 'library-to-reader-theme', paper: readerPaper });
  await page.screenshot({ path: join(output, 'mac-fullscreen-reader.png') });
  assert.deepEqual(errors, []);
  const report = { status: 'passed', results, errors,
    note: 'Actual DSH and built plugin in Chrome; macOS/Windows window attributes and titlebar metrics are simulated. Native macOS window controls require a Mac device check.' };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  await page?.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  const theme = await page?.locator('iframe[title="Readest 小说书库"]').evaluate(iframe => {
    const doc = iframe.contentDocument, view = iframe.contentWindow;
    return { parent: iframe.parentElement.getAttribute('style'), html: doc.documentElement.outerHTML.slice(0, 350),
      colors: [doc.querySelector('main'), doc.documentElement, doc.body, doc.elementFromPoint(20, 20)].filter(Boolean).map(element => ({
        tag: element.tagName, className: element.className, bg: view.getComputedStyle(element).backgroundColor,
        image: view.getComputedStyle(element).backgroundImage, base: view.getComputedStyle(element).getPropertyValue('--color-base-100'),
      })) };
  }).catch(() => null);
  console.error(JSON.stringify({ error: error.message, errors, theme, logs: redact(logs).slice(-3000) }));
  process.exitCode = 1;
} finally {
  await browser?.close(); child.kill();
}
