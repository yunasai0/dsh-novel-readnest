import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookDoc } from '@/libs/document';
import type { FoliateView } from '@/types/view';
import { buildNovelIndex } from '@/services/novel/novelIndex';
import { connectDshBook } from '@/services/dshCompanion';
import { companionChannel, type ReadingSnapshot } from '@dsh-reader/protocol';
import { readFurthestPoint } from '@dsh-reader/reading-progress';

const connections: ReturnType<typeof connectDshBook>[] = [];
const messages: Record<string, unknown>[] = [];

beforeEach(() => {
  localStorage.clear();
  messages.length = 0;
  vi.spyOn(window, 'postMessage').mockImplementation((message) => { messages.push(message); });
});

afterEach(() => {
  connections.splice(0).forEach((connection) => connection.dispose());
  vi.restoreAllMocks();
});

async function reader(hash = 'book-test-001', delayed?: { section: number; ready: Promise<void> }) {
  let delayReads = false;
  const documents = ['abcdefghij', 'klmnopqrst', 'uvwxyzABCD'].map((text) =>
    new DOMParser().parseFromString('<p>' + text + '</p>', 'text/html'));
  const doc = {
    sections: documents.map((document, index) => ({
      href: index + '.xhtml',
      createDocument: async () => {
        if (delayReads && delayed?.section === index) await delayed.ready;
        return document;
      },
    })),
    toc: [], splitTOCHref: (href: string) => href.split('#'),
  } as unknown as BookDoc;
  doc.novelIndex = await buildNovelIndex(doc, hash);
  delayReads = true;
  let visible: { index: number; range: Range }[] = [];
  const view = { resolveNavigation: () => undefined, getCFI: () => 'test-cfi', renderer: {
    getVisibleRanges: () => visible,
    getContents: () => documents.map((doc, index) => ({ doc, index })),
  } } as unknown as FoliateView;
  const connection = connectDshBook({ hash, title: '测试小说' }, doc, () => view);
  connections.push(connection);
  return {
    close: () => connection.dispose(),
    turn(section: number, end: number) {
      visible = [];
      const range = documents[section]!.createRange();
      const text = documents[section]!.querySelector('p')!.firstChild!;
      range.setStart(text, 0);
      range.setEnd(text, end);
      connection.record(section, 'test-cfi', range);
    },
    spread(items: { section: number; start: number; end: number }[]) {
      visible = items.map((item) => {
        const range = documents[item.section]!.createRange();
        const text = documents[item.section]!.querySelector('p')!.firstChild!;
        range.setStart(text, item.start); range.setEnd(text, item.end);
        return { index: item.section, range };
      });
      connection.record(visible[0]!.index, 'test-cfi', visible[0]!.range);
    },
    async snapshot(quoteSnapshot?: ReadingSnapshot) {
      const id = crypto.randomUUID();
      window.dispatchEvent(new MessageEvent('message', {
        source: window, origin: location.origin,
        data: { channel: companionChannel, type: 'book-snapshot', book: hash, id, quoteSnapshot },
      }));
      await vi.waitFor(() => expect(messages.some((message) => message['id'] === id)).toBe(true));
      return messages.find((message) => message['id'] === id)!['value'] as ReadingSnapshot;
    },
  };
}

describe('furthest reading position is independent of the discussion page', () => {
  it('captures all visible files in a spread and keeps an old quote separate from the live reading position', async () => {
    const book = await reader();
    book.turn(0, 3);
    const quote = { ...await book.snapshot(), selection: { start: { section: 0, offset: 0 }, end: { section: 0, offset: 3 }, text: 'abc' } };
    book.spread([{ section: 0, start: 6, end: 10 }, { section: 1, start: 0, end: 4 }]);
    const current = await book.snapshot();
    expect(current.reading?.start).toEqual({ section: 0, offset: 6 });
    expect(current.reading?.end).toEqual({ section: 1, offset: 4 });
    expect(current.visibleRanges).toEqual([{ start: { section: 0, offset: 6 }, end: { section: 1, offset: 4 } }]);
    const withQuote = await book.snapshot(quote);
    expect(withQuote.start).toEqual(quote.start);
    expect(withQuote.reading?.end).toEqual({ section: 1, offset: 4 });
    expect(withQuote.spoilerBoundary).toEqual({ section: 1, offset: 4 });
  });
  it('tracks reading without opening AI and retains the boundary when turning back or reopening', async () => {
    const book = await reader();
    book.turn(0, 5);
    book.turn(2, 8);
    book.turn(0, 3);
    const snapshot = await book.snapshot();
    expect(snapshot.end).toEqual({ section: 0, offset: 3 });
    expect(snapshot.spoilerBoundary).toEqual({ section: 2, offset: 8 });
    book.close();

    const reopened = await reader();
    reopened.turn(0, 2);
    expect((await reopened.snapshot()).spoilerBoundary).toEqual({ section: 2, offset: 8 });
    const other = await reader('book-test-002');
    other.turn(0, 2);
    expect((await other.snapshot()).spoilerBoundary).toEqual({ section: 0, offset: 2 });
  });

  it('advances within a chapter and does not regress when earlier async reads complete later', async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const book = await reader('book-test-001', { section: 0, ready });
    book.turn(0, 10);
    book.turn(1, 4);
    await vi.waitFor(() => expect(readFurthestPoint('book-test-001')).toEqual({ section: 1, offset: 4 }));
    release();
    expect((await book.snapshot()).spoilerBoundary).toEqual({ section: 1, offset: 4 });
    book.turn(1, 9);
    expect((await book.snapshot()).spoilerBoundary).toEqual({ section: 1, offset: 9 });
  });

  it('freezes the boundary before later page turns, even while resolving the submitted page', async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const book = await reader('book-test-001', { section: 0, ready });
    book.turn(0, 5);
    const submitted = book.snapshot();
    book.turn(2, 10);
    await vi.waitFor(() => expect(readFurthestPoint('book-test-001')).toEqual({ section: 2, offset: 10 }));
    release();
    expect((await submitted).spoilerBoundary).toEqual({ section: 0, offset: 5 });
    expect((await book.snapshot()).spoilerBoundary).toEqual({ section: 2, offset: 10 });
  });

  it('keeps an older quote as the discussion anchor but refreshes its boundary at submission', async () => {
    const book = await reader();
    book.turn(0, 5);
    const quote = { ...await book.snapshot(), selection: { text: 'abc', end: { section: 0, offset: 3 } } };
    book.turn(2, 9);
    const submitted = await book.snapshot(quote);
    expect(submitted.start).toEqual(quote.start);
    expect(submitted.end).toEqual(quote.end);
    expect(submitted.selection).toEqual(quote.selection);
    expect(submitted.spoilerBoundary).toEqual({ section: 2, offset: 9 });
  });

  it('starts old or damaged records at the current page and merges another reader’s progress', async () => {
    localStorage.setItem('dsh.novel-reader.furthest.book-test-001', '{broken');
    const first = await reader();
    first.turn(0, 4);
    expect((await first.snapshot()).spoilerBoundary).toEqual({ section: 0, offset: 4 });
    const second = await reader();
    second.turn(2, 7);
    await second.snapshot();
    expect((await first.snapshot()).spoilerBoundary).toEqual({ section: 2, offset: 7 });
  });
});
