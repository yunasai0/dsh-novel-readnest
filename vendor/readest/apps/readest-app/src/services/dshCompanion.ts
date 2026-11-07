import type { Book } from '@/types/book';
import type { FoliateView } from '@/types/view';
import type { BookDoc } from '@/libs/document';
import type { TextSelection } from '@/utils/sel';
import { companionChannel, type BookRequest, type ReadingSnapshot } from '@dsh-reader/protocol';
import { comparable, createBookText, extractBookText, paragraphAt, textOffset } from './dshBookText';
import { isDshReader } from './dshReader';

export function isDshCompanionHost() {
  return isDshReader() && typeof window !== 'undefined' && window.parent !== window;
}

function send(message: Record<string, unknown>) {
  window.parent.postMessage({ channel: companionChannel, ...message }, window.location.origin);
}

function describeBook(book: Book) {
  const theme = getComputedStyle(document.querySelector('.header-bar') ?? document.body);
  return {
      id: book.hash,
      title: book.title,
      theme: {
        paper: theme.getPropertyValue('--color-base-100').trim(),
        ink: theme.getPropertyValue('--color-base-content').trim(),
        accent: theme.getPropertyValue('--color-primary').trim(),
      },
  };
}

export function openDshCompanion(book: Book) {
  send({ type: 'open', book: describeBook(book) });
}

const selectionSnapshots = new WeakMap<FoliateView, (selection: TextSelection) => Promise<ReadingSnapshot | undefined>>();

export async function discussDshSelection(book: Book, view: FoliateView, selection: TextSelection) {
  const snapshot = await selectionSnapshots.get(view)?.(selection).catch(() => undefined);
  if (!snapshot?.selection) return false;
  send({ type: 'open-selection', book: describeBook(book), snapshot });
  return true;
}

export function connectDshBook(
  book: Pick<Book, 'hash' | 'title'>,
  doc: BookDoc,
  getView: () => FoliateView | null,
) {
  const text = createBookText(doc, getView);
  let position: { index: number; cfi: string; range: Range } | undefined;
  let observed: Document | undefined;
  let selection: Range | undefined;
  let disposed = false;
  let registeredView: FoliateView | null = null;

  function rememberSelection() {
    const current = observed?.getSelection();
    if (current?.rangeCount && !current.isCollapsed) selection = current.getRangeAt(0).cloneRange();
    else if (observed?.hasFocus()) selection = undefined;
  }

  function record(index: number, cfi: string, range: Range | null | undefined) {
    if (!range || !cfi || !doc.sections[index]) {
      position = undefined;
      return;
    }
    const owner = range.startContainer.ownerDocument;
    if (!owner) return;
    if (observed !== owner) {
      observed?.removeEventListener('selectionchange', rememberSelection);
      observed = owner;
      owner.addEventListener('selectionchange', rememberSelection);
      selection = undefined;
    }
    position = { index, cfi, range: range.cloneRange() };
    const view = getView();
    if (view && view !== registeredView) {
      if (registeredView) selectionSnapshots.delete(registeredView);
      registeredView = view;
      selectionSnapshots.set(view, snapshot);
    }
  }

  async function snapshot(explicit?: TextSelection): Promise<ReadingSnapshot | undefined> {
    const page = position;
    const view = getView();
    const owner = page?.range.startContainer.ownerDocument;
    if (!page || !view || !owner?.body) return;
    const live = extractBookText(owner);
    const from = textOffset(page.range, live, false);
    const to = textOffset(page.range, live, true);
    const visible = live.text.slice(from, to);
    if (!visible.trim()) return;
    const selected = owner.getSelection();
    const selectedRange = explicit
      ? explicit.segments?.find((segment) => segment.range.startContainer.ownerDocument === owner)?.range ?? explicit.range
      : selected?.rangeCount && !selected.isCollapsed ? selected.getRangeAt(0) : selection;
    const rangeFrom = selectedRange?.startContainer.ownerDocument === owner
      ? textOffset(selectedRange, live, false) : -1;
    const rangeTo = selectedRange?.endContainer.ownerDocument === owner
      ? textOffset(selectedRange, live, true) : -1;
    const selectedFrom = explicit && rangeFrom >= 0 ? Math.max(from, rangeFrom) : rangeFrom;
    const selectedTo = explicit ? Math.min(to, rangeTo) : rangeTo;
    const source = await text.load(page.index);
    if (!source || disposed) return;
    let start = from;
    let end = to;
    if (live.text !== source.body.text) {
      const anchor = view.resolveNavigation(page.cfi);
      const range = anchor?.index === page.index ? anchor.anchor?.(source.doc) : undefined;
      if (range && typeof range === 'object') {
        start = textOffset(range, source.body, false);
        end = textOffset(range, source.body, true);
      }
      if (comparable(source.body.text.slice(start, end)) !== comparable(visible)) {
        const exact = source.body.text.indexOf(visible);
        if (exact < 0 || source.body.text.indexOf(visible, exact + 1) >= 0) return;
        start = exact;
        end = exact + visible.length;
      }
    }
    if (end <= start) return;
    const point = (offset: number) => ({ section: page.index, offset });
    const firstChapter = await text.chapterAt(point(start));
    const lastChapter = await text.chapterAt(point(end - 1));
    const firstBase = paragraphAt(source.body, firstChapter?.start ?? 0);
    const lastBase = paragraphAt(source.body, lastChapter?.start ?? 0);
    let quote: ReadingSnapshot['selection'];
    if (selectedFrom >= from && selectedTo <= to && selectedTo > selectedFrom) {
      const chosen = live.text.slice(selectedFrom, selectedTo).trim();
      if (chosen) {
        let size = Math.min(chosen.length, 1200);
        const code = chosen.charCodeAt(size);
        if (code >= 0xdc00 && code <= 0xdfff) size--;
        const clipped = chosen.length > size || (explicit &&
          (rangeFrom !== selectedFrom || rangeTo !== selectedTo || (explicit.segments?.length ?? 0) > 1));
        quote = { text: chosen.slice(0, size) + (clipped ? '…（选区已截断）' : ''),
          end: point(source.body.text.slice(start, end) === visible ? start + selectedTo - from : end) };
      }
    }
    return {
      title: book.title.slice(0, 240),
      chapter: firstChapter?.entry.title ?? '正文',
      ...(lastChapter && lastChapter !== firstChapter ? { endChapter: lastChapter.entry.title } : {}),
      chapterSource: point(lastChapter?.start ?? firstChapter?.start ?? 0),
      firstParagraph: paragraphAt(source.body, start) - firstBase + 1,
      lastParagraph: paragraphAt(source.body, end - 1) - lastBase + 1,
      start: point(start),
      end: point(end),
      ...(quote ? { selection: quote } : {}),
    };
  }

  const onMessage = (event: MessageEvent) => {
    const request = event.data;
    if (event.source !== window.parent || event.origin !== window.location.origin ||
      request?.channel !== companionChannel || request.book !== book.hash) return;
    if (request.type === 'book-snapshot') {
      void snapshot().catch(() => undefined)
        .then((value) => { if (!disposed) send({ type: 'book-snapshot-reply', book: book.hash, id: request.id, value }); });
    }
    if (request.type === 'book-query') {
      void text.answer(request as BookRequest)
        .catch(() => ({ status: 'unavailable', message: '无法读取当前书籍的正文。' }))
        .then((value) => { if (!disposed) send({ type: 'book-reply', book: book.hash, id: request.id, value }); });
    }
  };
  window.addEventListener('message', onMessage);
  return {
    record,
    dispose() {
      disposed = true;
      if (registeredView && selectionSnapshots.get(registeredView) === snapshot) {
        selectionSnapshots.delete(registeredView);
      }
      observed?.removeEventListener('selectionchange', rememberSelection);
      window.removeEventListener('message', onMessage);
      send({ type: 'closed', book: book.hash });
    },
  };
}

