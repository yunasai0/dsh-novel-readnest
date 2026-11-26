import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [runtime, archive] = process.argv.slice(2).map(path => resolve(path));
if (!runtime || !archive) {
  throw new Error('Usage: node scripts/validate-dsh-compatibility.mjs <DSH runtime directory> <plugin archive>');
}

const requireRuntime = createRequire(join(runtime, 'package.json'));
const cli = requireRuntime.resolve('@deepseek-ai/dsh/lib/bin.js');
const { evaluatePluginCompatibility, getDshRuntimeVersion, readPluginMeta } =
  await import(pathToFileURL(requireRuntime.resolve('@deepseek-ai/dsh-app-boot')).href);
const version = getDshRuntimeVersion();
const scratchRoot = await realpath(tmpdir());
const dshHome = await mkdtemp(join(scratchRoot, 'readnest-compat-'));
const env = { ...process.env, DSH_HOME: dshHome, DSH_AGENTS_HOME: join(dshHome, 'fixture-agents') };
const redact = value => value.replace(/([?&]token=)[^\s]+/g, '$1[redacted]');

let child, closed, startupLog = '';
try {
  const install = spawnSync(process.execPath, [cli, 'plugin', '--profile', 'web', 'add', archive], {
    cwd: runtime, env, encoding: 'utf8', timeout: 120000, windowsHide: true,
  });
  if (install.error) throw install.error;
  assert.equal(install.status, 0, redact((install.stdout ?? '') + (install.stderr ?? '')));

  const profile = join(dshHome, 'profiles/web');
  const manifest = requireRuntime(join(profile, 'node_modules/dsh-novel-readnest/package.json'));
  const metadata = readPluginMeta(manifest.name, pathToFileURL(join(profile, 'package.json')).href);
  assert(metadata && !metadata.error, metadata?.error ?? 'The installed plugin card has no metadata');
  for (const language of ['en', 'zh']) {
    assert(metadata.title?.[language]?.trim(), `Missing ${language} card title`);
    assert(metadata.description?.[language]?.trim(), `Missing ${language} card description`);
  }
  assert.match(metadata.icon ?? '', /^data:image\/(?:webp|png|jpeg|svg\+xml);base64,/);
  const { engines, ...peerManifest } = manifest;
  // Later numbers here exercise range semantics. They need not be published DSH versions.
  const allowed = ['0.2.1-rc.2', '0.2.1-rc.5', '0.2.1', '0.2.2-rc.1', '0.2.2-rc.2', '0.2.2-rc.3',
    '0.2.2-rc.50', '0.2.2', '0.2.3-rc.1', '0.2.5', '0.2.10-rc.1'];
  const rejected = ['0.2.0', '0.2.1-rc.1', '0.2.2-alpha.3', '0.3.0-0', '0.3.0-rc.1', '0.3.0', '1.0.0'];
  assert(engines?.dsh, 'The packaged plugin must declare a DSH range');
  for (const manifestToCheck of [manifest, peerManifest]) {
    for (const compatible of [version, ...allowed]) {
      assert.equal(evaluatePluginCompatibility(manifestToCheck, {}, compatible), undefined, `DSH ${compatible} should load this plugin`);
    }
    for (const incompatible of rejected) {
      assert(evaluatePluginCompatibility(manifestToCheck, {}, incompatible), `DSH ${incompatible} should fall outside the range`);
    }
  }

  child = spawn(process.execPath, [cli, 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'],
    { cwd: runtime, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  closed = once(child, 'close');
  const url = await new Promise((ready, fail) => {
    const timeout = setTimeout(() => fail(new Error('Timed out waiting for DSH to start')), 45000);
    child.once('close', code => { clearTimeout(timeout); fail(new Error(`DSH exited during startup (${code})`)); });
    child.once('error', error => { clearTimeout(timeout); fail(error); });
    const collect = chunk => {
      startupLog = (startupLog + chunk).slice(-16000);
      const match = startupLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+/);
      if (match) {
        clearTimeout(timeout);
        ready(match[0]);
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
  });

  const initial = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  const cookie = initial.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
  await initial.body?.cancel();
  const library = await fetch(new URL('/novel-reader/library', url), {
    headers: { cookie }, redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  assert.equal(library.status, 200, 'DSH did not serve the installed plugin library');
  assert.match(await library.text(), /\/novel-reader\/_next\//, 'The library response is missing reader assets');
  // Exercise public install discovery through the actual profile, independent of developer-home skills.
  const skillDir = join(dshHome, 'skills', 'reader-qa-illustration');
  await mkdir(join(skillDir, 'scripts'), { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), '---\nname: reader-qa-illustration\ndescription: Illustrated novel fixture\n---\nPaint the requested scene.');
  await writeFile(join(skillDir, 'scripts', 'ink.py'), '# --prompt and --out-dir fixture');
  const post = async (op, extra = {}) => {
    const r = await fetch(new URL('/novel-reader/companion-bridge', url), {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ op, session: 'fixture-session-123', token: 'fixture-token-123', book: 'fixture-book-123', instance: 'fixture-instance-123', ...extra }),
      signal: AbortSignal.timeout(12000),
    });
    const payload = await r.json(); assert.equal(r.status, 200, JSON.stringify(payload)); return payload;
  };
  const settings = async (body) => {
    const r = await fetch(new URL('/novel-reader/companion-skills', url), {
      method: body ? 'POST' : 'GET', headers: {cookie, 'content-type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000),
    });
    const payload = await r.json(); assert.equal(r.status, 200, JSON.stringify(payload)); return payload;
  };
  const catalog = await settings();
  const found = catalog.skills.find(s => s.name === 'reader-qa-illustration');
  assert.ok(found, 'Expected the skill installed in this DSH_HOME');
  const choice = { name: found.name, key: found.key, tool: '' };
  await settings({ op: 'check', choice });
  await post('hello');
  await post('skill-select', { id: 'fixture-prompt-123', choice });
  const scripts = await settings({ op: 'scripts', choice });
  assert.equal(scripts.length, 1); assert(!JSON.stringify(scripts).includes(skillDir));
  await post('skill-select', { id: 'fixture-prompt-456', choice: { ...choice, tool: scripts[0].id } });
  await post('skill-select', { choice: null }); await post('close');
  if (process.env.READEST_CHECK_SKILL_UI === '1') {
    await checkSettingsPage(url, found, scripts[0]);
  }
  console.log(`DSH ${version}: ${manifest.name}@${manifest.version} passed the compatibility, installation, startup and library checks.`);
} catch (error) {
  if (startupLog) console.error(redact(startupLog).trimEnd());
  throw error;
} finally {
  if (child) child.kill();
  if (closed) await closed.catch(() => {});
  if (dirname(dshHome) === scratchRoot && (await lstat(dshHome)).isDirectory() && await realpath(dshHome) === dshHome) {
    await rm(dshHome, { recursive: true, force: true });
  }
}

// Optional browser pass: the preset configuration must work from an empty library.
async function checkSettingsPage(url, skill, script) {
  const require = createRequire(new URL('../vendor/readest/apps/readest-app/package.json', import.meta.url));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 900 } });
    await page.goto(url);
    await page.goto(new URL('/novel-reader/library', url).href);
    const open = async () => {
      await page.getByRole('button', { name: '设置菜单', exact: true }).click();
      await page.getByText('设置', { exact: true }).last().click();
      await page.getByTitle('Agent 预设', { exact: true }).click();
    };
    await open();
    const picker = page.getByLabel('已安装的 Skills');
    await picker.selectOption(skill.key);
    await page.getByLabel('生图入口（可选）').selectOption(script.id);
    await page.getByRole('button', { name: '保存技能设置' }).click();
    await page.getByText('已配置 ' + skill.name, { exact: false }).waitFor();
    const personas = page.getByRole('combobox', { name: '当前人设', exact: true });
    const previous = await personas.inputValue();
    const other = await personas.locator('option').evaluateAll((rows, prev) => rows.map(r => r.value).find(id => id !== prev), previous);
    await personas.selectOption(other); assert.equal(await picker.inputValue(), '');
    await personas.selectOption(previous); assert.equal(await picker.inputValue(), skill.key);
    await page.reload(); await open();
    await page.getByText('已配置 ' + skill.name, { exact: false }).waitFor();
    if (process.env.READEST_SKILL_SCREENSHOT) {
      await page.getByText('陪读技能', { exact: true }).evaluate(n => n.scrollIntoView({ block: 'start' }));
      await page.getByRole('dialog').last().screenshot({ path: process.env.READEST_SKILL_SCREENSHOT });
    }
    await page.getByRole('button', { name: '停用技能' }).click();
    await page.getByText('未启用技能', { exact: false }).waitFor();
    console.log('Settings UI: automatic detection, script binding, independent personas, reload and disable passed.');
  } finally { await browser.close(); }
}
