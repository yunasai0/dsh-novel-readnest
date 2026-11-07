import type { BookDoc } from '@/libs/document';
import type { FoliateView } from '@/types/view';
import type {
  BookChapter,
  BookPoint,
  BookRequest,
  ChapterRef,
  ReaderResult,
} from '@dsh-reader/protocol';

const ignored = 'script,style,head,template,[hidden],[aria-hidden="true"],[cfi-inert]';
const block = 'p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,section,article,td,body';
export const comparable = (text: string) => text.replace(/\s+/g, ' ').trim();

export function extractBookText(doc: Document) {
  const spans: { node: Text; start: number; end: number }[] = [];
  const paragraphs: { start: number; end: number }[] = [];
  const parts: string[] = [];
  let length = 0;
  let parent: Element | null = null;
  if (doc.body) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (node.parentElement?.closest(ignored)) continue;
      const group = node.parentElement?.closest(block) ?? doc.body;
      if (group !== parent && !node.data.trim()) continue;
      if (group !== parent || paragraphs.length === 0) {
        if (length) {
          parts.push('\n\n');
          length += 2;
        }
        parent = group;
        paragraphs.push({ start: length, end: length });
      }
      parts.push(node.data);
      spans.push({ node, start: length, end: length + node.length });
      length += node.length;
      paragraphs[paragraphs.length - 1]!.end = length;
    }
  }
  return { text: parts.join(''), paragraphs, spans };
}

type SectionText = ReturnType<typeof extractBookText>;

export function textOffset(range: Range, book: SectionText, end: boolean) {
  const point = range.cloneRange();
  point.collapse(!end);
  const { startContainer, startOffset } = point;
  let previous = 0;
  for (const span of book.spans) {
    if (span.node === startContainer) return span.start + startOffset;
    if (point.comparePoint(span.node, 0) >= 0) return end ? previous : span.start;
    previous = span.end;
  }
  return previous;
}

export function paragraphAt(section: SectionText, offset: number) {
  let first = 0;
  let last = section.paragraphs.length;
  while (first < last) {
    const middle = (first + last) >>> 1;
    if (section.paragraphs[middle]!.end <= offset) first = middle + 1;
    else last = middle;
  }
  return Math.min(first, Math.max(0, section.paragraphs.length - 1));
}


const comparePoints = (a: BookPoint, b: BookPoint) => a.section - b.section || a.offset - b.offset;
const fallbackBlockSize = 16_000;
const digits = '零一二三四五六七八九';
const numerals = '0-9零〇一二两三四五六七八九十百千万';

function readNumber(value?: string): number | undefined {
  if (!value) return;
  if (/^\d+$/.test(value)) return Number(value) || undefined;
  if (/^[ivxlcdm]+$/i.test(value)) {
    const roman: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    const numbers = [...value.toLowerCase()].map((c) => roman[c]!);
    return numbers.reduce((sum, n, i) => sum + (n < (numbers[i + 1] ?? 0) ? -n : n), 0) || undefined;
  }
  const digitOf = (c: string) => digits.indexOf(c === '〇' ? '零' : c === '两' ? '二' : c);
  if (![...value].some((c) => '十百千万'.includes(c))) {
    return Number([...value].map(digitOf).join('')) || undefined;
  }
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  let total = 0;
  let part = 0;
  let digit = 0;
  for (const c of value) {
    const unit = units[c];
    if (unit === 10000) {
      total += (part + digit || 1) * unit;
      part = digit = 0;
    } else if (unit) {
      part += (digit || 1) * unit;
      digit = 0;
    } else {
      digit = Math.max(0, digitOf(c));
    }
  }
  return total + part + digit || undefined;
}
const chapterNumber = (title: string) => readNumber(
  title.match(new RegExp('第\\s*([' + numerals + ']+)\\s*[章回节]'))?.[1] ??
  title.match(/\bchapter\s+(\d+|[ivxlcdm]+)\b/i)?.[1],
);
const volumeNumber = (title: string) => readNumber(
  title.match(new RegExp('第?\\s*([' + numerals + ']+)\\s*[卷部]'))?.[1] ??
  title.match(new RegExp('^[卷部]\\s*([' + numerals + ']+)'))?.[1] ??
  title.match(/\b(?:volume|vol\.?|book)\s+(\d+|[ivxlcdm]+)\b/i)?.[1],
);

type Volume = { volume: number; volumeTitle: string };
type Mark = { title: string; href: string; number?: number; volume?: number; volumeTitle?: string };
type ChapterPart = { entry: BookChapter; start: number; end: number };

function safeOffset(text: string, offset: number) {
  const code = text.charCodeAt(offset);
  return code >= 0xdc00 && code <= 0xdfff ? offset - 1 : offset;
}

export function createBookText(book: BookDoc, getView: () => FoliateView | null) {
  const sections = new Map<number, Promise<{ doc: Document; body: SectionText } | undefined>>();
  // Keep the chapter boundaries after evicting a document. They are independent of reflow.
  const indexedParts = new Map<number, Promise<ChapterPart[]>>();
  let catalog: { marks: Map<number, Mark[]>; volumes: Map<number, Volume> } | undefined;

  function directory() {
    if (catalog) return catalog;
    const byHref = new Map(book.sections.flatMap((section, i) => section.href ? [[section.href, i] as const] : []));
    const marks = new Map<number, Mark[]>();
    const volumes = new Map<number, Volume>();
    const taken = new Set<number>();
    function collect(items: BookDoc['toc']) {
      for (const item of items ?? []) {
        const number = volumeNumber(item.label ?? '');
        if (number) taken.add(number);
        collect(item.subitems);
      }
    }
    collect(book.toc);
    let nextVolume = 1;
    function inferVolume() {
      while (taken.has(nextVolume)) nextVolume++;
      taken.add(nextVolume);
      return nextVolume++;
    }
    function visit(items: BookDoc['toc'], inherited?: Volume) {
      let current = inherited;
      const groups = items?.filter((item) => item.subitems?.length && !chapterNumber(item.label ?? '')).length ?? 0;
      for (const item of items ?? []) {
        const title = item.label?.trim().slice(0, 160);
        const number = title ? chapterNumber(title) : undefined;
        const namedVolume = title ? volumeNumber(title) : undefined;
        const group = !number && (namedVolume || (!inherited && groups > 1 && item.subitems?.length));
        if (title && (group || namedVolume)) {
          current = { volume: namedVolume ?? inferVolume(), volumeTitle: number ? '第 ' + namedVolume + ' 卷' : title };
        }
        const [href] = item.href ? book.splitTOCHref(item.href) : [];
        let index = typeof href === 'string' ? byHref.get(href) : undefined;
        if (index === undefined && typeof href === 'string') {
          try { index = byHref.get(decodeURI(href)); } catch { /* broken TOC target */ }
        }
        if (index === undefined && item.href) index = getView()?.resolveNavigation(item.href)?.index;
        if (index !== undefined && book.sections[index]) {
          if (current && !volumes.has(index)) volumes.set(index, current);
          if (title && !group) {
            const entries = marks.get(index) ?? [];
            entries.push({ title, href: item.href, ...(number ? { number } : {}), ...current });
            marks.set(index, entries);
          }
        }
        visit(item.subitems, current);
      }
    }
    visit(book.toc);
    // Unnamed spine items between two chapters inherit the preceding volume.
    let volume: Volume | undefined;
    for (let section = 0; section < book.sections.length; section++) {
      const known = volumes.get(section);
      if (known) volume = known;
      else if (volume) volumes.set(section, volume);
    }
    catalog = { marks, volumes };
    return catalog;
  }

  function load(index: number) {
    const cached = sections.get(index);
    if (cached) {
      sections.delete(index);
      sections.set(index, cached);
      return cached;
    }
    const section = book.sections[index];
    if (!section) return Promise.resolve(undefined);
    const promise = Promise.resolve().then(() => section.createDocument())
      .then((doc) => doc?.body ? { doc, body: extractBookText(doc) } : undefined)
      .catch(() => undefined);
    sections.set(index, promise);
    if (sections.size > 5) sections.delete(sections.keys().next().value!);
    return promise;
  }

  function anchorOffset(mark: Mark, data: { doc: Document; body: SectionText }) {
    const { doc, body } = data;
    const [, fragment] = book.splitTOCHref(mark.href);
    if (fragment === undefined || fragment === '') return 0;
    if (typeof fragment !== 'string') return;
    let id = fragment;
    try { id = decodeURIComponent(fragment); } catch { /* malformed encoding */ }
    const node = doc.getElementById(id) ?? doc.getElementById(fragment) ?? doc.getElementsByName(id)[0];
    if (!node || !doc.body.contains(node) || node.closest(ignored)) return;
    if (node === doc.body) return 0;
    const range = doc.createRange();
    range.setStartBefore(node);
    range.collapse(true);
    const offset = textOffset(range, body, false);
    return offset < body.text.length ? offset : undefined;
  }

  function parts(section: number) {
    const cached = indexedParts.get(section);
    if (cached) return cached;
    const promise = load(section).then((data): ChapterPart[] => {
      const { marks, volumes } = directory();
      const own = marks.get(section) ?? [];
      const size = data?.body.text.length || Infinity;
      const offsets = new Map<number, Mark | undefined>();
      if (data) {
        for (const mark of own) {
          const offset = anchorOffset(mark, data);
          if (offset === undefined) continue;
          const existing = offsets.get(offset);
          if (!existing || (!existing.number && mark.number)) offsets.set(offset, mark);
        }
        if (!offsets.size) {
          const { text, paragraphs } = data.body;
          let start = 0;
          while (text.length - start > fallbackBlockSize) {
            const desired = start + fallbackBlockSize;
            const paragraph = paragraphs[paragraphAt(data.body, desired)];
            start = paragraph && paragraph.start > start ? paragraph.start : safeOffset(text, desired);
            offsets.set(start, undefined);
          }
        }
      } else if (own[0]) {
        offsets.set(0, own[0]);
      }
      if (!offsets.has(0)) offsets.set(0, undefined);
      const starts = [...offsets.keys()].sort((a, b) => a - b);
      return starts.map((start, i) => {
        const mark = offsets.get(start);
        const sequence = section + 1;
        const part = i + 1;
        const entry: BookChapter = {
          id: 'section-' + sequence + (i ? '-part-' + part : ''),
          title: mark?.title ?? '正文 · 第 ' + sequence + ' 节' + (starts.length > 1 ? ' · 第 ' + part + ' 段组' : ''),
          sequence,
          ...(starts.length > 1 ? { part } : {}),
          ...volumes.get(section),
          ...(mark?.volume ? { volume: mark.volume, volumeTitle: mark.volumeTitle } : {}),
          ...(mark?.number ? { number: mark.number } : {}),
        };
        return { entry, start, end: starts[i + 1] ?? size };
      });
    });
    indexedParts.set(section, promise);
    return promise;
  }

  async function chapterAt(point: BookPoint) {
    const entries = await parts(point.section);
    return entries.find((part) => point.offset < part.end) ?? entries.at(-1);
  }

  async function answer(request: BookRequest): Promise<ReaderResult> {
    const { query, snapshot, protectedReading, resume, limit } = request;
    const cutoff = protectedReading ? request.cutoff : { section: book.sections.length - 1, offset: Infinity };
    const allowed = (part: ChapterPart) => !protectedReading ||
      comparePoints({ section: part.entry.sequence - 1, offset: part.start }, cutoff) < 0;
    const spoilers = (): ReaderResult => ({ status: 'ok', chapters: [], stopReason: 'spoiler_limit' });
    if (query.kind === 'contents') {
      const entries: BookChapter[] = [];
      let size = 0;
      let last: BookPoint | undefined;
      for (let section = resume?.section ?? 0; section <= cutoff.section; section++) {
        if (query.volume && !directory().marks.has(section) && directory().volumes.get(section)?.volume !== query.volume) continue;
        for (const part of await parts(section)) {
          if (!allowed(part) || (query.volume && part.entry.volume !== query.volume)) continue;
          if (resume?.section === section && part.start < resume.offset) continue;
          const cost = JSON.stringify(part.entry).length + 1;
          if (entries.length && (entries.length >= 30 || size + cost > limit)) {
            return { status: 'ok', contents: entries, stopReason: 'batch_limit', last,
              next: { section, offset: part.start } };
          }
          size += cost;
          entries.push(part.entry);
          last = { section, offset: part.start };
        }
      }
      return { status: 'ok', contents: entries, stopReason: 'completed', ...(last ? { last } : {}) };
    }

    async function resolve(ref: ChapterRef, volume?: number, legacy = false): Promise<ChapterPart[]> {
      if (ref === 'current') {
        const current = await chapterAt(snapshot.start);
        return current ? [current] : [];
      }
      if (typeof ref === 'string') {
        const id = /^section-(\d+)(?:-part-\d+)?$/.exec(ref);
        if (!id) return [];
        const section = Number(id[1]) - 1;
        if (!book.sections[section]) return [];
        if (protectedReading && section > cutoff.section) {
          return [{ entry: { id: '', title: '', sequence: section + 1 }, start: 0, end: Infinity }];
        }
        return (await parts(section)).filter(({ entry }) => entry.id === ref && (!volume || entry.volume === volume));
      }
      const { marks, volumes } = directory();
      const hasNumbers = !legacy && [...marks.values()].some((items) =>
        items.some((item) => item.number && (!volume || item.volume === volume)));
      if (hasNumbers) {
        const matches: ChapterPart[] = [];
        for (const [section, items] of marks) {
          if (!items.some((item) => item.number === ref && (!volume || item.volume === volume))) continue;
          if (protectedReading && section > cutoff.section) {
            // Retain the existence of a match for a blocked result, without loading its text or title.
            matches.push({ entry: { id: '', title: '', sequence: section + 1 }, start: 0, end: Infinity });
            continue;
          }
          matches.push(...(await parts(section)).filter(({ entry }) => entry.number === ref && (!volume || entry.volume === volume)));
        }
        return matches.sort((a, b) => a.entry.sequence - b.entry.sequence || a.start - b.start);
      }
      let section = ref - 1;
      if (volume) {
        section = [...volumes].filter(([, item]) => item.volume === volume).map(([i]) => i).sort((a, b) => a - b)[ref - 1] ?? -1;
      }
      if (!book.sections[section]) return [];
      if (protectedReading && section > cutoff.section) {
        return [{ entry: { id: '', title: '', sequence: section + 1 }, start: 0, end: Infinity }];
      }
      return (await parts(section)).slice(0, 1);
    }

    let start: BookPoint;
    let end: BookPoint;
    if (query.kind === 'near') {
      const first = await load(snapshot.start.section);
      const last = await load(snapshot.end.section);
      if (!first || !last) return { status: 'unavailable', message: '当前页暂无可提取的文字。' };
      start = { ...snapshot.start };
      end = { ...snapshot.end };
      if (query.before) {
        start.offset = first.body.paragraphs[Math.max(0, paragraphAt(first.body, start.offset) - query.before)]?.start ?? start.offset;
      }
      if (query.after) {
        end.offset = last.body.paragraphs[Math.min(last.body.paragraphs.length - 1,
          paragraphAt(last.body, Math.max(0, end.offset - 1)) + query.after)]?.end ?? end.offset;
      }
    } else {
      const refs = query.kind === 'range' ? query.chapters : [query.chapter];
      const matches = await Promise.all(refs.map((ref) => resolve(ref, query.volume, query.kind === 'chapter' && query.legacy)));
      if (matches.some((items) => !items.length)) return { status: 'not_found', message: '找不到指定章节，可先查询目录。' };
      for (const [i, items] of matches.entries()) {
        const candidates = items.filter(allowed);
        if (candidates.length > 1) {
          const last = candidates.at(-1)!;
          return { status: 'ambiguous', candidates: candidates.map(({ entry }) => entry),
            last: { section: last.entry.sequence - 1, offset: last.start },
            message: '章节编号有多个匹配项，请用卷号或章节 ID 查询。' };
        }
        if (candidates.length === 1) matches[i] = candidates;
        else if (i === 0) return spoilers();
        else matches[i] = [items[0]!];
      }
      const first = matches[0]![0]!;
      const last = matches.at(-1)![0]!;
      start = { section: first.entry.sequence - 1, offset: first.start };
      end = { section: last.entry.sequence - 1, offset: last.end };
      if (query.kind === 'chapter' && query.legacy) {
        const source = await load(end.section);
        end.offset = source?.body.text.length || Infinity;
      }
      if (comparePoints(start, { section: end.section, offset: last.start }) > 0) {
        return { status: 'invalid_request', message: '章节范围须按书中顺序。' };
      }
      if (query.kind === 'chapter' && query.paragraphs) {
        const data = await load(start.section);
        const [from, to] = query.paragraphs;
        const base = data ? paragraphAt(data.body, first.start) : 0;
        const paragraph = data?.body.paragraphs[base + from - 1];
        if (!paragraph || paragraph.start >= first.end) return { status: 'not_found', message: '找不到指定段落。' };
        start.offset = Math.max(first.start, paragraph.start);
        end.offset = Math.min(first.end, data?.body.paragraphs[base + to - 1]?.end ?? Infinity);
      }
    }
    const clipped = protectedReading && comparePoints(end, cutoff) > 0;
    if (clipped) end = cutoff;
    if (resume && comparePoints(resume, start) > 0) start = resume;
    if (comparePoints(start, end) >= 0) return clipped ? spoilers() : { status: 'ok', chapters: [], stopReason: 'completed' };

    const chapters: NonNullable<ReaderResult['chapters']> = [];
    let remaining = limit;
    let last: BookPoint | undefined;
    let next: BookPoint | undefined;
    sections: for (let section = start.section; section <= end.section; section++) {
      const data = await load(section);
      for (const part of await parts(section)) {
        const from = Math.max(part.start, section === start.section ? start.offset : 0);
        const requestedEnd = Math.min(part.end, section === end.section ? end.offset : Infinity);
        const to = data ? safeOffset(data.body.text, requestedEnd) : requestedEnd;
        if (!allowed(part) || from >= to) continue;
        const overhead = JSON.stringify(part.entry).length + 155;
        if (remaining < overhead + 4 && chapters.length) {
          next = { section, offset: from };
          break sections;
        }
        remaining -= overhead;
        if (!data?.body.text.length) {
          chapters.push({ ...part.entry, coverage: 'unavailable' });
          last = { section, offset: part.start };
          continue;
        }
        const { body } = data;
        let batchEnd = Math.min(to, from + Math.max(0, remaining));
        if (batchEnd < to) {
          const boundary = body.paragraphs[paragraphAt(body, batchEnd)]?.start;
          if (boundary !== undefined && boundary > from) batchEnd = boundary;
        }
        batchEnd = safeOffset(body.text, batchEnd);
        if (batchEnd <= from) {
          next = { section, offset: from };
          break sections;
        }
        const base = paragraphAt(body, part.start);
        const endPoint = { section, offset: batchEnd };
        chapters.push({ ...part.entry, coverage: from === part.start && batchEnd === part.end ? 'full' : 'partial',
          text: body.text.slice(from, batchEnd),
          paragraphs: [paragraphAt(body, from) - base + 1, paragraphAt(body, batchEnd - 1) - base + 1],
          range: { start: { section, offset: from }, end: endPoint } });
        remaining -= batchEnd - from;
        last = endPoint;
        if (batchEnd < to) {
          next = endPoint;
          break sections;
        }
      }
    }
    return { status: 'ok', chapters, ...(last ? { last } : {}), ...(next ? { next } : {}),
      stopReason: next ? 'batch_limit' : clipped ? 'spoiler_limit' : 'completed' };
  }
  return { load, chapterAt, answer };
}

