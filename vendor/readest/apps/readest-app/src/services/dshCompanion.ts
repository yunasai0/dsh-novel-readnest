import type { Book } from '@/types/book';
import type { FoliateView } from '@/types/view';
import type { BookDoc } from '@/libs/document';
import type { TextSelection } from '@/utils/sel';
import { companionChannel, type BookPoint, type BookRange, type BookRequest, type ReadingLocation, type ReadingSnapshot } from '@dsh-reader/protocol';
import { furthestPoint, readFurthestPoint, saveFurthestPoint } from '@dsh-reader/reading-progress';
import { clipBookRanges, mergeBookRanges } from '@dsh-reader/reading-ranges';
import { chapterNumberOf } from '@dsh-reader/chapter-numbers';
import { novelError } from '@dsh-reader/novel-errors';
import { comparable, createBookText, extractBookText, textOffset } from './dshBookText';
import { readVisitedRanges, saveVisitedRanges } from './novel/readingLedger';
import { isDshReader } from './dshReader';

export function isDshCompanionHost() {
  return isDshReader() && typeof window !== 'undefined' && window.parent !== window;
}
function send(message: Record<string, unknown>) {
  window.parent.postMessage({ channel: companionChannel, ...message }, window.location.origin);
}
function describeBook(book: Book) {
  const theme = getComputedStyle(document.querySelector('.header-bar') ?? document.body);
  return { id: book.hash, title: book.title, theme: {
    paper: theme.getPropertyValue('--color-base-100').trim(),
    ink: theme.getPropertyValue('--color-base-content').trim(),
    accent: theme.getPropertyValue('--color-primary').trim(),
  } };
}
export function openDshCompanion(book: Book) { send({ type: 'open', book: describeBook(book) }); }

const selectionSnapshots = new WeakMap<FoliateView, (selection: TextSelection) => Promise<ReadingSnapshot | undefined>>();
export async function discussDshSelection(book: Book, view: FoliateView, selection: TextSelection) {
  const snapshot = await selectionSnapshots.get(view)?.(selection).catch(() => undefined);
  if (!snapshot?.selection) return false;
  send({ type: 'open-selection', book: describeBook(book), snapshot });
  return true;
}

type RawRange = { index: number; cfi: string; range: Range };
type Position = ReadingLocation & { chapterSource?: BookPoint; endChapter?: string; end_chapter_id?: string };
type Recorded = { location: Position; visited: BookRange[] };

export function connectDshBook(book: Pick<Book, 'hash' | 'title'>, doc: BookDoc, getView: () => FoliateView | null) {
  const text = createBookText(doc, book.hash);
  let position: RawRange[] = [];
  let disposed = false;
  let registeredView: FoliateView | null = null;
  let furthestRead = readFurthestPoint(book.hash);
  let version = doc.novelIndex?.version ?? 0;
  let visited = readVisitedRanges(book.hash, version);
  const pendingReadings = new Set<Promise<Recorded | undefined>>();
  const selections = new Map<Document, Range>();
  const listeners = new Map<Document, () => void>();

  function watchSelection(owners: Set<Document>) {
    for (const [owner, listener] of listeners) {
      if (!owners.has(owner)) { owner.removeEventListener('selectionchange', listener); listeners.delete(owner); selections.delete(owner); }
    }
    for (const owner of owners) {
      if (listeners.has(owner)) continue;
      const listener = () => {
        const selection = owner.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed) selections.set(owner, selection.getRangeAt(0).cloneRange());
        else if (owner.hasFocus()) selections.delete(owner);
      };
      owner.addEventListener('selectionchange', listener); listeners.set(owner, listener);
    }
  }

  async function mapRange(raw: RawRange): Promise<BookRange | undefined> {
    const view = getView();
    const owner = raw.range.startContainer.ownerDocument;
    if (!view || !owner?.body) return undefined;
    const live = extractBookText(owner);
    const from = textOffset(raw.range, live, false), to = textOffset(raw.range, live, true);
    const visible = live.text.slice(from, to);
    if (!visible.trim()) return undefined;
    const source = await text.load(raw.index);
    if (!source) return undefined;
    let start = from, end = to;
    if (live.text !== source.body.text) {
      const anchor = view.resolveNavigation(raw.cfi);
      const range = anchor?.index === raw.index ? anchor.anchor?.(source.doc) : undefined;
      if (range && typeof range === 'object' && 'cloneRange' in range) {
        start = textOffset(range, source.body, false); end = textOffset(range, source.body, true);
      }
      if (comparable(source.body.text.slice(start, end)) !== comparable(visible)) {
        const exact = source.body.text.indexOf(visible);
        if (exact < 0 || source.body.text.indexOf(visible, exact + 1) >= 0) return undefined;
        start = exact; end = exact + visible.length;
      }
    }
    // DOM geometry can bisect a UTF-16 pair; a visible glyph must remain one source character.
    const lowSurrogate = (offset: number) => offset > 0 && offset < source.body.text.length &&
      /[\uDC00-\uDFFF]/.test(source.body.text[offset]!) && /[\uD800-\uDBFF]/.test(source.body.text[offset - 1]!);
    if (lowSurrogate(start)) start--;
    if (lowSurrogate(end)) end++;
    return end > start ? { start: { section: raw.index, offset: start }, end: { section: raw.index, offset: end } } : undefined;
  }

  async function lastCharacter(point: BookPoint): Promise<BookPoint> {
    const index = await text.getIndex();
    let section = point.section, offset = point.offset;
    while (!offset && section > 0) offset = index.sections[--section]!.length;
    return { section, offset: Math.max(0, offset - 1) };
  }

  async function locationOf(raws: RawRange[]): Promise<Position | undefined> {
    const mapped = await Promise.all(raws.map(mapRange));
    // A missing visible fragment must not silently turn a partial capture into a complete page.
    if (!mapped.length || mapped.some((range) => !range)) return undefined;
    const index = await text.getIndex();
    const ranges = mergeBookRanges((mapped as BookRange[]).map((range) => {
      let section = range.end.section, offset = range.end.offset;
      while (section < index.sections.length - 1 && offset === index.sections[section]!.length) { section++; offset = 0; }
      return { start: range.start, end: { section, offset } };
    }));
    const start = ranges[0]!.start, end = ranges.at(-1)!.end;
    const tail = await lastCharacter(end);
    const first = await text.chapterAt(start), last = await text.chapterAt(tail);
    return { start, end, ranges, chapter: first?.title ?? '正文',
      ...(first ? { chapter_id: first.chapter_id, chapter_number: chapterNumberOf(first.title), volume_title: first.volume_title } : {}),
      ...(last && last.chapter_id !== first?.chapter_id ? { endChapter: last.title, end_chapter_id: last.chapter_id } : {}),
      chapterSource: last?.start ?? first?.start ?? start,
      firstParagraph: await text.paragraphNumber(start), lastParagraph: await text.paragraphNumber(tail) };
  }

  async function ledgerRanges(ranges: BookRange[]): Promise<BookRange[]> {
    const index = await text.getIndex();
    return mergeBookRanges(await Promise.all(ranges.map(async (range) => {
      const source = await text.load(range.start.section);
      const tail = await text.load(range.end.section);
      if (!source || !tail) return range;
      let from = range.start.offset, to = range.end.offset;
      for (let n = 0; n < 64 && from > 0 && /\s/.test(source.body.text[from - 1]!); n++) from--;
      for (let n = 0; n < 64 && to < tail.body.text.length && /\s/.test(tail.body.text[to]!); n++) to++;
      let endSection = range.end.section;
      while (endSection < index.sections.length - 1 && to === index.sections[endSection]!.length) { endSection++; to = 0; }
      return { start: { section: range.start.section, offset: from }, end: { section: endSection, offset: to } };
    })));
  }

  function record(index: number, cfi: string, range: Range | null | undefined) {
    if (!range || !cfi || !doc.sections[index]) { position = []; return; }
    const view = getView();
    const visible = view?.renderer?.getVisibleRanges?.();
    const raw = visible?.length ? visible.map((item) => ({ index: item.index,
      range: item.range.cloneRange(), cfi: view!.getCFI(item.index, item.range) }))
      : [{ index, cfi, range: range.cloneRange() }];
    position = raw;
    watchSelection(new Set(raw.flatMap((item) => item.range.startContainer.ownerDocument ? [item.range.startContainer.ownerDocument] : [])));
    if (view && view !== registeredView) {
      if (registeredView) selectionSnapshots.delete(registeredView);
      registeredView = view; selectionSnapshots.set(view, snapshot);
    }
    const reading = locationOf(raw).then(async (location): Promise<Recorded | undefined> => {
      if (!location) return undefined;
      const index = await text.getIndex();
      if (version !== index.version) { version = index.version; visited = readVisitedRanges(book.hash, version); }
      const ranges = await ledgerRanges(location.ranges!);
      furthestRead = saveFurthestPoint(book.hash, furthestPoint(furthestRead, location.end)!);
      visited = saveVisitedRanges(book.hash, version, [...visited, ...ranges]);
      if (!disposed && position === raw) send({ type: 'position', book: book.hash, reading: location });
      return { location, visited: ranges };
    }).catch(() => undefined);
    pendingReadings.add(reading);
    void reading.then(() => pendingReadings.delete(reading));
  }

  function selectedRanges(explicit?: TextSelection): RawRange[] {
    const view = getView();
    if (!view) return [];
    const ranges = explicit ? explicit.segments?.map((segment) => segment.range) ?? [explicit.range] :
      [...listeners.keys()].flatMap((owner) => {
        const selected = owner.getSelection();
        const range = selected?.rangeCount && !selected.isCollapsed ? selected.getRangeAt(0) : selections.get(owner);
        return range ? [range] : [];
      });
    const contents = view.renderer?.getContents?.() ?? [];
    return ranges.flatMap((range) => {
      const owner = range.startContainer.ownerDocument;
      const index = contents.find((item) => item.doc === owner)?.index ??
        position.find((item) => item.range.startContainer.ownerDocument === owner)?.index;
      if (index === undefined) return [];
      return [{ index, range: range.cloneRange(), cfi: view.getCFI?.(index, range) ?? position.find((item) => item.index === index)?.cfi ?? '' }];
    });
  }

  async function snapshot(explicit?: TextSelection, quote?: ReadingSnapshot): Promise<ReadingSnapshot | undefined> {
    const raw = position;
    const selected = quote ? [] : selectedRanges(explicit);
    const savedBoundary = furthestPoint(furthestRead, readFurthestPoint(book.hash));
    const savedVisits = mergeBookRanges([...visited, ...readVisitedRanges(book.hash, version)]);
    const pending = Promise.all([...pendingReadings]);
    const currentPromise = locationOf(raw);
    const mappedSelection = Promise.all(selected.map(mapRange));
    const current = await currentPromise;
    if (!current) return undefined;
    const index = await text.getIndex();
    if (quote?.indexVersion !== undefined && quote.indexVersion !== index.version) return undefined;
    const records = (await pending).filter((value): value is Recorded => !!value);
    const spoilerBoundary = furthestPoint(savedBoundary, current.end, ...records.map((value) => value.location.end))!;
    let selection = quote?.selection;
    if (!quote) {
      const mapped = await mappedSelection;
      if (mapped.length && mapped.every(Boolean)) {
        const ranges = clipBookRanges(mapped as BookRange[], { section: 0, offset: 0 }, spoilerBoundary);
        let preview = '';
        for (const range of ranges) {
          for (let section = range.start.section; section <= range.end.section && preview.length <= 1200; section++) {
            const source = await text.load(section);
            if (!source) return undefined;
            const from = section === range.start.section ? range.start.offset : 0;
            const to = section === range.end.section ? range.end.offset : source.body.text.length;
            preview += source.body.text.slice(from, Math.min(to, from + 1201 - preview.length));
          }
        }
        if (ranges.length && preview.trim()) {
          const clipped = preview.length > 1200;
          let end = Math.min(1200, preview.length);
          if (end < preview.length && /[\uDC00-\uDFFF]/.test(preview[end]!)) end--;
          selection = { start: ranges[0]!.start, end: ranges.at(-1)!.end, ranges,
            text: preview.slice(0, end) + (clipped ? '…（选区已截断）' : '') };
        }
      }
    }
    return { ...(quote ?? current), title: book.title.slice(0, 240), reading: current,
      visibleRanges: quote?.visibleRanges ?? current.ranges, indexVersion: index.version, spoilerBoundary,
      visitedRanges: mergeBookRanges([...savedVisits, ...records.flatMap((value) => value.visited), ...current.ranges!]),
      ...(selection ? { selection } : {}) };
  }

  const onMessage = (event: MessageEvent) => {
    const request = event.data;
    if (event.source !== window.parent || event.origin !== window.location.origin ||
      request?.channel !== companionChannel || request.book !== book.hash) return;
    if (request.type === 'book-snapshot') {
      void snapshot(undefined, request.quoteSnapshot).catch(() => undefined)
        .then((value) => { if (!disposed) send({ type: 'book-snapshot-reply', book: book.hash, id: request.id, value }); });
    }
    if (request.type === 'book-query') {
      void text.answer(request as BookRequest).catch(() => novelError('TEXT_READ_FAILED',
        '读取正文时发生内部错误，尚不能确认具体损坏位置。', '请重新打开本书后重试；仍失败时检查书籍文件。'))
        .then((value) => { if (!disposed) send({ type: 'book-reply', book: book.hash, id: request.id, value }); });
    }
  };
  window.addEventListener('message', onMessage);
  return { record, dispose() {
    disposed = true;
    if (registeredView && selectionSnapshots.get(registeredView) === snapshot) selectionSnapshots.delete(registeredView);
    listeners.forEach((listener, owner) => owner.removeEventListener('selectionchange', listener));
    window.removeEventListener('message', onMessage);
    send({ type: 'closed', book: book.hash });
  } };
}

