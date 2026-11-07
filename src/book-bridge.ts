import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  chapterBookBatchBudget, nearBookBatchBudget, roundBookBudget, type BookPoint, type BookQuery, type BookRequest,
  type BookResult, type ReaderResult, type ReadingSnapshot,
} from './protocol.js';
import { customPersonaPrompt } from './persona.js';
import { readLimitedBody } from './request-body.js';

interface Prepared {
  id: string;
  snapshot: ReadingSnapshot;
  protectedReading: boolean;
  persona?: string;
  expires: number;
}
interface Active extends Prepared {
  turn: number;
  used: number;
}
interface Pending {
  request: BookRequest;
  delivered: boolean;
  finish(result: ReaderResult): void;
}
interface Reader {
  book: string;
  token: string;
  instance: string;
  protectedReading: boolean;
  lastSeen: number;
  prepared?: Prepared;
  active?: Active;
  retry?: Prepared;
  pending: Map<string, Pending>;
  cursors: Map<string, { query: BookQuery; snapshot: ReadingSnapshot; resume: BookPoint; boundary?: BookPoint }>;
  poll?: (request: BookRequest | null) => void;
}
export type ToolResult = BookResult & { source?: { book: string; point?: BookPoint } };

const unavailable: ReaderResult = { status: 'unavailable', message: '阅读器位置不可用，请回到当前书籍的 AI 面板重试。' };
const identity = /^[a-zA-Z0-9_-]{8,160}$/;
export const compareBookPoints = (a: BookPoint, b: BookPoint) => a.section - b.section || a.offset - b.offset;

function json(res: ServerResponse, status: number, value: unknown) {
  if (!res.destroyed && !res.writableEnded) {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(value));
  }
}
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function isBookPoint(value: unknown): value is BookPoint {
  return !!value && typeof value === 'object' && 'section' in value && 'offset' in value
    && integer(value.section) && integer(value.offset);
}
function snapshotOf(value: unknown): ReadingSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const item = value as Partial<ReadingSnapshot>;
  if (typeof item.title !== 'string' || item.title.length > 240 ||
    typeof item.chapter !== 'string' || item.chapter.length > 160 ||
    (item.endChapter !== undefined && (typeof item.endChapter !== 'string' || item.endChapter.length > 160)) ||
    !integer(item.firstParagraph) || !integer(item.lastParagraph) ||
    !isBookPoint(item.start) || !isBookPoint(item.end) || compareBookPoints(item.start, item.end) >= 0) return;
  if (item.selection && (typeof item.selection.text !== 'string' || item.selection.text.length > 1240 ||
    !isBookPoint(item.selection.end) || compareBookPoints(item.selection.end, item.end) > 0)) return;
  if (item.chapterSource !== undefined &&
    (!isBookPoint(item.chapterSource) || compareBookPoints(item.chapterSource, item.end) >= 0)) return;
  return item as ReadingSnapshot;
}
function sourcePoint(result: ReaderResult) {
  return isBookPoint(result.last) ? result.last : undefined;
}
function visibleResult({ next: _next, last: _last, ...result }: ReaderResult): BookResult {
  return result;
}

export function createBookBridge(conflict: (session: string, book: string, snapshot: ReadingSnapshot) => boolean) {
  const readers = new Map<string, Reader>();
  let disposed = false;

  function clearReader(reader: Reader) {
    reader.poll?.(null);
    for (const pending of reader.pending.values()) pending.finish(unavailable);
    reader.active = undefined;
    reader.prepared = undefined;
    reader.retry = undefined;
    reader.cursors.clear();
  }
  function dispatch(reader: Reader) {
    const pending = [...reader.pending.values()].find((entry) => !entry.delivered);
    if (!pending || !reader.poll) return;
    pending.delivered = true;
    reader.poll(pending.request);
  }
  function live(session: string) {
    const reader = readers.get(session);
    return reader && Date.now() - reader.lastSeen < 35_000 ? reader : undefined;
  }
  function read(reader: Reader, request: Omit<BookRequest, 'id'>, signal: AbortSignal) {
    if (signal.aborted) return Promise.resolve(unavailable);
    const id = randomUUID();
    return new Promise<ReaderResult>((resolve) => {
      const abort = () => finish(unavailable);
      const timeout = setTimeout(abort, 12_000);
      const finish = (value: ReaderResult) => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        reader.pending.delete(id);
        resolve(value);
      };
      signal.addEventListener('abort', abort, { once: true });
      reader.pending.set(id, { request: { id, ...request }, delivered: false, finish });
      dispatch(reader);
    });
  }

  return {
    active(session: string) {
      return live(session)?.active;
    },
    persona(session: string) {
      const reader = live(session);
      if (reader?.active) return reader.active.persona;
      // DSH assembles its system prompt before the pre-step hook admits the prepared turn.
      const prepared = reader?.prepared;
      return prepared && prepared.expires >= Date.now() ? prepared.persona : undefined;
    },
    book(session: string) {
      return live(session)?.book;
    },
    admit(session: string, request: string, turn: number, retry = false) {
      const reader = live(session);
      if (!reader) return;
      if (reader.active?.id === request && reader.active.turn === turn) return reader.active;
      const prepared = reader.prepared;
      const pending = prepared?.id === request && prepared.expires >= Date.now()
        ? prepared : retry ? reader.retry : undefined;
      if (!pending || (reader.protectedReading && !pending.protectedReading)) return;
      if (pending === prepared) reader.prepared = undefined;
      reader.retry = pending;
      reader.active = { ...pending, turn, used: 0 };
      return reader.active;
    },
    finish(session: string, turn?: number) {
      const reader = readers.get(session);
      if (reader?.active && (turn === undefined || turn === reader.active.turn)) reader.active = undefined;
    },

    async query(session: string, input: BookQuery | { cursor: string }, signal: AbortSignal): Promise<ToolResult> {
      const reader = live(session);
      const active = reader?.active;
      if (!reader || !active || signal.aborted) return unavailable;
      const cursor = 'cursor' in input ? reader.cursors.get(input.cursor) : undefined;
      if ('cursor' in input && !cursor) return { status: 'invalid_cursor', message: '续读位置已失效，请重新查询原范围。' };
      const query = cursor?.query ?? input as BookQuery;
      const protectedReading = active.protectedReading || !!cursor?.boundary;
      const boundary = cursor?.boundary;
      const cutoff = boundary && (!active.protectedReading || compareBookPoints(boundary, active.snapshot.end) < 0)
        ? boundary : active.snapshot.end;
      const snapshot = cursor?.snapshot ?? active.snapshot;
      const remaining = roundBookBudget - active.used;
      if (remaining < 320) {
        return { status: 'ok', chapters: [], stopReason: 'round_budget',
          ...('cursor' in input ? { nextCursor: input.cursor } : {}) };
      }
      const batchBudget = query.kind === 'near' ? nearBookBatchBudget
        : query.kind === 'contents' ? 2_500 : chapterBookBatchBudget;
      const budget = Math.min(batchBudget, remaining);
      let limit = Math.min(batchBudget, remaining - 100);
      const nextCursor = randomUUID();
      // The reader estimates raw text length. JSON escapes can expand it, so refetch
      // from the same position before charging the budget or publishing a cursor.
      for (let attempt = 0; attempt < 3 && limit > 0; attempt++) {
        const result = await read(reader, { query, snapshot, protectedReading, cutoff, limit, resume: cursor?.resume }, signal);
        if (reader.active !== active || signal.aborted) return unavailable;
        const last = sourcePoint(result);
        if (last && protectedReading && compareBookPoints(last, cutoff) > 0) return unavailable;
        const output = visibleResult(result);
        const next = isBookPoint(result.next) && (!protectedReading || compareBookPoints(result.next, cutoff) <= 0)
          ? result.next : undefined;
        if (next) output.nextCursor = nextCursor;
        if (next && (remaining - JSON.stringify(output).length < 320 ||
          (output.chapters?.length === 0 && remaining < batchBudget))) output.stopReason = 'round_budget';
        const length = JSON.stringify(output).length;
        if (length > budget) {
          limit = Math.floor((limit - 1) * budget / length);
          continue;
        }
        if (next) {
          reader.cursors.set(nextCursor, {
            query, snapshot, resume: next, ...(protectedReading ? { boundary: cutoff } : {}),
          });
          if (reader.cursors.size > 80) reader.cursors.delete(reader.cursors.keys().next().value!);
        }
        active.used += length;
        return { ...output, source: { book: reader.book, ...(last ? { point: last } : {}) } };
      }
      if (remaining < batchBudget) {
        return { status: 'ok', chapters: [], stopReason: 'round_budget',
          ...('cursor' in input ? { nextCursor: input.cursor } : {}) };
      }
      return { status: 'unavailable', message: '结果超出单批读取额度，请缩小查询范围。' };
    },

    async handle(req: IncomingMessage, res: ServerResponse) {
      if (disposed || req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') {
        json(res, 405, null);
        return;
      }
      let body;
      try {
        const text = await readLimitedBody(req, 64 * 1024);
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
        reader = { book, token, instance, protectedReading: body.protectedReading !== false, lastSeen: Date.now(),
          pending: new Map(), cursors: new Map() };
        readers.set(session, reader);
      }
      if (!reader || reader.book !== book || reader.token !== token || reader.instance !== instance) {
        json(res, 403, null);
        return;
      }
      reader.lastSeen = Date.now();
      if (op === 'close') {
        clearReader(reader);
        readers.delete(session);
        json(res, 200, null);
        return;
      }
      if (op === 'hello' || op === 'protection') {
        const protection = body.protectedReading !== false;
        if (protection && !reader.protectedReading) {
          for (const pending of reader.pending.values()) pending.finish(unavailable);
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
        if (!snapshot || typeof id !== 'string' || !identity.test(id)) {
          json(res, 400, { message: unavailable.message });
          return;
        }
        if (reader.active || (reader.prepared && reader.prepared.id !== id && reader.prepared.expires > Date.now())) {
          json(res, 409, { message: '本书上一条消息仍在处理，请稍候。' });
          return;
        }
        const protectedReading = reader.protectedReading || body.protectedReading !== false;
        if (protectedReading && conflict(session, book, snapshot)) {
          json(res, 412, { message: '此会话曾查阅当前位置之后的内容。请按当前位置新建会话，或回到原阅读位置。' });
          return;
        }
        reader.prepared = {
          id, snapshot, protectedReading, persona: customPersonaPrompt(body.persona), expires: Date.now() + 90_000,
        };
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
      const complete = (request: BookRequest | null) => {
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

