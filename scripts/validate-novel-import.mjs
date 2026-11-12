import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { resolve, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../lib/host.mjs';

// Runs the real built reader in a fresh browser context; never edits the input book.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(join(root, 'vendor/readest/apps/readest-app/package.json'));
const { chromium } = require('playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { JSDOM } = require('jsdom');
const input = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/validate-novel-import.mjs <novel.txt> [modes] [output-dir]');
const modes = (process.argv[3] ?? 'original,clean,missing,numbers,toc,glued,duplicate,newlines,unheaded').split(',');
const output = resolve(process.argv[4] ?? join(root, 'dist/novel-validation'));
await mkdir(output, { recursive: true });
const raw = await readFile(input);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
let encoding = 'utf-8';
let original;
try { original = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
catch { encoding = 'gb18030'; original = new TextDecoder(encoding, { fatal: true }).decode(raw); }
const heading = /^[\t \u3000]*[☆★◇◆●○、 \t]*(第[0-9零〇一二两兩三四五六七八九十百千万萬]+[章回][^\r\n]{0,100})[\t ]*$/;
const lines = original.split(/\r\n|\r|\n/);
const headingLines = lines.flatMap((line, i) => {
  const found = line.match(heading);
  return found ? [{ line: i, title: found[1].trim() }] : [];
});
const clean = [...lines];
headingLines.forEach(({ line, title }) => { clean[line] = title; });
const cleanTitle = (text) => text.replace(/^[☆★◇◆●○、 \t]+/, '').replace(/\s+/gu, ' ').trim();
const bodyForm = (text) => text.replace(/<!--.*?-->/gs, '').replace(/-{8,}|_{8,}/g, '').replace(/\s+/gu, '');

function variant(mode) {
  const changed = [...clean];
  let expected = headingLines.map(({ title }) => title);
  if (mode === 'original') return { buffer: raw, text: original, expected };
  if (mode === 'unheaded') {
    headingLines.forEach(({ line }) => { changed[line] = ''; });
    expected = [];
  } else if (mode === 'missing') {
    headingLines.forEach(({ line }, i) => { if (i % 7 === 6) changed[line] = ''; });
    expected = expected.filter((_, i) => i % 7 !== 6);
  } else if (mode === 'numbers') {
    headingLines.forEach(({ line, title }, i) => {
      changed[line] = title.replace(/^第[^章回]+(?=[章回])/, i % 4 === 0 ? '第1' : i % 9 === 0 ? '第' + (1000 - i) : '$&');
    });
    expected = headingLines.map(({ line }) => changed[line]);
  } else if (mode === 'toc') {
    changed.unshift('目录', ...expected, '', '正文开始', '');
  } else if (mode === 'glued') {
    headingLines.forEach(({ line }, i) => {
      if (i % 6 !== 5) return;
      let next = line + 1;
      while (next < changed.length && !changed[next].trim()) next++;
      changed[line] += ' ' + (changed[next] ?? '');
      if (next < changed.length) changed[next] = '';
    });
  } else if (mode === 'duplicate') {
    const at = Math.min(20, headingLines.length - 2);
    const from = headingLines[at].line;
    const end = headingLines[at + 1].line;
    changed.splice(end, 0, ...changed.slice(from, end));
    expected.splice(at + 1, 0, expected[at]);
  } else if (mode === 'newlines') {
    const text = changed.map((line, i) => line + (i % 3 === 0 ? '\r' : i % 3 === 1 ? '\r\n' : '\n')).join('');
    return { buffer: Buffer.from(text), text, expected };
  } else if (mode !== 'clean') throw new Error('Unknown mode: ' + mode);
  const text = changed.join('\n');
  return { buffer: Buffer.from(text), text, expected };
}

const routes = [];
const uploaded = new Map();
let cleanup;
apply({ agents: { get() {} }, connection: { admit() { return { peer: {} }; } }, provide() { return () => {}; },
  effect(fn) { cleanup = fn(); }, webServer: { register(route) { routes.push(route); return () => {}; } } });
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<body style="margin:0"><div data-dsh-reader-root style="height:100vh"><iframe title="Reader" src="/novel-reader/library" style="width:100%;height:100%;border:0"></iframe></div>');
    return;
  }
  if (req.method === 'POST' && req.url?.startsWith('/__validation/')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    uploaded.set(req.url.slice('/__validation/'.length), Buffer.concat(chunks));
    res.writeHead(204).end();
    return;
  }
  const route = routes.find((r) => r.kind === 'exact' ? r.path === req.url?.split('?')[0] : req.url?.startsWith(r.path));
  if (route) await route.handler(req, res);
  else res.writeHead(404).end();
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = 'http://127.0.0.1:' + server.address().port;
const report = { input: basename(input), bytes: raw.length, characters: original.length, encoding,
  originalSha256: sha256(raw), referenceHeadings: headingLines.length,
  integrityNormalization: 'Ignore layout whitespace, HTML comments and separator runs of 8+ dashes/underscores; compare SHA256 of all remaining text.', cases: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const dom = new JSDOM('');

async function storedFiles(page) {
  const files = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('AppFileSystem');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('files')) { db.close(); resolve(null); return; }
      const tx = db.transaction('files', 'readonly');
      const read = tx.objectStore('files').getAll();
      read.onsuccess = () => {
        const index = read.result.find((file) => file.path.endsWith('/novel-index.json'));
        const epub = read.result.find((file) => file.path.endsWith('.epub'));
        resolve(index && epub ? { indexText: index.content, epubPath: epub.path } : null);
        db.close();
      };
      read.onerror = () => reject(read.error);
    };
  }));
  return files ? { index: JSON.parse(files.indexText), epubPath: files.epubPath } : null;
}
async function askReader(page, book, type, fields = {}) {
  return page.evaluate(({ book, type, fields }) => new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Reader response timeout')); }, 12000);
    function receive(event) {
      if (event.data?.id === id && ['book-reply', 'book-snapshot-reply'].includes(event.data.type)) {
        clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data.value);
      }
    }
    window.addEventListener('message', receive);
    document.querySelector('iframe').contentWindow.postMessage({ channel: 'readest-companion-v1', book, type, id, ...fields }, location.origin);
  }), { book, type, fields });
}

try {
  for (const mode of modes) {
    const fixture = variant(mode);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__novelLongTasks = [];
      window.__novelStageStart = 0;
      window.__novelProgress = [];
      new MutationObserver(() => {
        for (const node of document.querySelectorAll('[data-novel-preparation]')) {
          const phase = node.getAttribute('data-novel-preparation');
          const percent = node.querySelector('progress')?.getAttribute('value');
          const previous = window.__novelProgress.at(-1);
          if (previous?.phase !== phase || previous?.percent !== percent) {
            window.__novelProgress.push({ phase, percent, at: Math.round(performance.now()) });
          }
        }
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'data-novel-preparation'] });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime >= window.__novelStageStart) window.__novelLongTasks.push(entry.duration);
        }
      }).observe({ type: 'longtask', buffered: true });
    });
    page.setDefaultTimeout(20000);
    const errors = [];
    const workerUrls = [];
    const workerWarnings = [];
    const readerAssetRequests = [];
    const navigationWarnings = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('worker', (worker) => workerUrls.push(worker.url()));
    page.on('request', (request) => {
      if (request.url().includes('/chunks/app/reader/')) readerAssetRequests.push(performance.now());
    });
    page.on('console', (message) => {
      if (message.text().includes('TXT conversion worker failed')) workerWarnings.push(message.text());
      if (/Failed to fetch RSC|prefetch/i.test(message.text()) && message.type() === 'error') navigationWarnings.push(message.text());
    });
    const result = { mode, bytes: fixture.buffer.length, expectedChapters: fixture.expected.length };
    console.log(JSON.stringify({ stage: 'start', mode, bytes: fixture.buffer.length }));
    try {
      await page.goto(url);
      const frame = page.frameLocator('iframe[title="Reader"]');
      await frame.getByRole('main', { name: '书架' }).getByRole('button', { name: '导入书籍', exact: true }).click();
      const chooser = page.waitForEvent('filechooser');
      await frame.getByText('从本地文件导入', { exact: true }).click();
      const title = mode === 'original' ? basename(input).replace(/\.txt$/i, '') : '索引实测-' + mode;
      const resetProbe = () => frame.locator('body').evaluate(() => {
        window.__novelLongTasks = []; window.__novelStageStart = performance.now();
      });
      const readProbe = () => frame.locator('body').evaluate(() => {
        const tasks = window.__novelLongTasks ?? [];
        return { count: tasks.length, totalMs: Math.round(tasks.reduce((sum, value) => sum + value, 0)),
          longestMs: Math.round(Math.max(0, ...tasks)) };
      });
      await resetProbe();
      const progressCapture = process.env.NOVEL_CAPTURE_PROGRESS === '1'
        ? frame.locator('[data-novel-preparation="indexing"]').waitFor({ timeout: 30000 })
          .then(() => page.screenshot({ path: join(output, mode + '-progress.png') }))
          .catch((error) => { result.progressCaptureError = error.message; })
        : Promise.resolve();
      const start = performance.now();
      await (await chooser).setFiles(mode === 'original' ? input : { name: title + '.txt', mimeType: 'text/plain', buffer: fixture.buffer });
      await progressCapture;
      await frame.getByText(title, { exact: true }).first().click({ trial: true, timeout: 240000 });
      result.importSeconds = Number(((performance.now() - start) / 1000).toFixed(2));
      result.importLongTasks = await readProbe();
      result.importProgress = await frame.locator('body').evaluate(() => window.__novelProgress ?? []);
      result.workerCount = workerUrls.length;
      result.workerWarnings = workerWarnings;
      const files = await storedFiles(page);
      if (!files) throw new Error('Import completed without a persisted index and EPUB');
      const { index } = files;
      result.indexVersion = index.version;
      result.chapters = index.chapters.length;
      result.authoredChapters = index.chapters.filter((chapter) => chapter.kind === 'chapter').length;
      result.unsectioned = index.chapters.filter((chapter) => chapter.kind === 'unsectioned').length;
      result.storageSections = index.sections.length;
      result.uniqueIds = new Set(index.chapters.map((chapter) => chapter.chapter_id)).size === index.chapters.length;
      const counts = new Map();
      fixture.expected.forEach((title) => counts.set(cleanTitle(title), (counts.get(cleanTitle(title)) ?? 0) + 1));
      let matched = 0;
      const unexpected = [];
      for (const chapter of index.chapters.filter((chapter) => chapter.kind === 'chapter')) {
        const title = cleanTitle(chapter.title);
        if (counts.get(title) > 0) { matched++; counts.set(title, counts.get(title) - 1); }
        else unexpected.push(chapter.title);
      }
      result.matchedTitles = matched;
      result.missingTitles = [...counts].filter(([, count]) => count > 0).slice(0, 8).map(([title, count]) => ({ title, count }));
      result.unexpectedTitles = unexpected.slice(0, 8);
      result.unexpectedCount = unexpected.length;
      result.issueCounts = {};
      for (const issue of [...index.issues, ...index.chapters.flatMap((chapter) => chapter.issues)]) {
        const key = issue.split(':')[0]; result.issueCounts[key] = (result.issueCounts[key] ?? 0) + 1;
      }
      await resetProbe();
      const openStarted = performance.now();
      result.readerAssetsPrefetched = readerAssetRequests.some((time) => time < openStarted);
      await frame.getByText(title, { exact: true }).first().click();
      await frame.locator('foliate-view').waitFor({ timeout: 120000 });
      const openStart = performance.now();
      let snapshot;
      for (let i = 0; i < 20; i++) {
        snapshot = await askReader(page, index.bookHash, 'book-snapshot');
        if (snapshot?.chapter_id) break;
        await new Promise((done) => setTimeout(done, 250));
      }
      result.openSeconds = Number(((performance.now() - openStarted) / 1000).toFixed(2));
      result.snapshotReadySeconds = Number(((performance.now() - openStart) / 1000).toFixed(2));
      result.openLongTasks = await readProbe();
      if (!snapshot?.chapter_id) throw new Error('No canonical chapter ID in reading snapshot');
      await page.evaluate(({ path, mode }) => new Promise((resolve, reject) => {
        const open = indexedDB.open('AppFileSystem');
        open.onsuccess = () => {
          const db = open.result;
          const read = db.transaction('files', 'readonly').objectStore('files').get(path);
          read.onsuccess = async () => {
            const response = await fetch('/__validation/' + mode, { method: 'POST', body: read.result.content });
            db.close(); if (response.ok) resolve(); else reject(new Error('Local verification transfer failed'));
          };
          read.onerror = () => reject(read.error);
        };
      }), { path: files.epubPath, mode });
      const entries = unzipSync(uploaded.get(mode));
      uploaded.delete(mode);
      const converted = [];
      for (const section of index.sections) {
        const xml = strFromU8(entries[section.href]);
        const doc = new dom.window.DOMParser().parseFromString(xml, 'application/xhtml+xml');
        converted.push(doc.querySelector('body')?.textContent ?? '');
      }
      result.bodyIntegrity = sha256(bodyForm(fixture.text)) === sha256(bodyForm(converted.join('')));
      result.sourceNormalizedChars = bodyForm(fixture.text).length;
      result.convertedNormalizedChars = bodyForm(converted.join('')).length;
      result.toolSamples = [];
      for (const i of [...new Set([0, Math.floor(index.chapters.length / 2), index.chapters.length - 1])]) {
        const chapter = index.chapters[i];
        const time = performance.now();
        const response = await askReader(page, index.bookHash, 'book-query', {
          query: { kind: 'chapter', chapter_id: chapter.chapter_id }, snapshot, protectedReading: false,
          cutoff: snapshot.spoilerBoundary, limit: 10000,
        });
        const compare = (a, b) => a.section - b.section || a.offset - b.offset;
        result.toolSamples.push({ chapter_id: chapter.chapter_id, title: chapter.title, milliseconds: Math.round(performance.now() - time),
          correctId: response?.status === 'ok' && response.chapters?.length > 0 && response.chapters.every((entry) => entry.chapter_id === chapter.chapter_id),
          startsAtHeading: chapter.kind !== 'chapter' || cleanTitle(response?.chapters?.[0]?.text ?? '').startsWith(cleanTitle(chapter.title)),
          withinIndexedRange: !!response?.chapters?.length && response.chapters.every((entry) => entry.range &&
            compare(entry.range.start, chapter.start) >= 0 && compare(entry.range.end, chapter.end) <= 0),
          chars: response?.chapters?.reduce((n, entry) => n + (entry.text?.length ?? 0), 0) ?? 0 });
      }
      await page.screenshot({ path: join(output, mode + '.png') });
      result.runtimeErrors = errors;
      result.navigationWarnings = navigationWarnings;
    } catch (error) {
      result.error = String(error.message ?? error);
      result.runtimeErrors = errors;
      await page.screenshot({ path: join(output, mode + '-error.png') }).catch(() => {});
    } finally { await context.close(); }
    report.cases.push(result);
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ stage: 'result', ...result }));
  }
} finally {
  report.originalUnchanged = sha256(await readFile(input)) === report.originalSha256;
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  dom.window.close();
  await browser.close();
  cleanup?.(); server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
