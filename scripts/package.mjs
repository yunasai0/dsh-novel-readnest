import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm || basename(npm) !== 'npm-cli.js') {
  throw new Error('Run npm run pack:release.');
}

await access(join(root, 'lib', 'client.cjs'));
await access(join(root, 'reader', 'reader.html'));
const destination = join(root, 'dist');
await mkdir(destination, { recursive: true });
const result = spawnSync(
  process.execPath,
  [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', destination],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || 'npm pack failed.');

const [{ filename, files }] = JSON.parse(result.stdout);
const packedPaths = new Set(files.map((file) => file.path));
const readme = await readFile(join(root, 'README.md'), 'utf8');
for (const match of readme.matchAll(/\]\(([^\s)]+)\)|\b(?:src|href)=["']([^"']+)["']/g)) {
  const target = (match[1] ?? match[2]).split(/[?#]/, 1)[0];
  if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
  const relativePath = posix.normalize(decodeURIComponent(target));
  if (!packedPaths.has(relativePath) && !files.some(file => file.path.startsWith(relativePath + '/'))) {
    throw new Error(`Packaged README references missing file: ${target}`);
  }
}
const archive = join(destination, filename);
const checksum = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive + '.sha256', `${checksum}  ${filename}\n`);
console.log(archive);
console.log(archive + '.sha256');
