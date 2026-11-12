import { md5 } from 'js-md5';
import { CFI, type BookDoc, type TOCItem } from '@/libs/document';
import type { FileSystem } from '@/types/system';
import { isChapterId, type BookChapter, type BookPoint } from '@dsh-reader/protocol';
export { isChapterId } from '@dsh-reader/protocol';
import { compareBookPoints, isBookPoint } from '@dsh-reader/reading-progress';
import { extractBookText, textOffset, type SectionText } from './text';
import { cleanNovelTitle, isProseHeading, splitMixedHeading } from '@/utils/novelHeadings';
import { bakeSectionLocations } from '@/services/nav/locations';
import { chapterNumberOf, volumeNumberOf } from '@dsh-reader/chapter-numbers';

export const NOVEL_INDEX_VERSION = 2;

export interface IndexedChapter extends BookChapter {
  start: BookPoint;
  end: BookPoint;
  href: string;
  cfi?: string;
  source: 'toc' | 'heading' | 'fallback';
  original_title?: string;
  aliases?: string[];
  issues: string[];
}

export interface NovelIndex {
  version: number;
  bookHash: string;
  sections: { href: string; length: number; nonempty: boolean; fingerprint: string; paragraphs: [number, number][] }[];
  chapters: IndexedChapter[];
  issues: string[];
}

type Mark = { title: string; href: string; volume?: string; group: boolean };
type Boundary = { point: BookPoint; title: string; source: IndexedChapter['source']; volume?: string;
  original?: string; aliases?: string[]; cfi?: string; issues: string[] };
const cleanTitle = (value: string) => cleanNovelTitle(value).slice(0, 160);
const sectionKey = (book: BookDoc, i: number) => book.sections[i]!.href ?? book.sections[i]!.id ?? String(i);
const numeral = '0-9零〇一二两兩三四五六七八九十百千万萬壹贰貳叁參肆伍陆陸柒捌玖拾佰仟';
const chapterHeading = new RegExp(`^(?:第[ ${numeral}]+[章回节節篇话話]|chapter\\s+(?:\\d+|[ivxlcdm]+)\\b|序章|楔子|前言|序言|后记|番外|外传)(?:[^。！？!?；;]{0,60})$`, 'i');
const majorHeading = new RegExp(`^(?:第[ ${numeral}]+[章回]|chapter\\s+(?:\\d+|[ivxlcdm]+)\\b)`, 'i');
const volumeHeading = new RegExp(`^(?:第?[ ${numeral}]+[卷部册冊]|[卷部][ ${numeral}]+|(?:volume|book|part)\\s+(?:\\d+|[ivxlcdm]+)\\b)`, 'i');

function rangeAt(doc: Document, text: SectionText, offset: number) {
  const range = doc.createRange();
  const span = text.spans.find((item) => item.end > offset) ?? text.spans.at(-1);
  if (span) range.setStart(span.node, Math.max(0, Math.min(span.node.length, offset - span.start)));
  else range.selectNodeContents(doc.body);
  range.collapse(true);
  return range;
}

function offsetOf(doc: Document, text: SectionText, node: Node) {
  if (node === doc.body) return 0;
  const range = doc.createRange();
  range.setStartBefore(node);
  range.collapse(true);
  return textOffset(range, text, false);
}

/** Build once, in spine order. No source document or existing CFI is rewritten. */
export async function buildNovelIndex(book: BookDoc, bookHash: string,
  onProgress?: (completed: number, total: number) => void): Promise<NovelIndex> {
  const sections: NovelIndex['sections'] = [];
  const issues: string[] = [];
  const marks = new Map<number, Mark[]>();
  const byHref = new Map(book.sections.map((_section, i) => [sectionKey(book, i), i]));
  const decode = (value: string) => { try { return decodeURI(value); } catch { return value; } };
  function visit(items: TOCItem[], inherited?: string) {
    let volume = inherited;
    for (const item of items) {
      const title = cleanTitle(item.label ?? '');
      const authoredChapter = majorHeading.test(title);
      const group = (!authoredChapter && !!item.subitems?.length) || volumeHeading.test(title);
      if (group && title && !/^(目录|正文|contents|table of contents)$/i.test(title)) volume = title;
      const [path] = book.splitTOCHref(item.href);
      const section = typeof path === 'string' ? byHref.get(path) ?? byHref.get(decode(path)) : undefined;
      if (section !== undefined && title) {
        const list = marks.get(section) ?? [];
        list.push({ title, href: item.href, volume, group });
        marks.set(section, list);
      } else if (item.href && !item.subitems?.length) issues.push('broken_toc: ' + title);
      // A chapter's subsections remain inside that chapter, rather than truncating its read range.
      if (item.subitems && !authoredChapter) visit(item.subitems, volume);
    }
  }
  visit(book.toc ?? []);
  const boundaries: Boundary[] = [];
  let volume: string | undefined;
  let firstText: BookPoint | undefined;
  const fingerprints = new Set<string>();
  let lastYield = performance.now();
  const documents = new Map<number, Promise<Document>>();
  const readAheadBudget = 2 * 1024 * 1024;
  const estimatedSize = (i: number) => book.sections[i]!.size > 0 ? book.sections[i]!.size : readAheadBudget;
  let nextDocument = 0;
  const preload = () => {
    let bytes = [...documents.keys()].reduce((total, i) => total + estimatedSize(i), 0);
    while (nextDocument < book.sections.length && documents.size < 3) {
      const size = estimatedSize(nextDocument);
      if (documents.size && bytes + size > readAheadBudget) break;
      const source = book.sections[nextDocument]!;
      const pending = Promise.resolve().then(() => source.createDocument());
      void pending.catch(() => {});
      documents.set(nextDocument++, pending);
      bytes += size;
    }
  };

  try {
    for (let section = 0; section < book.sections.length; section++) {
      if (performance.now() - lastYield >= 12) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
      onProgress?.(section, book.sections.length);
      const spine = book.sections[section]!;
      preload();
      const doc = await documents.get(section)!;
      documents.delete(section);
      if (!doc?.body) throw new Error(`无法建立小说索引：第 ${section + 1} 个正文文件不可读取。`);
      const body = extractBookText(doc);
      const fingerprint = md5(body.text);
      sections.push({ href: sectionKey(book, section), length: body.text.length, nonempty: !!body.text.trim(), fingerprint,
        paragraphs: body.paragraphs.map(({ start, end }) => [start, end]) });
      if (!body.text.trim()) continue;
      firstText ??= { section, offset: 0 };
      const duplicate = fingerprints.has(fingerprint);
      fingerprints.add(fingerprint);
      if (duplicate) issues.push('duplicate_text: ' + (spine.href ?? section));
      const txt = doc.body.hasAttribute('data-readest-txt-heading');
      if (doc.body.getAttribute('data-readest-txt-heading') === 'contents') {
        boundaries.push({ point: { section, offset: 0 }, title: '目录（原文）', source: 'fallback', issues: ['printed_contents'] });
        continue;
      }
      const generated = doc.body.getAttribute('data-readest-txt-heading') === 'generated';
      const nodes = [...doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p')]
        .filter((node) => !node.closest('nav,[hidden],[aria-hidden="true"]'));
      const headings = nodes.flatMap((node, i) => {
        const rawTitle = cleanTitle(node.textContent ?? '');
        const title = txt ? splitMixedHeading(rawTitle)?.title ?? rawTitle : rawTitle;
        const semantic = /^H[1-6]$/.test(node.tagName.toUpperCase());
        // New TXT fallback headings are technical chunks, not authored chapters.
        if (!title || title.length > 100 || (generated && semantic) || (txt && isProseHeading(title))) return [];
        if (!semantic && !chapterHeading.test(title) && !volumeHeading.test(title)) return [];
        return [{ title, node, index: i, offset: offsetOf(doc, body, node), semantic }];
      });
      // A dense list of short headings without prose is a printed TOC, not empty chapters.
      const dense = new Set<number>();
      for (let first = 0; first < headings.length;) {
        let last = first + 1;
        while (last < headings.length && headings[last]!.index === headings[last - 1]!.index + 1) last++;
        const run = headings.slice(first, last);
        if (run.filter((heading) => chapterHeading.test(heading.title)).length >= 3) {
          // A printed TOC can be followed immediately by the real first chapter.
          const tail = run.at(-1)!;
          const beginsBody = run.slice(0, -1).some((heading) => heading.title === tail.title) &&
            nodes[tail.index + 1] && !headings.some((heading) => heading.index === tail.index + 1);
          (beginsBody ? run.slice(0, -1) : run).forEach((heading) => dense.add(heading.offset));
        }
        first = last;
      }
      const candidates = new Map<number, Boundary>();
      for (const mark of marks.get(section) ?? []) {
        volume = mark.volume ?? volume;
        if (mark.group || generated || (txt && isProseHeading(mark.title))) continue;
        const [, fragment] = book.splitTOCHref(mark.href);
        let offset = 0;
        if (fragment) {
          const raw = String(fragment);
          const node = doc.getElementById(decodeURIComponentSafe(raw)) ?? doc.getElementsByName(raw)[0];
          if (!node || !doc.body.contains(node)) { issues.push('broken_anchor: ' + mark.href); continue; }
          offset = offsetOf(doc, body, node);
        } else {
          const match = headings.find((heading) => heading.title === mark.title && !dense.has(heading.offset));
          if (match) offset = match.offset;
        }
        if (offset >= body.text.length || dense.has(offset)) continue;
        const previous = candidates.get(offset);
        if (previous) {
          previous.aliases = [...new Set([...(previous.aliases ?? []), mark.title])];
          previous.issues.push('duplicate_toc_anchor');
        } else candidates.set(offset, { point: { section, offset }, title: mark.title,
          source: 'toc', volume: mark.volume ?? volume, issues: [] });
      }
      const hasTocBoundaries = candidates.size > 0;
      const hasMajorToc = [...candidates.values()].some((candidate) => majorHeading.test(candidate.title));
      const hasNumberedHeadings = headings.some((heading) => chapterHeading.test(heading.title));
      for (const heading of headings) {
        if (dense.has(heading.offset)) continue;
        if (volumeHeading.test(heading.title)) { volume = heading.title; continue; }
        const existing = candidates.get(heading.offset);
        if (existing) {
          if (chapterHeading.test(heading.title) && existing.title !== heading.title) {
            existing.original = existing.title;
            existing.title = heading.title;
            existing.issues.push('toc_title_mismatch');
          }
        } else if ((hasMajorToc ? majorHeading : chapterHeading).test(heading.title) || (!hasTocBoundaries && !hasNumberedHeadings)) candidates.set(heading.offset, { point: { section, offset: heading.offset }, title: heading.title,
          source: 'heading', volume, issues: heading.semantic ? [] : ['inferred_heading'] });
      }
      // A real volume heading belongs to the following chapter, without becoming another chapter.
      const sorted = [...candidates.values()].sort((a, b) => a.point.offset - b.point.offset);
      for (const boundary of sorted) {
        if (doc.body.getAttribute('data-readest-txt-heading-repair') === 'mixed') boundary.issues.push('mixed_heading_body');
        if (duplicate) boundary.issues.push('duplicate_text');
        try {
          boundary.cfi = CFI.joinIndir(spine.cfi ?? CFI.fake.fromIndex(section),
            CFI.fromRange(rangeAt(doc, body, boundary.point.offset)));
        } catch { /* Some non-EPUB formats have no usable CFI; href navigation still works. */ }
        boundaries.push(boundary);
      }
    }
  } finally {
    await Promise.allSettled(documents.values());
  }
  if (!firstText) throw new Error('无法建立小说索引：书籍没有可提取的正文。');
  if (!boundaries.length || compareBookPoints(boundaries[0]!.point, firstText) > 0) {
    boundaries.unshift({ point: firstText, title: '未分章正文', source: 'fallback', issues: ['unsectioned'] });
  }
  const last = sections.length - 1;
  const end = { section: last, offset: sections[last]!.length };
  const chapters: IndexedChapter[] = boundaries.map((boundary, i) => {
    const chapter_id = 'ch_' + md5(`${bookHash}:v${NOVEL_INDEX_VERSION}:${boundary.point.section}:${boundary.point.offset}`).slice(0, 16);
    return { chapter_id, title: boundary.title, kind: boundary.source === 'fallback' ? 'unsectioned' : 'chapter',
      ...(boundary.source !== 'fallback' && chapterNumberOf(boundary.title) ? { chapter_number: chapterNumberOf(boundary.title) } : {}),
      ...(boundary.volume ? { volume_title: boundary.volume } : {}), source: boundary.source,
      ...(boundary.volume && volumeNumberOf(boundary.volume) ? { volume_number: volumeNumberOf(boundary.volume) } : {}),
      ...(boundary.original ? { original_title: boundary.original } : {}),
      ...(boundary.aliases ? { aliases: boundary.aliases } : {}), issues: boundary.issues,
      start: boundary.point, end: boundaries[i + 1]?.point ?? end,
      href: sectionKey(book, boundary.point.section) + '#dsh-novel-' + chapter_id,
      ...(boundary.cfi ? { cfi: boundary.cfi } : {}) };
  });
  const seenTitles = new Set<string>();
  chapters.forEach((chapter, i) => {
    chapter.previous_id = chapters[i - 1]?.chapter_id;
    chapter.next_id = chapters[i + 1]?.chapter_id;
    if (seenTitles.has(chapter.title)) chapter.issues.push('repeated_title');
    seenTitles.add(chapter.title);
  });
  const index: NovelIndex = { version: NOVEL_INDEX_VERSION, bookHash, sections, chapters, issues };
  if (!validNovelIndex(index, book, bookHash)) throw new Error('小说索引校验失败：正文范围不连续。');
  onProgress?.(book.sections.length, book.sections.length);
  return index;
}

function decodeURIComponentSafe(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function validNovelIndex(value: unknown, book: BookDoc, hash: string): value is NovelIndex {
  if (!value || typeof value !== 'object') return false;
  const data = value as NovelIndex;
  if (data.version !== NOVEL_INDEX_VERSION || data.bookHash !== hash || !Array.isArray(data.sections) ||
    data.sections.length !== book.sections.length || !Array.isArray(data.chapters) || !data.chapters.length) return false;
  if (data.sections.some((section, i) => !section || section.href !== sectionKey(book, i) ||
    !Number.isSafeInteger(section.length) || section.length < 0 || typeof section.nonempty !== 'boolean' ||
    !/^[a-f0-9]{32}$/.test(section.fingerprint) || !Array.isArray(section.paragraphs) ||
    section.paragraphs.some((pair, j) => !Array.isArray(pair) || pair.length !== 2 ||
      !pair.every((offset) => Number.isSafeInteger(offset) && offset >= 0 && offset <= section.length) ||
      pair[0] > pair[1] || (j > 0 && section.paragraphs[j - 1]![1] > pair[0])))) return false;
  const firstSection = data.sections.findIndex((section) => section.nonempty);
  if (firstSection < 0 || !isBookPoint(data.chapters[0]?.start) ||
    compareBookPoints(data.chapters[0]!.start, { section: firstSection, offset: 0 }) !== 0) return false;
  const ids = new Set<string>();
  const validPoint = (point: BookPoint) => isBookPoint(point) && point.section < data.sections.length &&
    point.offset <= data.sections[point.section]!.length;
  return data.chapters.every((chapter, i) => {
    if (!chapter || !isChapterId(chapter.chapter_id) || ids.has(chapter.chapter_id) ||
      typeof chapter.title !== 'string' || !chapter.title || !Array.isArray(chapter.issues) ||
      !['chapter', 'unsectioned'].includes(chapter.kind) || !['toc', 'heading', 'fallback'].includes(chapter.source) ||
      typeof chapter.href !== 'string' ||
      !validPoint(chapter.start) || !validPoint(chapter.end) || compareBookPoints(chapter.start, chapter.end) >= 0 ||
      (i > 0 && compareBookPoints(data.chapters[i - 1]!.end, chapter.start) !== 0)) return false;
    ids.add(chapter.chapter_id);
    return chapter.previous_id === data.chapters[i - 1]?.chapter_id && chapter.next_id === data.chapters[i + 1]?.chapter_id;
  }) && data.chapters.at(-1)!.end.section === data.sections.length - 1 &&
    data.chapters.at(-1)!.end.offset === data.sections.at(-1)!.length;
}

/** Import persists the index before succeeding; old books are indexed once on open. */
export async function prepareNovelIndex(fs: Pick<FileSystem, 'readFile' | 'writeFile' | 'createDir'>,
  book: BookDoc, hash: string, onProgress?: (completed: number, total: number) => void) {
  if (book.novelIndex && validNovelIndex(book.novelIndex, book, hash)) return book.novelIndex;
  const path = `${hash}/novel-index.json`;
  try {
    const stored: unknown = JSON.parse(await fs.readFile(path, 'Books', 'text') as string);
    if (validNovelIndex(stored, book, hash)) return (book.novelIndex = stored);
  } catch { /* Missing or obsolete derived data is rebuilt from the unchanged book. */ }
  const index = await buildNovelIndex(book, hash, onProgress);
  await fs.createDir(hash, 'Books', true);
  await fs.writeFile(path, 'Books', JSON.stringify(index));
  book.novelIndex = index;
  return index;
}

const installed = new WeakSet<BookDoc>();
export function installNovelNavigation(book: BookDoc) {
  const index = book.novelIndex;
  if (!index) return;
  // All chapter anchors are already in the index; byte-based locations need no document parsing.
  bakeSectionLocations(book.sections);
  const locationAt = (point: BookPoint) => {
    const location = book.sections[point.section]?.location;
    if (!location) return undefined;
    const length = index.sections[point.section]!.length;
    return { ...location, current: location.current + Math.floor((location.next - location.current) *
      (length ? Math.min(point.offset / length, 1) : 0)) };
  };
  book.toc = index.chapters.map((chapter, i) => {
    const location = locationAt(chapter.start);
    return { id: i, index: chapter.start.section,
      label: chapter.volume_title ? `${chapter.volume_title} · ${chapter.title}` : chapter.title,
      href: chapter.href, ...(chapter.cfi ? { cfi: chapter.cfi } : {}),
      ...(location ? { location: { ...location, next: locationAt(chapter.end)?.current ?? location.next } } : {}) };
  });
  if (installed.has(book)) return;
  installed.add(book);
  const native = book as BookDoc & {
    resolveHref(href: string): unknown;
    getTOCFragment(doc: Document, id: string): Node | null;
  };
  const resolveHref = native.resolveHref?.bind(book);
  const fragment = native.getTOCFragment?.bind(book);
  const byHref = new Map(index.chapters.map((chapter) => [chapter.href, chapter]));
  const byFragment = new Map(index.chapters.map((chapter) => ['dsh-novel-' + chapter.chapter_id, chapter]));
  native.resolveHref = (href) => {
    const chapter = byHref.get(href);
    return chapter ? { index: chapter.start.section, anchor: (doc: Document) =>
      rangeAt(doc, extractBookText(doc), chapter.start.offset) } : resolveHref?.(href);
  };
  native.getTOCFragment = (doc, id) => {
    const chapter = byFragment.get(id);
    return chapter ? rangeAt(doc, extractBookText(doc), chapter.start.offset).startContainer : fragment?.(doc, id) ?? null;
  };
}
