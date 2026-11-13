import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { companionRequestBodyLimit, roundBookBudget, type BookPoint, type BookPoll, type BookQuery,
  type BookRequest, type BookResult, type BookToolQuery, type ReadTask, type ReaderResult,
  type ReadingProvenance, type ReadingSnapshot, type SyncState } from './protocol.js';
import { customPersonaPrompt } from './persona.js';
import { readLimitedBody } from './request-body.js';
import { compareBookPoints, isBookPoint, spoilerBoundaryOf } from './reading-progress.js';
import { clipBookRanges, countTextCharacters, mergeBookRanges, subtractBookRanges, validBookRange } from './reading-ranges.js';
import { budgetNotice, directoryRecovery, novelError, syncRecovery } from './novel-errors.js';
import { readingSyncState, recoverReadTask } from './sync-history.js';
import type { NovelSession } from './reading-history.js';
export { compareBookPoints, isBookPoint } from './reading-progress.js';

interface Prepared {
  id: string; snapshot: ReadingSnapshot; protectedReading: boolean; persona?: string;
  personaRemaining: number; expires: number;
}
interface Active extends Prepared {
  turn: number; used: number; state: SyncState; queue: Promise<void>;
  calls: Map<string, { key: string; result: Promise<ToolResult> }>;
}
interface Pending { request: BookRequest; delivered: boolean; finish(result: ReaderResult): void }
interface Reader {
  book: string; token: string; instance: string; indexVersion: number;
  protectedReading: boolean; lastSeen: number; prepared?: Prepared; active?: Active; retry?: Prepared;
  pending: Map<string, Pending>; cursors: Map<string, ReadTask>;
  poll?: (request: BookPoll | null) => void;
}
export type ToolResult = BookResult & { source?: ReadingProvenance };
const identity = /^[a-zA-Z0-9_-]{8,160}$/;
const unavailable = () => novelError('READER_DISCONNECTED', '当前书籍的阅读器连接不可用。',
  '可以先根据已有内容正常交流；需要新的原文时，再回到书页恢复阅读定位后取文。无需新建会话。');
const canceled = () => novelError('READ_CANCELED', '本次读取已取消，未推进同步进度。',
  '需要继续时重新发起当前读取或 sync_reading。', { next_call: syncRecovery });
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function json(res: ServerResponse, status: number, value: unknown) {
  if (!res.destroyed && !res.writableEnded) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(value));
  }
}
function snapshotOf(value: unknown): ReadingSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as ReadingSnapshot;
  if (typeof item.title !== 'string' || item.title.length > 240 || typeof item.chapter !== 'string' ||
    item.chapter.length > 160 || !integer(item.firstParagraph) || !integer(item.lastParagraph) || !validBookRange(item)) return undefined;
  const boundary = spoilerBoundaryOf(item);
  if (!isBookPoint(boundary) || compareBookPoints(boundary, item.end) < 0) return undefined;
  if (item.indexVersion !== undefined && !integer(item.indexVersion)) return undefined;
  if (item.reading && (!validBookRange(item.reading) || compareBookPoints(item.reading.end, boundary) > 0)) return undefined;
  for (const ranges of [item.visibleRanges, item.visitedRanges, item.reading?.ranges, item.selection?.ranges]) {
    if (ranges !== undefined && (!Array.isArray(ranges) || !ranges.every(validBookRange))) return undefined;
  }
  if (item.selection && (typeof item.selection.text !== 'string' || item.selection.text.length > 1240 ||
    !isBookPoint(item.selection.end) || compareBookPoints(item.selection.end, boundary) > 0 ||
    (item.selection.start && !validBookRange({ start: item.selection.start, end: item.selection.end })))) return undefined;
  if (item.chapterSource && (!isBookPoint(item.chapterSource) || compareBookPoints(item.chapterSource, item.end) >= 0)) return undefined;
  return item;
}
const compactSnapshot = (snapshot: ReadingSnapshot): ReadingSnapshot => {
  const { visitedRanges: _visited, ...rest } = snapshot;
  return rest;
};

export function createBookBridge(
  sessionOf: (id: string) => NovelSession | undefined = () => undefined,
) {
  const readers = new Map<string, Reader>();
  let disposed = false;
  function stateOf(session: string, reader: Reader) {
    return readingSyncState(sessionOf(session), reader.book, reader.indexVersion);
  }
  function clearReader(reader: Reader) {
    reader.poll?.(null);
    for (const pending of reader.pending.values()) pending.finish(unavailable());
    reader.active = undefined; reader.prepared = undefined; reader.retry = undefined;
    reader.cursors.clear();
  }
  function dispatch(reader: Reader) {
    const pending = [...reader.pending.values()].find((entry) => !entry.delivered);
    if (!pending || !reader.poll) return;
    pending.delivered = true; reader.poll(pending.request);
  }
  function live(session: string) {
    const reader = readers.get(session);
    return reader && Date.now() - reader.lastSeen < 35_000 ? reader : undefined;
  }
  function read(reader: Reader, request: Omit<BookRequest, 'id'>, signal: AbortSignal) {
    if (signal.aborted) return Promise.resolve<ReaderResult>(canceled());
    const id = randomUUID();
    return new Promise<ReaderResult>((resolve) => {
      const abort = () => finish(canceled());
      const timeout = setTimeout(() => finish(novelError('READER_TIMEOUT', '阅读器在 12 秒内没有返回正文。',
        '可以用相同参数重试一次；仍超时请重新打开本书。', { retryable: true })), 12_000);
      const finish = (value: ReaderResult) => {
        clearTimeout(timeout); signal.removeEventListener('abort', abort); reader.pending.delete(id); resolve(value);
      };
      signal.addEventListener('abort', abort, { once: true });
      reader.pending.set(id, { request: { id, ...request }, delivered: false, finish });
      dispatch(reader);
    });
  }
  function syncPlan(active: Active) {
    const reading = active.snapshot.reading ?? active.snapshot;
    const baseline = active.state.baseline ?? reading.start;
    const visited = mergeBookRanges([...(active.snapshot.visitedRanges ?? []),
      ...(active.snapshot.reading?.ranges ?? active.snapshot.visibleRanges ?? [{ start: reading.start, end: reading.end }])]);
    const requested = clipBookRanges(visited, baseline, reading.end);
    return { baseline, target: reading.end, has_gaps: requested.length > 1,
      ranges: subtractBookRanges(requested, active.state.covered) };
  }
  function saveTask(reader: Reader, task: ReadTask) {
    reader.cursors.set(task.id, task);
    if (reader.cursors.size > 100) reader.cursors.delete(reader.cursors.keys().next().value!);
  }

  async function perform(session: string, reader: Reader, active: Active, input: BookToolQuery, signal: AbortSignal): Promise<ToolResult> {
    if (signal.aborted) return canceled();
    if (reader.active !== active) return novelError('TURN_CONTEXT_CHANGED', '本轮阅读快照已结束或权限发生变化。',
      '请重新发送消息，以新的阅读快照读取正文。');
    const metadata: ReadingProvenance = { book: reader.book, owner: session, turn: active.turn,
      indexVersion: active.snapshot.indexVersion ?? 0 };
    let task: ReadTask | undefined;
    if ('cursor' in input) {
      task = reader.cursors.get(input.cursor) ?? recoverReadTask(sessionOf(session), reader.book, input.cursor);
      if (!task) return novelError('CURSOR_NOT_FOUND', '找不到属于本会话的续读任务。',
        '不要修改或拼接游标。增量同步请重新调用 sync_reading；指定章节请重新查询目录。', {
          next_call: input.cursor.startsWith('sync_') ? syncRecovery : directoryRecovery,
        });
      if (task.owner !== session || task.book !== reader.book) return novelError('CURSOR_WRONG_BOOK',
        '游标属于另一条会话或另一版本书籍。', '请在当前会话重新发起读取。', { next_call: directoryRecovery });
      if (task.indexVersion !== (active.snapshot.indexVersion ?? 0)) return novelError('CURSOR_INDEX_CHANGED',
        '章节索引已更新，旧游标不能定位当前正文。', '请重新同步当前位置或查询目录。', {
          next_call: task.sync ? syncRecovery : directoryRecovery,
        });
      if (!snapshotOf(task.snapshot)) return novelError('CURSOR_DAMAGED', '游标记录中的阅读定位不完整。',
        '请重新发起读取，不要猜测章节偏移。', { next_call: task.sync ? syncRecovery : directoryRecovery });
      if (task.sync && task.resume && task.query.kind === 'segments') {
        const prefix = clipBookRanges(task.query.ranges, task.sync.baseline, task.resume);
        if (subtractBookRanges(prefix, active.state.covered).length) return novelError('CURSOR_UNCOMMITTED',
          '上一批同步没有成功完成，直接续读会跳过尚未确认的正文。',
          '请调用 sync_reading，从已确认位置重新补齐。', { next_call: syncRecovery });
      }
    }
    let query: BookQuery;
    let sync = task?.sync;
    if (task) query = task.query;
    else if ('kind' in input && input.kind === 'sync') {
      const plan = syncPlan(active);
      sync = { baseline: plan.baseline, target: plan.target, has_gaps: plan.has_gaps };
      query = { kind: 'segments', ranges: plan.ranges };
      if (!plan.ranges.length) return { status: 'ok', chapters: [], stopReason: 'completed',
        message: '截至本轮阅读位置，没有需要补齐的新正文；讨论回翻位置可使用 read_current。',
        sync: { state: 'up_to_date', has_gaps: plan.has_gaps, target: plan.target }, source: metadata };
    } else query = input as BookQuery;
    if (task?.sync && query.kind === 'segments') {
      const left = clipBookRanges(query.ranges, task.resume ?? task.sync.baseline, task.sync.target);
      const missing = subtractBookRanges(left, active.state.covered);
      if (!missing.length) return { status: 'ok', chapters: [], stopReason: 'completed',
        message: '这个同步任务的正文已确认同步，无需重复读取。',
        sync: { state: 'up_to_date', has_gaps: task.sync.has_gaps, target: task.sync.target }, source: metadata };
      query = { kind: 'segments', ranges: missing };
    }
    const frozen = task?.snapshot ?? active.snapshot;
    const readingBoundary = spoilerBoundaryOf(active.snapshot);
    const protectedReading = active.protectedReading || !!task?.boundary;
    const cutoff = task?.boundary && (!active.protectedReading || compareBookPoints(task.boundary, readingBoundary) < 0)
      ? task.boundary : readingBoundary;
    const remaining = Math.max(0, roundBookBudget - active.used);
    const budget = (returned: number) => ({ limit_chars: roundBookBudget, returned_chars: returned,
      used_chars: active.used, remaining_chars: Math.max(0, roundBookBudget - active.used) });
    const cursorFor = (resume?: BookPoint, resolvedQuery = query): ReadTask => ({
      id: (sync ? 'sync_' : query.kind === 'contents' ? 'toc_' : 'read_') + randomUUID(),
      owner: session, book: reader.book, indexVersion: active.snapshot.indexVersion ?? 0,
      query: resolvedQuery, snapshot: compactSnapshot(frozen),
      ...(resume ? { resume } : {}), ...(protectedReading ? { boundary: cutoff } : {}), ...(sync ? { sync } : {}),
      ...(task?.current ? { current: task.current } : query.kind === 'near' ? { current: {
        baseline: active.state.baseline ?? (frozen.reading ?? frozen).start,
        target: (frozen.reading ?? frozen).end,
        ranges: frozen.reading?.ranges ?? [{ start: frozen.start, end: frozen.end }],
      } } : {}),
    });
    if (query.kind !== 'contents' && !remaining) {
      const cursor = task ?? cursorFor();
      saveTask(reader, cursor); metadata.cursor = cursor;
      return { status: 'blocked', chapters: [], stopReason: 'round_budget', end_notice: budgetNotice, message: budgetNotice,
        budget: budget(0), nextCursor: cursor.id, next_call: { tool: 'continue_reading', arguments: { cursor: cursor.id }, when: 'next_turn' },
        source: metadata };
    }
    const result = await read(reader, { query, snapshot: frozen, protectedReading, cutoff,
      limit: query.kind === 'contents' ? 0 : remaining, ...(task?.resume ? { resume: task.resume } : {}) }, signal);
    if (reader.active !== active || signal.aborted) return canceled();
    const returned = result.chapters?.reduce((sum, chapter) => sum + countTextCharacters(chapter.text ?? ''), 0) ?? 0;
    if (returned > remaining || (result.last && protectedReading && compareBookPoints(result.last, cutoff) > 0)) {
      return novelError('READ_VALIDATION_FAILED', '阅读器返回的正文超出了本轮额度或防剧透范围，结果已丢弃。',
        '请刷新阅读器后重新发送消息；本次没有推进同步进度。');
    }
    active.used += returned;
    const { next, last, deliveredRanges, resolvedRanges, limits: _limits, ...output } = result;
    if (last) metadata.point = last;
    if (next && (!protectedReading || compareBookPoints(next, cutoff) <= 0)) {
      const cursor = cursorFor(next, query.kind === 'near' && resolvedRanges ? { kind: 'segments', ranges: resolvedRanges } : query);
      saveTask(reader, cursor); metadata.cursor = cursor;
      output.nextCursor = cursor.id;
      output.next_call = { tool: 'continue_reading', arguments: { cursor: cursor.id },
        when: query.kind === 'contents' ? 'now' : 'next_turn' };
    }
    if (deliveredRanges?.length && !result.error) {
      const reading = frozen.reading ?? frozen;
      const baseline = sync?.baseline ?? task?.current?.baseline ?? active.state.baseline ?? reading.start;
      const target = sync?.target ?? task?.current?.target ?? reading.end;
      // Reading the current passage can establish the first synchronization, but arbitrary
      // chapter queries never jump the reading checkpoint past an unsynchronized gap.
      const eligible = sync ? deliveredRanges : query.kind === 'near' || task?.current
        ? deliveredRanges.flatMap((range) => clipBookRanges(task?.current?.ranges ?? frozen.reading?.ranges ?? [{ start: reading.start, end: reading.end }], range.start, range.end)) : [];
      const delivered = clipBookRanges(eligible, baseline, target);
      if (delivered.length) {
        const end = delivered.at(-1)!.end;
        const excerpt = result.chapters?.findLast((chapter) => chapter.range && compareBookPoints(chapter.range.start, end) < 0);
        const sameReadingEnd = compareBookPoints(end, reading.end) === 0;
        const label = excerpt ? { start: delivered[0]!.start, end, chapter_id: excerpt.chapter_id, chapter: excerpt.title,
          chapter_number: excerpt.chapter_number, volume_title: excerpt.volume_title,
          firstParagraph: excerpt.location?.start.paragraph ?? 1,
          lastParagraph: sameReadingEnd ? reading.lastParagraph : excerpt.location?.end.paragraph ?? 1 } : undefined;
        metadata.sync = { baseline, target, delivered, ...(label ? { last: label } : {}) };
        active.state.baseline ??= baseline;
        active.state.covered = mergeBookRanges([...active.state.covered, ...delivered]);
      }
    }
    if (sync) output.sync = { state: result.error ? 'pending' : next || result.stopReason !== 'completed' ? 'partial' : 'up_to_date',
      has_gaps: sync.has_gaps, target: sync.target };
    return { ...output, budget: budget(returned), source: metadata };
  }

  return {
    active(session: string) { return live(session)?.active; },
    state(session: string): SyncState {
      const reader = live(session);
      return reader ? stateOf(session, reader) : { covered: [] };
    },
    syncInfo(session: string) {
      const reader = live(session), active = reader?.active;
      if (!active) return undefined;
      const plan = syncPlan(active);
      return { state: !active.state.baseline ? 'not_started' : plan.ranges.length ? 'pending' : 'up_to_date',
        baseline: plan.baseline, target: plan.target, pending_ranges: plan.ranges.length,
        has_gaps: plan.has_gaps, last_synced: active.state.last };
    },
    persona(session: string) {
      const reader = live(session);
      if (reader?.active) return reader.active.persona;
      const prepared = reader?.prepared;
      return prepared && !prepared.personaRemaining && prepared.expires >= Date.now() ? prepared.persona : undefined;
    },
    book(session: string) { return live(session)?.book; },
    admit(session: string, request: string, turn: number, retry = false) {
      const reader = live(session);
      if (!reader) return undefined;
      if (reader.active?.id === request && reader.active.turn === turn) return reader.active;
      const prepared = reader.prepared;
      const pending = prepared?.id === request && prepared.expires >= Date.now() ? prepared : retry ? reader.retry : undefined;
      if (!pending || pending.personaRemaining || (reader.protectedReading && !pending.protectedReading)) return undefined;
      if (pending === prepared) reader.prepared = undefined;
      reader.retry = pending; reader.indexVersion = pending.snapshot.indexVersion ?? 0;
      reader.active = { ...pending, turn, used: 0, state: stateOf(session, reader), queue: Promise.resolve(), calls: new Map() };
      return reader.active;
    },
    finish(session: string, turn?: number) {
      const reader = readers.get(session);
      if (reader?.active && (turn === undefined || turn === reader.active.turn)) {
        reader.active = undefined;
        reader.poll?.({ type: 'sync-state', state: stateOf(session, reader) });
      }
    },
    async query(session: string, input: BookToolQuery, signal: AbortSignal, callId: string = randomUUID()): Promise<ToolResult> {
      const reader = live(session), active = reader?.active;
      if (!reader || !active) return unavailable();
      const key = JSON.stringify(input);
      const previous = active.calls.get(callId);
      if (previous) return previous.key === key ? previous.result : novelError('CALL_ID_CONFLICT',
        '同一个调用标识携带了不同读取参数。', '请使用新的工具调用重新发起请求。');
      const result = active.queue.then(() => perform(session, reader, active, input, signal)).catch((error: unknown) => {
        const reference = randomUUID();
        console.error('[novel-reader]', reference, error);
        return novelError('INTERNAL_READ_ERROR', '读取过程中发生内部异常，错误编号：' + reference,
          '请重新打开本书后重试；仍失败时请提供错误编号。本次未确认同步成功。', { retryable: true });
      });
      active.queue = result.then(() => {});
      active.calls.set(callId, { key, result });
      void result.then((value) => { if (value.error?.retryable) active.calls.delete(callId); });
      return result;
    },


    async handle(req: IncomingMessage, res: ServerResponse) {
      if (disposed || req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') {
        json(res, 405, null);
        return;
      }
      let body;
      try {
        const text = await readLimitedBody(req, companionRequestBodyLimit);
        if (!text) {
          if (text === null) res.shouldKeepAlive = false;
          json(res, 413, null);
          return;
        }
        body = JSON.parse(text);
      } catch {
        json(res, 400, null);
        return;
      }
      const { session, book, token, instance, op, id } = body ?? {};
      if (![session, book, token, instance].every((value) => typeof value === 'string' && identity.test(value))) {
        json(res, 400, null);
        return;
      }
      let reader = readers.get(session);
      if (op === 'hello' && (!reader || (reader.book === book && reader.token === token && reader.instance !== instance))) {
        if (reader) clearReader(reader);
        reader = { book, token, instance, indexVersion: integer(body.indexVersion) ? body.indexVersion : 0, protectedReading: body.protectedReading !== false, lastSeen: Date.now(),
          pending: new Map(), cursors: new Map() };
        readers.set(session, reader);
      }
      if (!reader || reader.book !== book || reader.token !== token || reader.instance !== instance) {
        json(res, 403, null);
        return;
      }
      reader.lastSeen = Date.now();
      if (op === 'state') { json(res, 200, stateOf(session, reader)); return; }
      if (reader.prepared && reader.prepared.expires < reader.lastSeen) reader.prepared = undefined;
      if (op === 'close') {
        clearReader(reader);
        readers.delete(session);
        json(res, 200, null);
        return;
      }
      if (op === 'hello' || op === 'protection') {
        const protection = body.protectedReading !== false;
        if (protection && !reader.protectedReading) {
          for (const pending of reader.pending.values()) pending.finish(unavailable());
          reader.active = undefined;
          reader.prepared = undefined;
          reader.retry = undefined;
        }
        reader.protectedReading = protection;
        json(res, 200, null);
        return;
      }
      if (op === 'prepare') {
        const snapshot = snapshotOf(body.snapshot);
        const personaRemaining = body.personaLength ?? 0;
        if (!snapshot || typeof id !== 'string' || !identity.test(id) ||
          !integer(personaRemaining) || (personaRemaining > 0 && body.persona !== undefined)) {
          json(res, 400, { message: unavailable().message });
          return;
        }
        if (reader.active || (reader.prepared && reader.prepared.id !== id)) {
          json(res, 409, { message: '本书上一条消息仍在处理，请稍候。' });
          return;
        }
        const protectedReading = reader.protectedReading || body.protectedReading !== false;
        reader.prepared = {
          id, snapshot, protectedReading, persona: customPersonaPrompt(body.persona), personaRemaining,
          expires: Date.now() + 90_000,
        };
        json(res, 200, null);
        return;
      }
      if (op === 'persona-chunk') {
        const prepared = reader.prepared;
        const { chunk, offset } = body;
        if (!prepared || prepared.id !== id || typeof chunk !== 'string' || !chunk.length ||
          chunk.length > prepared.personaRemaining || offset !== (prepared.persona?.length ?? 0)) {
          json(res, 409, null);
          return;
        }
        prepared.persona = (prepared.persona ?? '') + chunk;
        prepared.personaRemaining -= chunk.length;
        prepared.expires = Date.now() + 90_000;
        json(res, 200, null);
        return;
      }
      if (op === 'withdraw') {
        if (reader.prepared?.id === id) reader.prepared = undefined;
        json(res, 200, null);
        return;
      }
      if (op === 'reply') {
        const pending = reader.pending.get(id);
        const value = body.value as ReaderResult | undefined;
        if (!pending?.delivered || !value || typeof value.status !== 'string') {
          json(res, 404, null);
          return;
        }
        pending.finish(value);
        json(res, 200, null);
        return;
      }
      if (op !== 'poll') {
        json(res, 400, null);
        return;
      }
      const target = reader;
      target.poll?.(null);
      const timeout = setTimeout(() => complete(null), 20_000);
      const complete = (request: BookPoll | null) => {
        cleanup();
        json(res, 200, request);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        res.off('close', cleanup);
        if (target.poll === complete) target.poll = undefined;
      };
      res.once('close', cleanup);
      target.poll = complete;
      dispatch(target);
    },

    dispose() {
      disposed = true;
      for (const reader of readers.values()) clearReader(reader);
      readers.clear();
    },
  };
}

export type BookBridge = ReturnType<typeof createBookBridge>;

