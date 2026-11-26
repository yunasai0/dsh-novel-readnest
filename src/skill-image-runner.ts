import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, lstat, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const imageSkillToolName = 'readnest_illustrate';
export interface ScriptEntry { id: string; label: string; path: string }
interface ScriptSource { source: string; path?: string; resourceBase?: { kind: string; path?: string } }
const limit = 256 * 1024;
async function inspectScript(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > limit) return;
  const bytes = await readFile(path);
  const source = bytes.toString('utf8');
  if (!/['"]--prompt['"]/.test(source)) return;
  const output = /['"]--out-dir['"]/.test(source) ? '--out-dir' : /['"]--output-dir['"]/.test(source) ? '--output-dir' : undefined;
  if (!output) return;
  return { output, id: 'script-' + createHash('sha256').update(path).update('\0').update(bytes).digest('hex') };
}
// A workspace can contain untrusted Markdown. Only deliberately installed user skill
// bundles qualify for executable binding, never project roots, virtual providers or URLs.
export async function imageScripts(skill: ScriptSource): Promise<ScriptEntry[]> {
  if (!['user-dsh','user-agents'].includes(skill.source) || !skill.path || basename(skill.path) !== 'SKILL.md') return [];
  const root = await realpath(dirname(skill.path)).catch(() => '');
  if (!root) return [];
  const dir = join(root, 'scripts');
  if (await realpath(dir).catch(() => '') !== dir) return [];
  const names = (await readdir(dir, { withFileTypes: true })).filter(f => f.isFile() && /^[\w.-]+\.py$/i.test(f.name)).slice(0, 40);
  const entries = await Promise.all(names.map(async f => {
    const path = join(dir, f.name);
    const entry = await inspectScript(path).catch(() => undefined);
    return entry ? { id: entry.id, label: '技能脚本 · ' + f.name, path } : undefined;
  }));
  return entries.filter((s): s is ScriptEntry => !!s);
}
async function python() {
  const windows = process.platform === 'win32';
  for (const executable of windows ? ['python.exe','py.exe'] : ['python3','python']) {
    for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
      if (!isAbsolute(dir)) continue;
      const path = join(dir, executable);
      if (await access(path, constants.X_OK).then(() => true, () => false)) {
        return { path, args: executable === 'py.exe' ? ['-3'] : [] };
      }
    }
  }
  throw new Error('运行 DSH 的设备未找到 Python 3。');
}
export async function renderSkillImage(script: ScriptEntry, prompt: string, signal: AbortSignal) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('画面描述应为 1 至 4000 个字符。');
  const entry = await inspectScript(script.path).catch(() => undefined);
  if (!entry || entry.id !== script.id) throw new Error('技能脚本已变化，请在陪读技能中重新选择。');
  const interpreter = await python();
  signal.throwIfAborted();
  const out = await mkdtemp(join(tmpdir(), 'readnest-illustration-'));
  try {
    try {
      await exec(interpreter.path, [...interpreter.args, script.path, '--prompt=' + prompt, entry.output + '=' + out], {
        shell: false, cwd: out, windowsHide: true, signal, timeout: 300_000, maxBuffer: 2 * 1024 * 1024,
      });
    } catch {
      signal.throwIfAborted();
      throw new Error('生图脚本运行失败或超时，请在 DSH 主机上检查该技能的依赖和服务登录状态。');
    }
    signal.throwIfAborted();
    const files = (await readdir(out, { withFileTypes: true })).filter(f => f.isFile() && /\.(png|jpe?g|webp)$/i.test(f.name));
    if (files.length !== 1) throw new Error('技能必须在输出目录生成一张 PNG、JPEG 或 WebP 图片。');
    const path = join(out, files[0]!.name);
    const stat = await lstat(path);
    if (!stat.isFile() || !stat.size || stat.size > 24 * 1024 * 1024) throw new Error('生成结果为空或超过 24 MiB。');
    const ext = extname(path).toLowerCase();
    const mediaType = ext === '.png' ? 'image/png' as const : ext === '.webp' ? 'image/webp' as const : 'image/jpeg' as const;
    return { data: await readFile(path), mediaType, name: '小说插画' + ext };
  } finally { await rm(out, { recursive: true, force: true }); }
}
