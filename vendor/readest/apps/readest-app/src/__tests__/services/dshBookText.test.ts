import { describe, expect, it } from 'vitest';
import type { BookDoc } from '@/libs/document';
import { createBookText } from '@/services/dshBookText';
import type { BookPoint, BookQuery, BookRequest } from '@dsh-reader/protocol';

function reader(documents: Record<string, string>, toc: BookDoc['toc'] = []) {
  const book = {
    sections: Object.entries(documents).map(([href, html]) => ({
      href, createDocument: async () => new DOMParser().parseFromString(html, 'text/html'),
    })),
    toc,
    splitTOCHref: (href: string) => href.split('#'),
  } as BookDoc;
  return createBookText(book, () => null);
}

const item = (label: string, href: string, subitems?: BookDoc['toc']) =>
  ({ label, href, id: 0, index: 0, subitems });
const point = (section: number, offset: number) => ({ section, offset });

function request(query: BookQuery, cutoff?: BookPoint, resume?: BookPoint, limit = 550): BookRequest {
  return {
    id: 'test', query, cutoff: cutoff ?? point(0, 0), limit, resume, protectedReading: !!cutoff,
    snapshot: {
      title: '测试书', chapter: '正文', firstParagraph: 1, lastParagraph: 1,
      start: point(0, 0), end: cutoff ?? point(0, 1),
    },
  };
}

describe('novel chapter lookup and continuation', () => {
  it('keeps repeated chapter numbers separate across flat and nested volume headings', async () => {
    const book = reader({
      'one.xhtml': '<p>甲卷正文</p>',
      'two.xhtml': '<p>乙卷正文</p>',
    }, [
      item('卷一 风起', ''),
      item('第一章 初见', 'one.xhtml'),
      item('第二卷 云散', 'two.xhtml', [item('第一章 重逢', 'two.xhtml')]),
    ]);
    const ambiguous = await book.answer(request({ kind: 'chapter', chapter: 1 }));
    expect(ambiguous.candidates?.map(({ volume, title }) => [volume, title])).toEqual([
      [1, '第一章 初见'], [2, '第一章 重逢'],
    ]);
    const second = await book.answer(request({ kind: 'chapter', chapter: 1, volume: 2 }));
    expect(second.chapters?.map(({ title, text }) => [title, text])).toEqual([['第一章 重逢', '乙卷正文']]);
  });

  it('treats each XHTML anchor as a chapter and hides titles at the cutoff', async () => {
    const book = reader({
      'shared.xhtml': '<h1 id="one">第一章</h1><p>公开内容</p><h1 id="two">第二章</h1><p>未读正文</p>',
    }, [item('第一章', 'shared.xhtml#one'), item('第二章', 'shared.xhtml#two')]);
    const second = await book.chapterAt(point(0, 12));
    const secondOnly = await book.answer(request({ kind: 'chapter', chapter: 2 }));
    const boundary = secondOnly.chapters?.[0]?.range?.start;
    expect(boundary).toBeDefined();
    expect(second?.entry.title).toBe('第二章');
    expect(secondOnly.chapters?.[0]?.text).toBe('第二章\n\n未读正文');
    const protectedResult = await book.answer(request({ kind: 'range', chapters: [1, 2] }, boundary));
    expect(protectedResult.stopReason).toBe('spoiler_limit');
    expect(protectedResult.next).toBeUndefined();
    expect(protectedResult.chapters?.map(({ title, text }) => [title, text])).toEqual([
      ['第一章', '第一章\n\n公开内容\n\n'],
    ]);
    const contents = await book.answer(request({ kind: 'contents' }, boundary));
    expect(contents.contents?.map(({ title }) => title)).toEqual(['第一章']);
    const directory = await book.answer(request({ kind: 'contents' }, undefined, undefined, 80));
    expect(directory.next).toEqual(boundary);
    const remaining = await book.answer(request({ kind: 'contents' }, undefined, directory.next));
    expect(remaining.contents?.map(({ title }) => title)).toEqual(['第二章']);
  });

  it('joins batches across XHTML chapter and file boundaries without trimming source text', async () => {
    const paragraphs = ['甲'.repeat(350), '乙'.repeat(550), '丙'.repeat(500)];
    const book = reader({
      'shared.xhtml': '<h1 id="one">第一章</h1><p>' + paragraphs[0] + '</p>' +
        '<h1 id="two">第二章</h1><p>' + paragraphs[1] + '</p>',
      'three.xhtml': '<h1>第三章</h1><p>' + paragraphs[2] + '</p>',
    }, [item('第一章', 'shared.xhtml#one'), item('第二章', 'shared.xhtml#two'), item('第三章', 'three.xhtml')]);
    const query: BookQuery = { kind: 'range', chapters: [1, 3] };
    const output = ['', ''];
    const positions = [0, 0];
    let resume: BookPoint | undefined;
    for (let i = 0; i < 20; i++) {
      const batch = await book.answer(request(query, undefined, resume));
      for (const excerpt of batch.chapters ?? []) {
        const { start, end } = excerpt.range!;
        expect(start.offset).toBe(positions[start.section]);
        positions[start.section] = end.offset;
        expect(excerpt.text).toBeTypeOf('string');
        output[start.section] = (output[start.section] ?? '') + excerpt.text!;
      }
      resume = batch.next;
      if (!resume) break;
    }
    expect(resume).toBeUndefined();
    expect(output[0]).toBe(['第一章', paragraphs[0], '第二章', paragraphs[1]].join('\n\n'));
    expect(output[1]).toBe(['第三章', paragraphs[2]].join('\n\n'));
  });

  it('indexes long unheaded text and rechecks a continuation against a tightened cutoff', async () => {
    const text = '甲'.repeat(15999) + '🙂' + '乙'.repeat(17000);
    const book = reader({ 'plain.xhtml': '<p>' + text + '</p>' });
    const contents = await book.answer(request({ kind: 'contents' }));
    expect(contents.contents?.map(({ id }) => id)).toEqual(['section-1', 'section-1-part-2', 'section-1-part-3']);
    const query: BookQuery = { kind: 'range', chapters: ['section-1', 'section-1-part-3'] };
    const initial = await book.answer(request(query, undefined, undefined, 16350));
    expect(initial.next).toBeDefined();
    const boundary = point(0, initial.next!.offset + 30);
    const next = await book.answer(request(query, boundary, initial.next));
    expect(next.stopReason).toBe('spoiler_limit');
    expect(next.next).toBeUndefined();
    expect(next.last).toEqual(boundary);
    const joined = [...initial.chapters!, ...next.chapters!].map(({ text: value }) => value).join('');
    expect(joined).toBe(text.slice(0, boundary.offset));
    const stopped = await book.answer(request(query, initial.next, initial.next));
    expect(stopped).toMatchObject({ chapters: [], stopReason: 'spoiler_limit' });
    expect(stopped.next).toBeUndefined();
  });
});
