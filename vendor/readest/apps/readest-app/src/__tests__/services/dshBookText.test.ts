import { describe, expect, it } from 'vitest';
import type { BookDoc } from '@/libs/document';
import { createBookText } from '@/services/dshBookText';
import { buildNovelIndex, installNovelNavigation, prepareNovelIndex, validNovelIndex } from '@/services/novel/novelIndex';
import { extractBookText } from '@/services/novel/text';
import type { BookPoint, BookQuery, BookRequest } from '@dsh-reader/protocol';

const item = (label: string, href: string, subitems?: BookDoc['toc']) => ({ label, href, id: 0, index: 0, subitems });
const point = (section: number, offset = 0): BookPoint => ({ section, offset });
const prose = '这里是实际小说正文，人物向前走去，故事继续展开。';
function documentBook(documents: Record<string, string>, toc: BookDoc['toc'] = []) {
  return {
    sections: Object.entries(documents).map(([href, html]) => ({ id: href,
      createDocument: async () => new DOMParser().parseFromString(html, 'text/html'),
    })), toc, splitTOCHref: (href: string) => href.split('#'),
  } as unknown as BookDoc;
}
async function reader(documents: Record<string, string>, toc: BookDoc['toc'] = [], hash = 'book-fixture') {
  const book = documentBook(documents, toc);
  book.novelIndex = await buildNovelIndex(book, hash);
  return { book, index: book.novelIndex, text: createBookText(book, hash) };
}
function request(query: BookQuery, cutoff?: BookPoint, resume?: BookPoint, limit = 10000): BookRequest {
  return { id: 'test', query, cutoff: cutoff ?? point(0), limit, resume, protectedReading: !!cutoff,
    snapshot: { title: '测试书', chapter: '正文', firstParagraph: 1, lastParagraph: 1,
      start: point(0), end: point(0, 1) } };
}

describe('canonical novel chapter index', () => {
  it('keeps current reading near the anchor even inside a huge paragraph', async () => {
    const { text } = await reader({ 'a.xhtml': '<p>' + '甲'.repeat(50000) + '当前位置' + '乙'.repeat(10000) + '</p>' });
    const input = request({ kind: 'near', before: 3, after: 2 }, undefined, undefined, 30000);
    input.snapshot.start = point(0, 50000); input.snapshot.end = point(0, 50100);
    const result = await text.answer(input);
    const body = result.chapters!.map((chapter) => chapter.text).join('');
    expect(body).toContain('当前位置');
    expect(result.chapters?.[0]?.range?.start.offset).toBeGreaterThanOrEqual(49000);
    expect([...body].length).toBeLessThanOrEqual(1600);
  });
  it('reads original chapter numbers, disambiguates volumes, and never falls back to file order', async () => {
    const { text, index } = await reader({
      'a.xhtml': '<h1>第十二章 甲</h1><p>甲卷正文。</p>',
      'b.xhtml': '<h1>第十二章 乙</h1><p>乙卷正文。</p>',
      'c.xhtml': '<h1>第十三章 丙</h1><p>丙卷正文。</p>',
    }, [item('第一卷', '', [item('第十二章 甲', 'a.xhtml')]),
      item('第二卷', '', [item('第十二章 乙', 'b.xhtml'), item('第十三章 丙', 'c.xhtml')])]);
    const ambiguous = await text.answer(request({ kind: 'numbers', start: 12, end: 12 }));
    expect(ambiguous.error?.code).toBe('AMBIGUOUS_CHAPTER');
    expect(ambiguous.candidates).toHaveLength(2);
    const exact = await text.answer(request({ kind: 'numbers', start: 12, end: 13, volume: '第二卷' }));
    expect(exact.chapters?.map((chapter) => chapter.chapter_number)).toEqual([12, 13]);
    expect(exact.chapters?.map((chapter) => chapter.chapter_id)).toEqual(index.chapters.slice(1).map((chapter) => chapter.chapter_id));
    expect((await text.answer(request({ kind: 'numbers', start: 1, end: 1 }))).error?.code).toBe('CHAPTER_NOT_FOUND');
    const selected = await text.answer(request({ kind: 'ids', chapter_ids: [index.chapters[2]!.chapter_id, index.chapters[0]!.chapter_id] }));
    expect(selected.chapters?.map((chapter) => chapter.title)).toEqual(['第十二章 甲', '第十三章 丙']);
  });

  it('counts Unicode text characters only and resumes without splitting emoji or repeating text', async () => {
    const body = '🙂'.repeat(40000);
    const { text, index } = await reader({ 'a.xhtml': '<h1>第一章</h1><p>' + body + '</p>' });
    const query: BookQuery = { kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id };
    const first = await text.answer(request(query, undefined, undefined, 30000));
    const chunk = first.chapters!.map((chapter) => chapter.text).join('');
    expect([...chunk]).toHaveLength(30000);
    expect(first.stopReason).toBe('round_budget');
    expect(first.chapters!.at(-1)!.end_notice).toContain('30000');
    const second = await text.answer(request(query, undefined, first.next, 30000));
    expect(chunk + second.chapters!.map((chapter) => chapter.text).join('')).toBe('第一章\n\n' + body);
    expect(second.stopReason).toBe('completed');
  });

  it('reports simultaneous spoiler and budget limits without issuing an over-boundary cursor', async () => {
    const { text, index } = await reader({ 'a.xhtml': '<p>' + '甲'.repeat(100) + '</p>' });
    const result = await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id }, point(0, 30), undefined, 30));
    expect(result.limits).toEqual(['spoiler_limit', 'round_budget']);
    expect(result.next).toBeUndefined();
    expect(result.chapters?.[0]?.end_notice).toContain('用户尚未读到');
    expect(result.chapters?.[0]?.end_notice).toContain('30000');
  });
  it('recovers decorated headings from previously imported TXT storage chunks', async () => {
    const { index } = await reader({ 'a.xhtml': '<body data-readest-txt-heading="generated"><p>☆、第1章 惊蛰</p><p>' + prose +
      '</p><p>☆、第2章 稗草</p><p>' + prose + '</p></body>' });
    expect(index.chapters.map((chapter) => chapter.title)).toEqual(['第1章 惊蛰', '第2章 稗草']);
  });
  it('uses distinct stable IDs for repeated original chapter numbers without reordering the source', async () => {
    const docs = { 'a.xhtml': '<h1>第一章 初见</h1><p>甲卷正文</p>', 'b.xhtml': '<h1>第一章 重逢</h1><p>乙卷正文</p>' };
    const toc = [item('第一卷', '', [item('第一章 初见', 'a.xhtml')]), item('第二卷', '', [item('第一章 重逢', 'b.xhtml')])];
    const { book, index, text } = await reader(docs, toc);
    expect(index.chapters.map((c) => c.volume_title)).toEqual(['第一卷', '第二卷']);
    expect(new Set(index.chapters.map((c) => c.chapter_id)).size).toBe(2);
    expect((await buildNovelIndex(documentBook(docs, toc), index.bookHash)).chapters.map((c) => c.chapter_id))
      .toEqual(index.chapters.map((c) => c.chapter_id));
    const result = await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[1]!.chapter_id }));
    expect(result.chapters?.[0]?.text).toBe('第一章 重逢\n\n乙卷正文');
    installNovelNavigation(book);
    expect(book.toc?.map((c) => c.label)).toEqual(['第一卷 · 第一章 初见', '第二卷 · 第一章 重逢']);
  });

  it('merges aliases at one anchor and repairs a misleading TOC title using the actual heading', async () => {
    const { index } = await reader({ 'a.xhtml': '<h1 id="one">第十章 真正标题</h1><p>' + prose + '</p><h2 id="two">第九章 倒序章号</h2><p>' + prose + '</p>' },
      [item('错误标题', 'a.xhtml#one'), item('重复入口', 'a.xhtml#one'), item('不存在', 'a.xhtml#missing'), item('第九章 倒序章号', 'a.xhtml#two')]);
    expect(index.chapters).toHaveLength(2);
    expect(index.chapters.map((c) => c.title)).toEqual(['第十章 真正标题', '第九章 倒序章号']);
    expect(index.chapters[0]?.original_title).toBe('错误标题');
    expect(index.chapters[0]?.aliases).toContain('重复入口');
    expect(index.issues).toContain('broken_anchor: a.xhtml#missing');
  });

  it('recognizes real headings but does not turn an embedded printed TOC or prose mention into chapters', async () => {
    const { index } = await reader({ 'a.xhtml': '<p>目录</p><p>第一章 初见</p><p>第二章 夜行</p><p>第三章 重逢</p>' +
      '<p>这是目录之后的说明，以下开始小说正文。</p><h1>第一章 初见</h1><p>' + prose + '</p>' +
      '<p>他说第三章的事情已经过去了。</p><h1>第二章 夜行</h1><p>' + prose + '</p>' });
    expect(index.chapters.map((c) => c.title)).toEqual(['未分章正文', '第一章 初见', '第二章 夜行']);
    expect(index.chapters[0]?.kind).toBe('unsectioned');
  });

  it('keeps a chapter across files and does not expose TXT technical chunks as authored chapters', async () => {
    const { index, text } = await reader({
      'a.xhtml': '<h1>第一章</h1><p>' + prose + '</p>',
      'part.xhtml': '<body data-readest-txt-heading="generated"><h2>2</h2><p>同一章后半段</p></body>',
      'b.xhtml': '<h1>第二章</h1><p>下一章正文</p>',
    }, [item('第一章', 'a.xhtml'), item('2', 'part.xhtml'), item('第二章', 'b.xhtml')]);
    expect(index.chapters.map((c) => c.title)).toEqual(['第一章', '第二章']);
    const result = await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id }));
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters?.[0]?.text).toContain('同一章后半段');
    expect(result.chapters?.[0]?.text).not.toContain('下一章正文');
    expect(result.chapters?.[0]?.coverage).toBe('full');
  });

  it('keeps nested subsections inside their authored chapter', async () => {
    const { index, text } = await reader({ 'a.xhtml': '<h1 id="one">第一章</h1><p>开场。</p>' +
      '<h2 id="part">第一节 走进山谷</h2><p>' + prose + '</p><h1 id="two">第二章</h1><p>下一章。</p>' },
      [item('第一章', 'a.xhtml#one', [item('第一节 走进山谷', 'a.xhtml#part')]), item('第二章', 'a.xhtml#two')]);
    expect(index.chapters.map((chapter) => chapter.title)).toEqual(['第一章', '第二章']);
    expect(index.chapters[0]?.volume_title).toBeUndefined();
    const result = await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id }));
    expect(result.chapters?.[0]?.text).toContain('第一节 走进山谷');
    expect(result.chapters?.[0]?.text).toContain(prose);
  });

  it('keeps a real first chapter immediately after a repeated printed TOC', async () => {
    const { index } = await reader({ 'a.xhtml': '<p>第一章 初见</p><p>第二章 夜行</p><p>第三章 重逢</p>' +
      '<h1>第一章 初见</h1><p>' + prose + '</p><h1>第二章 夜行</h1><p>' + prose + '</p>' });
    expect(index.chapters.map((chapter) => chapter.title)).toEqual(['未分章正文', '第一章 初见', '第二章 夜行']);
  });

  it('preserves unnumbered headings and duplicate body text with explicit anomaly records', async () => {
    const html = '<h1>雨夜</h1><p>' + prose + '</p><h1>重逢</h1><p>后来发生的故事。</p>';
    const { index, text } = await reader({ 'a.xhtml': html, 'b.xhtml': html });
    expect(index.chapters.map((chapter) => chapter.title)).toEqual(['雨夜', '重逢', '雨夜', '重逢']);
    expect(index.chapters[2]?.issues).toContain('duplicate_text');
    const result = await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[2]!.chapter_id }));
    expect(result.chapters?.[0]?.text).toContain(prose);
  });

  it('continues a cross-file chapter across batches without dropping boundary text', async () => {
    const a = '<h1>第一章</h1><p>' + '甲'.repeat(700) + '</p>';
    const b = '<p>' + '乙'.repeat(700) + '</p>';
    const { index, text } = await reader({ 'a.xhtml': a, 'b.xhtml': b });
    const query: BookQuery = { kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id };
    let resume: BookPoint | undefined;
    let actual = '';
    for (let i = 0; i < 12; i++) {
      const batch = await text.answer(request(query, undefined, resume, 600));
      actual += batch.chapters?.map((chapter) => chapter.text).join('') ?? '';
      resume = batch.next;
      if (!resume) break;
    }
    expect(resume).toBeUndefined();
    expect(actual).toBe('第一章\n\n' + '甲'.repeat(700) + '\n\n' + '乙'.repeat(700));
  });

  it('keeps an unheaded long novel as one unit and reads batches without lost or duplicated characters', async () => {
    const source = '甲'.repeat(15999) + '🙂' + '乙'.repeat(17000);
    const { index, text } = await reader({ 'plain.xhtml': '<p>' + source + '</p>' });
    expect(index.chapters).toHaveLength(1);
    expect(index.chapters[0]?.kind).toBe('unsectioned');
    const query: BookQuery = { kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id };
    let resume: BookPoint | undefined;
    let joined = '';
    for (let n = 0; n < 20; n++) {
      const batch = await text.answer(request(query, undefined, resume, 3000));
      joined += batch.chapters?.map((chapter) => chapter.text).join('') ?? '';
      resume = batch.next;
      if (!resume) break;
    }
    expect(resume).toBeUndefined();
    expect(joined).toBe(source);
  });

  it('clips by the farthest-read boundary and hides unread titles and next IDs', async () => {
    const { index, text } = await reader({ 'a.xhtml': '<h1>第一章</h1><p>' + prose + '</p><h1>第二章</h1><p>未读秘密</p>' });
    const [first, second] = index.chapters;
    const directory = await text.answer(request({ kind: 'contents' }, second!.start));
    expect(directory.contents?.map((c) => c.chapter_id)).toEqual([first!.chapter_id]);
    expect(directory.contents?.[0]?.next_id).toBeUndefined();
    const blocked = await text.answer(request({ kind: 'chapter', chapter_id: second!.chapter_id }, second!.start));
    expect(blocked).toMatchObject({ chapters: [], stopReason: 'spoiler_limit' });
    const partial = await text.answer(request({ kind: 'chapter', chapter_id: first!.chapter_id }, point(0, 12)));
    expect(partial.last).toEqual(point(0, 12));
    expect(partial.next).toBeUndefined();
  });

  it('filters directories by volume/title and rejects old or foreign IDs instead of guessing', async () => {
    const { index, text } = await reader({ 'a.xhtml': '<h1>第一章 初见</h1><p>' + prose + '</p>', 'b.xhtml': '<h1>第一章 重逢</h1><p>' + prose + '</p>' },
      [item('第一卷', '', [item('第一章 初见', 'a.xhtml')]), item('第二卷', '', [item('第一章 重逢', 'b.xhtml')])]);
    expect((await text.answer(request({ kind: 'contents', query: '第二卷' }))).contents?.map((c) => c.chapter_id)).toEqual([index.chapters[1]!.chapter_id]);
    expect((await text.answer(request({ kind: 'chapter', chapter_id: 'section-1' }))).status).toBe('invalid_request');
    expect((await text.answer(request({ kind: 'chapter', chapter_id: 'ch_0000000000000000' }))).status).toBe('not_found');
    const reverse = await text.answer(request({ kind: 'range', start_chapter_id: index.chapters[1]!.chapter_id, end_chapter_id: index.chapters[0]!.chapter_id }));
    expect(reverse.status).toBe('invalid_request');
  });

  it('validates coverage and caches an index that can reopen without re-parsing the entire book', async () => {
    const docs = { 'a.xhtml': '<h1>第一章</h1><p>' + prose + '</p>', 'b.xhtml': '<p>续文</p>' };
    const store = new Map<string, string>();
    const fs = { readFile: async (path: string) => { if (!store.has(path)) throw new Error('missing'); return store.get(path)!; },
      writeFile: async (path: string, _base: unknown, data: unknown) => { store.set(path, String(data)); }, createDir: async () => {} };
    const first = documentBook(docs);
    const index = await prepareNovelIndex(fs as Parameters<typeof prepareNovelIndex>[0], first, 'persistent-book');
    const second = documentBook(docs);
    second.sections.forEach((section) => { section.createDocument = async () => { throw new Error('should use cache'); }; });
    expect(await prepareNovelIndex(fs as Parameters<typeof prepareNovelIndex>[0], second, 'persistent-book')).toEqual(JSON.parse(JSON.stringify(index)));
    const damaged = structuredClone(index);
    damaged.chapters[0]!.start.offset = 1;
    expect(validNovelIndex(damaged, first, 'persistent-book')).toBe(false);
    const all = await Promise.all(first.sections.map(async (section) => extractBookText(await section.createDocument()).text));
    expect(index.sections.reduce((sum, section) => sum + section.length, 0)).toBe(all.join('').length);
  });

  it('lists cached chapters without opening body files and reads only the requested chapter file', async () => {
    const { book, index } = await reader({ 'a.xhtml': '<h1>第一章</h1><p>' + prose + '</p>',
      'b.xhtml': '<h1>第二章</h1><p>' + prose + '</p>' });
    const loaded: number[] = [];
    book.sections.forEach((section, i) => {
      const original = section.createDocument;
      section.createDocument = async () => { loaded.push(i); return original(); };
    });
    const text = createBookText(book, index.bookHash);
    installNovelNavigation(book);
    expect(loaded).toEqual([]);
    await text.answer(request({ kind: 'contents' }));
    await text.answer(request({ kind: 'contents', query: '第二章' }));
    expect(loaded).toEqual([]);
    await text.answer(request({ kind: 'chapter', chapter_id: index.chapters[0]!.chapter_id }));
    expect(loaded).toEqual([0]);
  });

  it('carries book locations into the canonical TOC instead of displaying file ordinals as pages', async () => {
    const { book, index } = await reader({ 'a.xhtml': '<h1>第一章</h1><p>' + prose + '</p>',
      'b.xhtml': '<h1>第二章</h1><p>' + prose + '</p><h1>第三章</h1><p>' + prose + '</p>' });
    book.sections[0]!.size = 60_000;
    book.sections[1]!.size = 120_000;
    installNovelNavigation(book);
    expect(book.toc?.[1]?.location?.current).toBe(40);
    expect(book.toc?.[2]?.location?.current).toBeGreaterThan(40);
    expect(book.toc?.map((entry) => entry.cfi)).toEqual(index.chapters.map((chapter) => chapter.cfi));
  });

  it('preloads small sections concurrently but indexes them in original order', async () => {
    const docs = { 'a.xhtml': '<h1>第一章</h1><p>甲</p>', 'b.xhtml': '<h1>第二章</h1><p>乙</p>',
      'c.xhtml': '<h1>第三章</h1><p>丙</p>' };
    const book = documentBook(docs);
    let active = 0;
    let peak = 0;
    const finished: number[] = [];
    book.sections.forEach((section, i) => {
      section.size = 1000;
      const original = section.createDocument;
      section.createDocument = async () => {
        active++; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, i ? 1 : 25));
        finished.push(i); active--;
        return original();
      };
    });
    const progress: number[] = [];
    const index = await buildNovelIndex(book, 'parallel-book', (done) => progress.push(done));
    expect(peak).toBe(3);
    expect(finished[0]).not.toBe(0);
    expect(index).toEqual(await buildNovelIndex(documentBook(docs), 'parallel-book'));
    expect(progress).toEqual([0, 1, 2, 3]);
  });

  it.each([0, 3 * 1024 * 1024])('limits read-ahead for unknown or large section sizes (%i)', async (size) => {
    const book = documentBook({ 'a.xhtml': '<h1>第一章</h1><p>甲</p>', 'b.xhtml': '<h1>第二章</h1><p>乙</p>' });
    let active = 0;
    let peak = 0;
    book.sections.forEach((section) => {
      section.size = size;
      const original = section.createDocument;
      section.createDocument = async () => {
        active++; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--; return original();
      };
    });
    await buildNovelIndex(book, 'large-sections');
    expect(peak).toBe(1);
  });
});
