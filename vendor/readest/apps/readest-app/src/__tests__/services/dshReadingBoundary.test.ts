// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBookBridge, type BookBridge } from '@dsh-reader/book-bridge';
import { historyConflict, type NovelSession } from '@dsh-reader/reading-history';
import type { BookPoint, BookRequest, ReadingSnapshot } from '@dsh-reader/protocol';

const point = (section: number, offset = 10): BookPoint => ({ section, offset });
const identity = { book: 'book-test-001', session: 'session-test-001', token: 'token-test-001', instance: 'instance-test-001' };
const snapshot = (boundary?: BookPoint): ReadingSnapshot => ({
  title: '测试小说', chapter: '第一章', firstParagraph: 1, lastParagraph: 1,
  start: point(0, 0), end: point(0), ...(boundary ? { spoilerBoundary: boundary } : {}),
});

describe('reading-history protection', () => {
  function session(exposed: BookPoint): NovelSession {
    return { id: identity.session, seq: 1, eventAt: () => ({
      type: 'tool/result', data: { meta: { novelReader: { book: identity.book, point: exposed } } },
    }) };
  }

  it('allows revisiting earlier pages but still blocks history beyond the furthest read point', () => {
    expect(historyConflict(session(point(2)), identity.book, snapshot(point(3)))).toBe(false);
    expect(historyConflict(session(point(3)), identity.book, snapshot(point(3)))).toBe(false);
    expect(historyConflict(session(point(4)), identity.book, snapshot(point(3)))).toBe(true);
  });

  it('keeps the conservative page-end fallback for older clients', () => {
    expect(historyConflict(session(point(2)), identity.book, snapshot())).toBe(true);
  });
});

describe('book bridge spoiler boundary', () => {
  let bridge: BookBridge;
  let server: Server;
  let endpoint: string;
  let turn: number;
  const signal = () => AbortSignal.timeout(2000);
  const post = (op: string, fields: Record<string, unknown> = {}) => fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...identity, op, ...fields }), signal: signal(),
  });
  async function prepare(value: ReadingSnapshot, protectedReading = true) {
    await post('protection', { protectedReading });
    const id = 'request-test-' + ++turn;
    const response = await post('prepare', { id, snapshot: value, protectedReading });
    expect(response.status).toBe(200);
    expect(bridge.admit(identity.session, id, turn)).toBeDefined();
  }

  beforeEach(async () => {
    turn = 0;
    bridge = createBookBridge(() => false);
    server = createServer((req, res) => { void bridge.handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    endpoint = 'http://127.0.0.1:' + address.port;
    expect((await post('hello')).status).toBe(200);
  });

  afterEach(async () => {
    bridge.dispose();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('keeps the current page for near queries while authorizing text up to the furthest point', async () => {
    await prepare(snapshot(point(3)));
    const result = bridge.query(identity.session, { kind: 'near', before: 2, after: 2 }, signal());
    const request = await (await post('poll')).json() as BookRequest;
    expect(request.snapshot.end).toEqual(point(0));
    expect(request.cutoff).toEqual(point(3));
    await post('reply', { id: request.id, value: { status: 'ok', last: point(2), chapters: [] } });
    expect((await result).status).toBe('ok');
  });

  it('does not advance old cursor permissions when later messages have a farther boundary', async () => {
    await prepare(snapshot(point(2)));
    const first = bridge.query(identity.session, { kind: 'range', start_chapter_id: 'ch_0000000000000001', end_chapter_id: 'ch_0000000000000004' }, signal());
    const request = await (await post('poll')).json() as BookRequest;
    await post('reply', { id: request.id, value: {
      status: 'ok', chapters: [], last: point(1), next: point(1), stopReason: 'batch_limit',
    } });
    const cursor = (await first).nextCursor!;
    expect(cursor).toBeDefined();
    bridge.finish(identity.session, turn);
    await prepare(snapshot(point(3)));
    const continuation = bridge.query(identity.session, { cursor }, signal());
    const next = await (await post('poll')).json() as BookRequest;
    expect(next.cutoff).toEqual(point(2));
    await post('reply', { id: next.id, value: { status: 'ok', chapters: [], last: point(2) } });
    expect((await continuation).status).toBe('ok');
  });

  it('rejects a cutoff behind the current page and rejects text beyond an admitted cutoff', async () => {
    expect((await post('prepare', { id: 'request-invalid', snapshot: snapshot(point(0, 1)) })).status).toBe(400);
    await prepare(snapshot(point(2)));
    const result = bridge.query(identity.session, { kind: 'chapter', chapter_id: 'ch_0000000000000004' }, signal());
    const request = await (await post('poll')).json() as BookRequest;
    await post('reply', { id: request.id, value: { status: 'ok', chapters: [], last: point(3) } });
    expect((await result).status).toBe('unavailable');
  });

  it('allows unrestricted reading when protection is off, without updating user reading progress', async () => {
    await prepare(snapshot(point(1)), false);
    const result = bridge.query(identity.session, { kind: 'chapter', chapter_id: 'ch_0000000000000008' }, signal());
    const request = await (await post('poll')).json() as BookRequest;
    expect(request.protectedReading).toBe(false);
    await post('reply', { id: request.id, value: { status: 'ok', chapters: [], last: point(7) } });
    expect((await result).status).toBe('ok');
    expect(bridge.active(identity.session)?.snapshot.spoilerBoundary).toEqual(point(1));
  });
});
