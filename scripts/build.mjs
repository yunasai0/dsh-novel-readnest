import { spawnSync } from 'node:child_process';
import { cp, copyFile, lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const readestWorkspace = join(root, 'vendor', 'readest');
const readestApp = join(readestWorkspace, 'apps', 'readest-app');
const requireReadest = createRequire(join(readestApp, 'package.json'));
const env = {
  ...process.env,
  HUSKY: '0',
  NEXT_PUBLIC_DSH_STATIC_READER: '1',
  NEXT_PUBLIC_DSH_READER_PATH: '/novel-reader',
  NEXT_PUBLIC_APP_PLATFORM: 'web',
  NEXT_TELEMETRY_DISABLED: '1',
  GOMAXPROCS: process.env.GOMAXPROCS ?? '2',
  GOMEMLIMIT: process.env.GOMEMLIMIT ?? '768MiB',
  RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS ?? '2',
};

const pnpm = process.env.npm_execpath;
if (!pnpm || !/^pnpm\.(?:c?js|mjs)$/.test(pnpm.split(/[\\/]/).at(-1))) {
  throw new Error('Run this build with pnpm run build.');
}

function run(cwd, args, overrides = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env: { ...env, ...overrides },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed (${result.status ?? result.signal})`);
}

function runPnpm(cwd, ...args) {
  run(cwd, [pnpm, ...args]);
}

runPnpm(readestWorkspace, 'install', '--frozen-lockfile', '--ignore-scripts');
runPnpm(readestWorkspace, '--filter', '@readest/readest-app', 'exec', 'tsc', '--noEmit');
runPnpm(root, 'run', 'check');
runPnpm(root, 'exec', 'tsdown');
runPnpm(readestWorkspace, '--filter', '@readest/readest-app', 'setup-vendors');

const vendorAssets = join(readestApp, 'public', 'vendor');
await mkdir(vendorAssets, { recursive: true });
await copyFile(
  requireReadest.resolve('sql.js/dist/sql-wasm-browser.wasm'),
  join(vendorAssets, 'sql-wasm-browser.wasm'),
);
const windows = process.platform === 'win32';
run(
  readestApp,
  [
    ...(windows ? ['--max-old-space-size=4096'] : []),
    requireReadest.resolve('next/dist/bin/next'),
    'build',
    '--webpack',
  ],
  windows ? { NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=3072' } : {},
);

const destination = join(root, 'reader');
const existing = await lstat(destination).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (existing) {
  if (!existing.isDirectory() || existing.isSymbolicLink() || (await realpath(destination)) !== destination) {
    throw new Error('Expected reader/ to be a local build directory.');
  }
  await rm(destination, { recursive: true, force: true });
}
await cp(join(readestApp, 'out'), destination, { recursive: true });
