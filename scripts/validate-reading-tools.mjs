import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apply as host } from '../lib/host.mjs';
import { apply as agentPlugin } from '../lib/agent.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(join(root, 'vendor/readest/apps/readest-app/package.json'));
const { chromium, expect } = require('@playwright/test');
const output = join(root, 'dist/reading-tools-validation');
await mkdir(output, { recursive: true });
const events = [];
const session = { id: 'validation-session', get seq() { return events.length; }, eventAt: (seq) => events[seq] };
const tools = new Map(), listeners = new Map(), routes = [];
let bridge, cleanup, contextText;
host({ agents: { get: (id) => id === session.id ? { session } : undefined },
  connection: { admit: () => ({ peer: {} }) }, effect(fn) { cleanup = fn(); },
  provide(name, value) { if (name === 'novelReader') bridge = value; return () => {}; },
  webServer: { register(route) { routes.push(route); return () => {}; } } });
agentPlugin({ novelReader: bridge, tools: { register(tool) { tools.set(tool.name, tool); return () => {}; } },
  systemPrompt: { section: () => () => {}, suppressRuntimeContext: () => () => {}, context(spec) { contextText = spec.text; return () => {}; } },
  on(event, fn) { listeners.set(event, fn); return () => {}; } });
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<body style="margin:0"><div data-dsh-reader-root style="height:100vh"><iframe title="Reader" src="/novel-reader/library" style="width:100%;height:100%;border:0"></iframe></div>');
    return;
  }
  const route = routes.find((r) => r.kind === 'exact' ? r.path === req.url?.split('?')[0] : req.url?.startsWith(r.path));
  if (route) await route.handler(req, res); else res.writeHead(404).end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12000);
const frame = page.frameLocator('iframe[title="Reader"]');
const errors = [], results = [];
page.on('pageerror', (error) => errors.push(error.message));
let identity, turn = 0, calls = 0, pumpController, pump;
const post = async (op, fields = {}, signal) => {
  const response = await fetch(url + '/novel-reader/companion-bridge', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...identity, op, ...fields }), signal });
  if (op === 'reply' && response.status === 404) return null;
  assert.equal(response.status, 200, op + ' failed');
  return response.json();
};
const ask = (type, fields = {}) => page.evaluate(({ type, fields, book }) => new Promise((resolve, reject) => {
  const id = fields.id ?? crypto.randomUUID();
  const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Reader reply timeout')); }, 10000);
  function receive(event) {
    if (event.data?.id === id && ['book-reply', 'book-snapshot-reply'].includes(event.data.type)) {
      clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data.value);
    }
  }
  window.addEventListener('message', receive);
  document.querySelector('iframe').contentWindow.postMessage({ channel: 'readest-companion-v1', type, book, id, ...fields }, location.origin);
}), { type, fields, book: identity.book });
const startPump = () => {
  pumpController = new AbortController();
  pump = (async () => {
    try {
      while (!pumpController.signal.aborted) {
        const request = await post('poll', {}, pumpController.signal);
        if (!request || request.type === 'sync-state') continue;
        const value = await ask('book-query', request);
        await post('reply', { id: request.id, value }, pumpController.signal);
      }
    } catch (error) { if (!pumpController.signal.aborted) throw error; }
  })();
};
const stopPump = async () => { pumpController?.abort(); await pump; };
const append = (type, data) => {
  const event = JSON.parse(JSON.stringify({ type, data }));
  events.push(event); listeners.get('session/event')?.(session, event);
};
async function begin() {
  const snapshot = await ask('book-snapshot');
  assert(snapshot?.reading && snapshot.indexVersion, 'Missing reading snapshot');
  const id = 'submission-' + ++turn;
  append('turn/start', { turn });
  await post('prepare', { id, snapshot, protectedReading: true });
  const decision = await listeners.get('agent/pre-step')({ agent: { session }, turn }, async () => ({ kind: 'enter', messages: [{ source: { kind: 'user', rpcId: id } }] }));
  assert.equal(decision.kind, 'enter');
  const text = contextText({ agent: { session } });
  assert(!text.includes('【正文标记'), 'Text was automatically injected');
  append('user/message', { source: { kind: 'runtime-context' }, content: [{ type: 'text', text }] });
  return snapshot;
}
async function call(name, args = {}) {
  const tool = tools.get(name), callId = 'call-' + ++calls;
  assert(tool, name);
  append('tool/call', { turn, name, callId });
  const value = await tool.execute(args, { agent: { session }, signal: AbortSignal.timeout(15000), callId,
    rootCallId: callId, token: Symbol(callId), deferContext() {}, concludeTurn() {} });
  append('tool/result', { turn, message: { callId, content: tool.output.render(args, value) },
    meta: tool.output.presentationMeta?.(args, value) });
  return value;
}
function finish() {
  append('assistant/message', { turn, message: { content: [{ type: 'text', text: '测试驱动模拟成功回复，不调用模型服务。' }] } });
  append('turn/end', { turn, reason: { kind: 'completed' } });
}
const normalize = (value) => value.replace(/\s/g, '');

try {
  await page.goto(url);
  await frame.getByRole('button', { name: '导入书籍', exact: true }).first().click();
  const chooser = page.waitForEvent('filechooser');
  await frame.getByText('从本地文件导入', { exact: true }).click();
  const chapters = Array.from({ length: 8 }, (_, i) => '第' + (i + 1) + '章 工具验证\n\n' +
    Array.from({ length: 24 }, (_, p) => '【正文标记CH' + (i + 1) + '-P' + p + '】' + '这是一段用于定位验证的小说正文，人物沿着山路继续前进。'.repeat(20)).join('\n\n'));
  await (await chooser).setFiles({ name: '伴读工具验证.txt', mimeType: 'text/plain', buffer: Buffer.from(chapters.join('\n\n')) });
  await frame.getByText('伴读工具验证', { exact: true }).first().click();
  await frame.locator('foliate-view').waitFor();
  await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith('dsh.novel-reader.furthest.')), { timeout: 12000 });
  const book = await page.evaluate(() => Object.keys(localStorage).find((key) => key.startsWith('dsh.novel-reader.furthest.'))?.slice('dsh.novel-reader.furthest.'.length));
  assert(book);
  identity = { book, session: session.id, token: 'validation-token', instance: 'validation-instance' };
  const initial = await ask('book-snapshot');
  await post('hello', { indexVersion: initial.indexVersion });
  startPump();
  await begin();
  const current = await call('read_current');
  assert(current.chapters?.some((chapter) => chapter.text.includes('【正文标记CH1')));
  assert(current.budget.returned_chars < 6000);
  assert.equal(bridge.state(session.id).covered.length, 0);
  finish();
  const firstCheckpoint = bridge.state(session.id).covered.at(-1).end;
  results.push({ case: 'current', characters: current.budget.returned_chars, committedAfterReply: true });

  for (let i = 0; i < 3; i++) await frame.locator('foliate-view').evaluate((view) => view.next());
  await begin();
  const incremental = await call('sync_reading');
  assert(incremental.budget.returned_chars > 0);
  assert.deepEqual(incremental.source.sync.delivered[0].start, firstCheckpoint);
  finish();
  results.push({ case: 'incremental', characters: incremental.budget.returned_chars, startsAtPreviousCheckpoint: true });

  await frame.getByText('第5章 工具验证', { exact: true }).first().click();
  await expect.poll(async () => (await ask('book-snapshot'))?.reading?.chapter_number).toBe(5);
  await begin();
  const jumped = await call('sync_reading');
  assert(jumped.sync.has_gaps);
  assert(jumped.chapters.every((chapter) => [1, 5].includes(chapter.chapter_number)));
  finish();
  const checkpointBeforeManualRead = JSON.stringify(bridge.state(session.id).covered);
  results.push({ case: 'jump', hasGaps: true, skippedChaptersNotLoaded: true });

  await begin();
  const firstBatch = await call('read_chapters', { start: 1, end: 4 });
  assert.equal(firstBatch.budget.returned_chars, 30000);
  assert.equal(firstBatch.next_call.when, 'next_turn');
  const blocked = await call('read_current');
  assert.equal(blocked.budget.returned_chars, 0);
  finish();
  assert.equal(JSON.stringify(bridge.state(session.id).covered), checkpointBeforeManualRead);
  await stopPump(); await post('close');
  identity.instance = 'validation-instance-two';
  await post('hello', { indexVersion: initial.indexVersion }); startPump();
  await begin();
  const remainder = await call('continue_reading', { cursor: firstBatch.next_cursor });
  assert.equal(remainder.stop_reason, 'completed');
  const combined = [...firstBatch.chapters, ...remainder.chapters].map((chapter) => chapter.text).join('');
  assert.equal(normalize(combined), normalize(chapters.slice(0, 4).join('')));
  const invalid = await call('read_chapters', { start: '第一章' });
  assert.equal(invalid.error.code, 'INVALID_ARGUMENTS');
  const spoiler = await call('read_chapters', { start: 8 });
  assert.equal(spoiler.stop_reason, 'spoiler_limit');
  assert(spoiler.end_notice.includes('用户尚未读到'));
  assert(!spoiler.next_cursor);
  finish();
  results.push({ case: 'continuation', reconnectRecovered: true, completeTextMatches: true, budgetShared: true });
  results.push({ case: 'errors', structuredParameterError: true, spoilerNotice: true, noSpoilerContinuation: true });
  await stopPump(); await post('close');
  const oldBook = identity.book;
  await page.goto(url);
  await frame.getByRole('button', { name: '导入书籍', exact: true }).first().click();
  const tinyChooser = page.waitForEvent('filechooser');
  await frame.getByText('从本地文件导入', { exact: true }).click();
  const tiny = Array.from({ length: 8 }, (_, i) => '第' + (i + 1) + '章 短章\n\n' + '这是跨文件双页定位的测试正文。'.repeat(5)).join('\n\n');
  await (await tinyChooser).setFiles({ name: '跨文件可见范围.txt', mimeType: 'text/plain', buffer: Buffer.from(tiny) });
  await frame.getByText('跨文件可见范围', { exact: true }).first().click();
  await frame.locator('foliate-view').waitFor();
  await page.waitForFunction((old) => Object.keys(localStorage).some((key) =>
    key.startsWith('dsh.novel-reader.furthest.') && !key.endsWith(old)), oldBook);
  identity.book = await page.evaluate((old) => Object.keys(localStorage).find((key) =>
    key.startsWith('dsh.novel-reader.furthest.') && !key.endsWith(old)).slice('dsh.novel-reader.furthest.'.length), oldBook);
  let spreadVerified = false;
  for (let i = 0; i < 5; i++) {
    const visible = await frame.locator('foliate-view').evaluate((view) => view.renderer.getVisibleRanges().map((item) => item.index));
    if (new Set(visible).size > 1) {
      const captured = await ask('book-snapshot');
      assert(captured.reading.start.section <= Math.min(...visible));
      assert(captured.reading.end.section >= Math.max(...visible));
      spreadVerified = true; results.push({ case: 'cross-file-spread', visibleFiles: [...new Set(visible)], capturedAll: true });
      break;
    }
    await frame.locator('foliate-view').evaluate((view) => view.next());
  }
  assert(spreadVerified, 'No cross-file spread was validated');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(output, 'reader.png') });
  await writeFile(join(output, 'report.json'), JSON.stringify({ tools: [...tools.keys()], results, errors,
    note: 'Uses the actual built reader and tools. Session completion is simulated; no model service is called.' }, null, 2));
  console.log(JSON.stringify({ status: 'passed', results }));
} catch (error) {
  const diagnostics = await frame.locator('foliate-view').evaluate((view) => ({
    visible: view.renderer?.getVisibleRanges?.().map((item) => ({ index: item.index, chars: item.range.toString().length })),
    loaded: view.renderer?.getContents?.().map((item) => item.index),
  })).catch(() => null);
  await writeFile(join(output, 'failure.json'), JSON.stringify({ message: error.message, errors, diagnostics }, null, 2));
  console.error(JSON.stringify({ message: error.message, errors, diagnostics }));
  throw error;
} finally {
  await stopPump().catch(() => {});
  await browser.close(); cleanup?.(); server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
