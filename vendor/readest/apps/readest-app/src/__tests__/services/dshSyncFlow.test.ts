import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BookDoc } from '@/libs/document';
import { buildNovelIndex } from '@/services/novel/novelIndex';
import { createBookText } from '@/services/dshBookText';
import { createBookBridge, type BookBridge } from '@dsh-reader/book-bridge';
import { snapshotLabel, type NovelSession } from '@dsh-reader/reading-history';
import type { BookRequest, BookToolQuery, ReadingSnapshot } from '@dsh-reader/protocol';

const identity = { book: 'sync-book-fixture', session: 'sync-session-fixture', token: 'sync-token-fixture', instance: 'sync-instance-one' };
const point = (offset: number) => ({ section: 0, offset });
const snapshot = (start: number, end: number, visits = [{ start: point(0), end: point(end) }]): ReadingSnapshot => ({
  title: '同步测试', chapter: '未分章正文', firstParagraph: 1, lastParagraph: 1, indexVersion: 2,
  start: point(start), end: point(end), spoilerBoundary: point(end), visibleRanges: [{ start: point(start), end: point(end) }],
  reading: { start: point(start), end: point(end), ranges: [{ start: point(start), end: point(end) }],
    chapter: '未分章正文', firstParagraph: 1, lastParagraph: 1 }, visitedRanges: visits,
});

describe('durable incremental reading flow', () => {
  let events: { type: string; data: unknown }[];
  let session: NovelSession;
  let bridge: BookBridge;
  let server: Server;
  let endpoint: string;
  let turn: number;
  let call: number;
  let reader: ReturnType<typeof createBookText>;
  let chapterId: string;
  const signal = () => AbortSignal.timeout(4000);
  const append = (type: string, data: unknown) => { events.push({ type, data }); };
  const post = (op: string, fields: Record<string, unknown> = {}) => fetch(endpoint, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...identity, op, ...fields }), signal: signal() });
  async function begin(value: ReadingSnapshot) {
    const id = 'submission-' + ++turn;
    append('turn/start', { turn });
    expect((await post('prepare', { id, snapshot: value, protectedReading: true })).status).toBe(200);
    expect(bridge.admit(identity.session, id, turn)).toBeDefined();
    append('user/message', { source: { kind: 'runtime-context' }, content: [{ type: 'text', text: snapshotLabel +
      JSON.stringify({ owner: session.id, book: identity.book, indexVersion: 2, reading: value.reading }) }] });
  }
  function finish(kind: 'completed' | 'aborted' | 'error') {
    if (kind === 'completed') append('assistant/message', { turn, message: { content: [{ type: 'text', text: '依据取得的正文回答。' }] } });
    append('turn/end', { turn, reason: { kind } });
    bridge.finish(identity.session, turn);
  }
  async function dispatch(query: BookToolQuery) {
    const callId = 'tool-call-' + ++call;
    const result = bridge.query(identity.session, query, signal(), callId);
    // The expected successful reads reach the actual reader engine, through the HTTP poll bridge.
    const request = await (await post('poll')).json() as BookRequest;
    const value = await reader.answer(request);
    expect((await post('reply', { id: request.id, value })).status).toBe(200);
    const output = await result;
    append('tool/result', { turn, message: { callId, content: [{ type: 'text', text: JSON.stringify(output) }] },
      meta: { novelReader: output.source } });
    return output;
  }

  beforeEach(async () => {
    events = []; turn = call = 0;
    session = { id: identity.session, get seq() { return events.length; }, eventAt: (seq) => events[seq] };
    const doc = { sections: [{ id: 'novel.xhtml', createDocument: async () =>
      new DOMParser().parseFromString('<p>' + '甲'.repeat(70000) + '</p>', 'text/html') }],
      toc: [], splitTOCHref: (href: string) => href.split('#') } as unknown as BookDoc;
    doc.novelIndex = await buildNovelIndex(doc, identity.book);
    chapterId = doc.novelIndex.chapters[0]!.chapter_id;
    reader = createBookText(doc, identity.book);
    bridge = createBookBridge(() => false, () => session);
    server = createServer((req, res) => { void bridge.handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    endpoint = 'http://127.0.0.1:' + address.port;
    await post('hello', { indexVersion: 2 });
  });
  afterEach(async () => {
    bridge.dispose(); server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('commits only successful reading, then survives a Host restart and continues to the frozen target', async () => {
    await begin(snapshot(0, 1000));
    await dispatch({ kind: 'near', before: 3, after: 2 });
    expect(bridge.state(session.id).covered).toEqual([]);
    finish('completed');
    expect(bridge.state(session.id).covered).toEqual([{ start: point(0), end: point(1000) }]);

    await begin(snapshot(50000, 51000));
    const first = await dispatch({ kind: 'sync' });
    expect(first.budget).toMatchObject({ returned_chars: 30000, used_chars: 30000, remaining_chars: 0 });
    expect(first.chapters?.[0]?.range).toEqual({ start: point(1000), end: point(31000) });
    expect(first.next_call?.when).toBe('next_turn');
    finish('completed');
    expect(bridge.state(session.id).covered).toEqual([{ start: point(0), end: point(31000) }]);

    bridge.dispose(); events = JSON.parse(JSON.stringify(events));
    bridge = createBookBridge(() => false, () => session);
    await post('hello', { indexVersion: 2 });
    await begin(snapshot(60000, 61000));
    const continuation = await dispatch({ cursor: first.nextCursor! });
    expect(continuation.chapters?.[0]?.range).toEqual({ start: point(31000), end: point(51000) });
    expect(continuation.stopReason).toBe('completed');
    const newest = await dispatch({ kind: 'sync' });
    expect(newest.chapters?.[0]?.range).toEqual({ start: point(51000), end: point(61000) });
    expect(newest.budget?.used_chars).toBe(30000);
    finish('completed');
    expect(bridge.state(session.id).covered).toEqual([{ start: point(0), end: point(61000) }]);
  });

  it('retains the origin but never commits a canceled batch or skips it through an old cursor', async () => {
    await begin(snapshot(0, 1000)); finish('aborted');
    await begin(snapshot(49000, 50000));
    const canceledBatch = await dispatch({ kind: 'sync' });
    finish('aborted');
    expect(bridge.state(session.id).covered).toEqual([]);
    expect(bridge.state(session.id).baseline).toEqual(point(0));
    await begin(snapshot(59000, 60000));
    const rejected = await bridge.query(session.id, { cursor: canceledBatch.nextCursor! }, signal());
    expect(rejected.error?.code).toBe('CURSOR_UNCOMMITTED');
    const repeated = await dispatch({ kind: 'sync' });
    expect(repeated.chapters?.[0]?.range).toEqual({ start: point(0), end: point(30000) });
  });

  it('synchronizes only visited intervals after a jump and leaves arbitrary chapter reads out of the checkpoint', async () => {
    await begin(snapshot(0, 1000)); await dispatch({ kind: 'sync' }); finish('completed');
    const visits = [{ start: point(0), end: point(1000) }, { start: point(50000), end: point(51000) }];
    await begin(snapshot(50000, 51000, visits));
    const jumped = await dispatch({ kind: 'sync' });
    expect(jumped.chapters?.[0]?.range).toEqual({ start: point(50000), end: point(51000) });
    expect(jumped.sync?.has_gaps).toBe(true);
    await dispatch({ kind: 'chapter', chapter_id: chapterId });
    finish('completed');
    expect(bridge.state(session.id).covered).toEqual(visits);
  });

  it('serializes simultaneous reads and replays the same call without charging it again', async () => {
    await begin(snapshot(0, 70000));
    const query = { kind: 'chapter' as const, chapter_id: chapterId };
    const first = bridge.query(session.id, query, signal(), 'same-call');
    const replay = bridge.query(session.id, query, signal(), 'same-call');
    const second = bridge.query(session.id, query, signal(), 'second-call');
    const request = await (await post('poll')).json() as BookRequest;
    await post('reply', { id: request.id, value: await reader.answer(request) });
    const [a, b, c] = await Promise.all([first, replay, second]);
    expect(a).toEqual(b);
    expect(a.budget?.returned_chars).toBe(30000);
    expect(c.budget?.returned_chars).toBe(0);
    expect(c.stopReason).toBe('round_budget');
    expect(bridge.active(session.id)?.used).toBe(30000);
  });
});
