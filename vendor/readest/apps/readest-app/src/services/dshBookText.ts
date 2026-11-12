import type { BookDoc } from '@/libs/document';
import type { BookChapter, BookPoint, BookRange, BookRequest, ReaderResult } from '@dsh-reader/protocol';
import { compareBookPoints } from '@dsh-reader/reading-progress';
import { clipBookRanges, countTextCharacters, mergeBookRanges, textEndWithinBudget, validBookRange } from '@dsh-reader/reading-ranges';
import { chapterNumberOf, volumeMatches, volumeNumberOf } from '@dsh-reader/chapter-numbers';
import { budgetNotice, directoryRecovery, novelError, spoilerNotice } from '@dsh-reader/novel-errors';
import { buildNovelIndex, isChapterId, type IndexedChapter } from './novel/novelIndex';
import { extractBookText, paragraphAt, type SectionText } from './novel/text';
export { comparable, extractBookText, paragraphAt, textOffset } from './novel/text';

export function createBookText(book: BookDoc, bookHash: string) {
  const sections = new Map<number, Promise<{ doc: Document; body: SectionText } | undefined>>();
  const index = book.novelIndex ? Promise.resolve(book.novelIndex) : buildNovelIndex(book, bookHash)
    .then((value) => (book.novelIndex = value));
  void index.catch(() => {});
  function load(section: number) {
    const cached = sections.get(section);
    if (cached) { sections.delete(section); sections.set(section, cached); return cached; }
    const source = book.sections[section];
    if (!source) return Promise.resolve(undefined);
    const pending = Promise.resolve().then(() => source.createDocument())
      .then((doc) => doc?.body ? { doc, body: extractBookText(doc) } : undefined).catch(() => undefined);
    sections.set(section, pending);
    if (sections.size > 5) sections.delete(sections.keys().next().value!);
    return pending;
  }
  async function chapterAt(point: BookPoint) {
    return (await index).chapters.find((chapter) =>
      compareBookPoints(chapter.start, point) <= 0 && compareBookPoints(point, chapter.end) < 0);
  }
  async function paragraphNumber(point: BookPoint) {
    const chapter = await chapterAt(point);
    if (!chapter) return 1;
    const data = await index;
    let count = 0;
    for (let section = chapter.start.section; section <= point.section; section++) {
      for (const [start, end] of data.sections[section]!.paragraphs) {
        if (section === chapter.start.section && end <= chapter.start.offset) continue;
        if (section === point.section && start > point.offset) break;
        count++;
      }
    }
    return Math.max(1, count);
  }
  async function location(point: BookPoint, end = false) {
    const data = await index;
    let section = point.section, offset = point.offset;
    while (end && offset === 0 && section > 0) offset = data.sections[--section]!.length;
    const source = await load(section);
    const probe = { section, offset: end ? Math.max(0, offset - 1) : offset };
    const paragraph = source?.body.paragraphs[paragraphAt(source.body, probe.offset)];
    return { paragraph: await paragraphNumber(probe),
      character: source && paragraph ? countTextCharacters(source.body.text.slice(paragraph.start, offset)) + 1 : 1 };
  }

  async function moveCharacters(point: BookPoint, count: number, forward: boolean): Promise<BookPoint> {
    const data = await index;
    let section = point.section, offset = point.offset;
    while (count > 0) {
      const source = await load(section);
      if (!source) break;
      if (forward && offset === source.body.text.length) {
        if (section + 1 >= data.sections.length || count < 2) break;
        section++; offset = 0; count -= 2; continue;
      }
      if (!forward && offset === 0) {
        if (!section || count < 2) break;
        offset = data.sections[--section]!.length; count -= 2; continue;
      }
      if (forward) offset += source.body.text.codePointAt(offset)! > 0xffff ? 2 : 1;
      else {
        offset--;
        if (offset > 0 && /[\uDC00-\uDFFF]/.test(source.body.text[offset]!) && /[\uD800-\uDBFF]/.test(source.body.text[offset - 1]!)) offset--;
      }
      count--;
    }
    return { section, offset };
  }

  async function anchorCharacters(ranges: BookRange[], cap: number) {
    let total = 0;
    for (const range of ranges) {
      for (let section = range.start.section; section <= range.end.section; section++) {
        const source = await load(section);
        if (!source) continue;
        const from = section === range.start.section ? range.start.offset : 0;
        const until = section === range.end.section ? range.end.offset : source.body.text.length;
        const end = textEndWithinBudget(source.body.text, from, until, cap - total);
        total += countTextCharacters(source.body.text.slice(from, end));
        if (total >= cap) return total;
      }
    }
    return total;
  }

  async function answer(request: BookRequest): Promise<ReaderResult> {
    const data = await index;
    const { chapters } = data;
    const { query, snapshot, protectedReading, resume } = request;
    const limit = Math.max(0, Math.floor(request.limit));
    const bookEnd = { section: data.sections.length - 1, offset: data.sections.at(-1)!.length };
    if (snapshot.indexVersion !== undefined && snapshot.indexVersion !== data.version) return novelError(
      'INDEX_CHANGED', '本书的章节索引已经更新，原定位不能继续使用。', '请重新获取当前阅读位置或查询目录，再发起读取。', { next_call: directoryRecovery });
    const cutoff = protectedReading ? request.cutoff : bookEnd;
    const allowed = (chapter: IndexedChapter) => !protectedReading || compareBookPoints(chapter.start, cutoff) < 0;
    const byId = new Map(chapters.map((chapter) => [chapter.chapter_id, chapter]));
    const entry = (chapter: IndexedChapter): BookChapter => ({
      chapter_id: chapter.chapter_id, title: chapter.title, kind: chapter.kind,
      ...(chapter.kind === 'chapter' && chapterNumberOf(chapter.title) ? { chapter_number: chapterNumberOf(chapter.title) } : {}),
      ...(chapter.volume_title ? { volume_title: chapter.volume_title, volume_number: volumeNumberOf(chapter.volume_title) } : {}),
      ...(chapter.previous_id && allowed(byId.get(chapter.previous_id)!) ? { previous_id: chapter.previous_id } : {}),
      ...(chapter.next_id && allowed(byId.get(chapter.next_id)!) ? { next_id: chapter.next_id } : {}),
    });
    const spoilers = (): ReaderResult => ({ status: 'blocked', chapters: [], stopReason: 'spoiler_limit',
      limits: ['spoiler_limit'], message: spoilerNotice, end_notice: spoilerNotice });
    if (query.kind === 'contents') {
      const keyword = query.query?.trim().normalize('NFKC').toLocaleLowerCase();
      const matches = chapters.filter((chapter) => volumeMatches(chapter.volume_title, query.volume) &&
        (!query.chapter_numbers?.length || query.chapter_numbers.includes(chapterNumberOf(chapter.title) ?? -1)) &&
        (!keyword || ((chapter.volume_title ?? '') + ' ' + chapter.title).normalize('NFKC').toLocaleLowerCase().includes(keyword)));
      const visible = matches.filter(allowed);
      if (!visible.length && matches.length) return spoilers();
      const contents: BookChapter[] = [];
      let last: BookPoint | undefined;
      for (const chapter of visible) {
        if (resume && compareBookPoints(chapter.start, resume) < 0) continue;
        if (contents.length >= 30) return { status: 'partial', contents, stopReason: 'batch_limit', last, next: chapter.start };
        contents.push(entry(chapter)); last = chapter.start;
      }
      return { status: 'ok', contents, stopReason: 'completed', ...(last ? { last } : {}),
        ...(!contents.length ? { message: '可查目录没有匹配项。可移除卷名/标题筛选，或用 chapter_numbers 按原书章号查询。' } : {}) };
    }

    let ranges: BookRange[];
    if (query.kind === 'near') {
      ranges = mergeBookRanges(snapshot.selection?.ranges ??
        (snapshot.selection?.start ? [{ start: snapshot.selection.start, end: snapshot.selection.end }] :
          snapshot.visibleRanges ?? [{ start: snapshot.start, end: snapshot.end }]));
      if (!ranges.length) return novelError('POSITION_UNAVAILABLE', '当前讨论片段没有可靠的正文定位。',
        '请回到当前书页，重新选择原文或发送消息。');
      const anchorStart = { ...ranges[0]!.start }, anchorEnd = { ...ranges.at(-1)!.end };
      const anchorSize = await anchorCharacters(ranges, limit);
      const first = ranges[0]!, last = ranges.at(-1)!;
      let section = first.start.section;
      let paragraphs = data.sections[section]!.paragraphs;
      let p = paragraphs.findIndex(([, end]) => end > first.start.offset);
      if (p < 0) p = Math.max(0, paragraphs.length - 1);
      for (let n = 0; n < query.before; n++) {
        if (p > 0) p--;
        else if (section > 0) { section--; paragraphs = data.sections[section]!.paragraphs; p = paragraphs.length - 1; }
        else break;
      }
      if (paragraphs[p]) first.start = { section, offset: paragraphs[p]![0] };
      section = last.end.section;
      let tailOffset = last.end.offset;
      while (tailOffset === 0 && section > 0) tailOffset = data.sections[--section]!.length;
      paragraphs = data.sections[section]!.paragraphs;
      p = paragraphs.findIndex(([, end]) => end >= tailOffset);
      if (p < 0) p = Math.max(0, paragraphs.length - 1);
      for (let n = 0; n < query.after; n++) {
        if (p + 1 < paragraphs.length) p++;
        else if (section + 1 < data.sections.length) { section++; paragraphs = data.sections[section]!.paragraphs; p = 0; }
        else break;
      }
      if (paragraphs[p]) last.end = { section, offset: paragraphs[p]![1] };
      // Optional context must not displace the current page/selection when one paragraph is huge.
      const spare = Math.max(0, limit - anchorSize - 8);
      const before = Math.min(1000, Math.floor(spare * 2 / 3));
      const after = Math.min(500, spare - before);
      const nearestStart = await moveCharacters(anchorStart, before, false);
      const nearestEnd = await moveCharacters(anchorEnd, after, true);
      if (compareBookPoints(first.start, nearestStart) < 0) first.start = nearestStart;
      if (compareBookPoints(last.end, nearestEnd) > 0) last.end = nearestEnd;
      ranges = mergeBookRanges(ranges);
    } else if (query.kind === 'segments') {
      ranges = mergeBookRanges(query.ranges);
    } else {
      let selected: IndexedChapter[] = [];
      if (query.kind === 'numbers') {
        const resolveNumber = (number: number) => chapters.filter((chapter) => chapter.kind === 'chapter' &&
          chapterNumberOf(chapter.title) === number && volumeMatches(chapter.volume_title, query.volume));
        const starts = resolveNumber(query.start), ends = resolveNumber(query.end);
        if (starts.length > 1 || ends.length > 1) {
          const number = starts.length > 1 ? query.start : query.end;
          const candidates = (starts.length > 1 ? starts : ends).filter(allowed);
          return { ...novelError('AMBIGUOUS_CHAPTER', '原书第 ' + number + ' 章存在多个匹配，不能自动决定读取哪一处。',
            '请提供明确卷名；若仍重号，请从 candidates 复制 ID，使用 read_chapter_ids。', {
              next_call: { tool: 'novel_chapters', arguments: { chapter_numbers: [number] } },
            }), candidates: candidates.map(entry), ...(candidates.length ? { last: candidates.at(-1)!.start } : {}) };
        }
        if (!starts.length || !ends.length) return novelError('CHAPTER_NOT_FOUND',
          '找不到原书第 ' + (!starts.length ? query.start : query.end) + ' 章' + (query.volume ? '（卷名：' + query.volume + '）' : '') + '。',
          '数字只表示原书章号，不会回退为目录序号。请查询可读目录，核对卷名或改用章节 ID。', {
            next_call: { tool: 'novel_chapters', arguments: { chapter_numbers: [!starts.length ? query.start : query.end] } },
          });
        selected = [starts[0]!, ends[0]!];
      } else if (query.kind === 'ids') {
        if (!query.chapter_ids.length || query.chapter_ids.some((id) => !isChapterId(id))) return novelError(
          'INVALID_ARGUMENTS', 'chapter_ids 必须是非空的章节 ID 列表。', '请从 novel_chapters 返回的 chapter_id 复制，不要传章号或文件序号。', { next_call: directoryRecovery });
        for (const id of [...new Set(query.chapter_ids)]) {
          const chapter = byId.get(id);
          if (!chapter) return novelError('CHAPTER_NOT_FOUND', '章节 ID 不属于当前书籍索引：' + id,
            '书籍或索引可能已更换，请重新查询目录。', { next_call: directoryRecovery });
          selected.push(chapter);
        }
      } else {
        const firstId = query.kind === 'chapter' ? query.chapter_id : query.start_chapter_id;
        const lastId = query.kind === 'chapter' ? query.chapter_id : query.end_chapter_id;
        if (!isChapterId(firstId) || !isChapterId(lastId)) return novelError('INVALID_ARGUMENTS', '章节 ID 格式不正确。',
          '请复制目录中的 chapter_id；按原书章号读取请使用 read_chapters。', { next_call: directoryRecovery });
        const first = byId.get(firstId), last = byId.get(lastId);
        if (!first || !last) return novelError('CHAPTER_NOT_FOUND', '章节 ID 不属于当前书籍索引。',
          '请重新查询本书目录。', { next_call: directoryRecovery });
        selected = [first, last];
      }
      if (query.kind === 'ids') ranges = mergeBookRanges(selected.map((chapter) => ({ start: chapter.start, end: chapter.end })));
      else {
        const first = selected[0]!, last = selected.at(-1)!;
        if (compareBookPoints(first.start, last.start) > 0) return novelError('INVALID_ARGUMENTS',
          '起始章节在原文中位于结束章节之后。', '原书章号可能乱序；请查询目录后，用 read_chapter_ids 明确选择所需章节。', { next_call: directoryRecovery });
        ranges = [{ start: first.start, end: last.end }];
      }
    }
    if (ranges.some((range) => !validBookRange(range) || !data.sections[range.start.section] ||
      !data.sections[range.end.section] || range.start.offset > data.sections[range.start.section]!.length ||
      range.end.offset > data.sections[range.end.section]!.length)) return novelError('POSITION_OUTDATED',
        '正文定位与当前书籍文件不一致。', '请重新打开本书并获取当前阅读位置，不要自行修改游标。');
    const resolvedRanges = ranges;
    const clipped = protectedReading && ranges.some((range) => compareBookPoints(range.end, cutoff) > 0);
    ranges = clipBookRanges(ranges, resume ?? { section: 0, offset: 0 }, cutoff);
    if (!ranges.length) return clipped ? spoilers() : { status: 'ok', chapters: [], stopReason: 'completed', resolvedRanges, deliveredRanges: [] };
    const excerpts: NonNullable<ReaderResult['chapters']> = [];
    const deliveredRanges: BookRange[] = [];
    let remaining = limit;
    let next: BookPoint | undefined;
    let last: BookPoint | undefined;
    outer: for (const requested of ranges) {
      for (const chapter of chapters) {
        if (!allowed(chapter) || compareBookPoints(chapter.end, requested.start) <= 0 || compareBookPoints(chapter.start, requested.end) >= 0) continue;
        const from = compareBookPoints(requested.start, chapter.start) > 0 ? requested.start : chapter.start;
        const until = compareBookPoints(requested.end, chapter.end) < 0 ? requested.end : chapter.end;
        if (!remaining) { next = from; break outer; }
        let content = '';
        let reached = from;
        for (let section = from.section; section <= until.section; section++) {
          if (section === until.section && until.offset === 0) { reached = until; break; }
          const source = await load(section);
          if (!source) return novelError('TEXT_SECTION_UNAVAILABLE',
            '当前章节有一个正文文件无法读取，未提交本次同步进度。', '请重新打开本书后重试；若仍失败，请检查原书文件。', { retryable: true });
          const low = section === from.section ? from.offset : 0;
          const high = section === until.section ? until.offset : source.body.text.length;
          if (low >= high) { reached = { section, offset: high }; continue; }
          const separator = section > chapter.start.section && low === 0 ? '\n\n' : '';
          if (remaining <= separator.length) { next = { section, offset: low }; break; }
          const stop = textEndWithinBudget(source.body.text, low, high, remaining - separator.length);
          if (stop <= low) { next = { section, offset: low }; break; }
          const chunk = separator + source.body.text.slice(low, stop);
          content += chunk; remaining -= countTextCharacters(chunk);
          reached = { section, offset: stop };
          if (stop < high) { next = reached; break; }
        }
        if (content) {
          const range = { start: from, end: reached };
          excerpts.push({ ...entry(chapter), text: content,
            coverage: compareBookPoints(from, chapter.start) === 0 && compareBookPoints(reached, chapter.end) === 0 ? 'full' : 'partial',
            range, location: { start: await location(from), end: await location(reached, true) } });
          let endSection = reached.section, endOffset = reached.offset;
          while (endSection < data.sections.length - 1 && endOffset === data.sections[endSection]!.length) { endSection++; endOffset = 0; }
          deliveredRanges.push({ start: from, end: { section: endSection, offset: endOffset } }); last = reached;
        } else if (!next && compareBookPoints(from, reached) < 0) {
          // Crossing an empty file boundary carries no text, but still closes that exact interval.
          deliveredRanges.push({ start: from, end: reached });
        }
        if (next) break outer;
      }
    }
    const limits: NonNullable<ReaderResult['limits']> = [];
    if (clipped && !next) limits.push('spoiler_limit');
    if (next || (!remaining && clipped)) limits.push('round_budget');
    const notice = [limits.includes('spoiler_limit') ? spoilerNotice : '', limits.includes('round_budget') ? budgetNotice : ''].filter(Boolean).join('\n');
    if (notice && excerpts.length) excerpts[excerpts.length - 1]!.end_notice = notice;
    return { status: limits.length ? excerpts.length ? 'partial' : 'blocked' : 'ok',
      chapters: excerpts, resolvedRanges, deliveredRanges: mergeBookRanges(deliveredRanges),
      ...(last ? { last } : {}), ...(next ? { next } : {}),
      ...(limits.length ? { limits, end_notice: notice, message: notice } : {}),
      stopReason: next ? 'round_budget' : clipped ? 'spoiler_limit' : 'completed' };
  }
  return { load, chapterAt, paragraphNumber, answer, getIndex: () => index };
}

