import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
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
const env = { ...process.env, DSH_HOME: dshHome };
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
