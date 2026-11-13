// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readingSyncState } from '@dsh-reader/sync-history';
import { type NovelSession } from '@dsh-reader/reading-history';
import type { ReadingProvenance } from '@dsh-reader/protocol';

const point = (offset: number) => ({ section: 0, offset });
const source: ReadingProvenance = { book: 'book', owner: 'session', indexVersion: 2, turn: 1,
  sync: { baseline: point(0), target: point(10), delivered: [{ start: point(0), end: point(10) }] } };
const makeSession = (events: { type: string; data: unknown }[], id = 'session'): NovelSession =>
  ({ id, seq: events.length, eventAt: (seq) => events[seq] });

describe('synchronization receipts', () => {
  it('requires a successful parent result and later reply before committing PTC reads', () => {
    const start = [{ type: 'turn/start', data: { turn: 1 } },
      { type: 'tool/ptc-dispatch', data: { rootCallId: 'outer', isError: false, meta: { novelReader: source } } }];
    const end = [{ type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: '回复' }] } } },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }];
    expect(readingSyncState(makeSession([...start, ...end]), 'book', 2).covered).toEqual([]);
    const completed = [...start, { type: 'tool/result', data: { message: { source: { callId: 'outer' }, isError: false } } }, ...end];
    expect(readingSyncState(makeSession(completed), 'book', 2).covered).toEqual(source.sync!.delivered);
    expect(readingSyncState(makeSession(completed, 'another-session'), 'book', 2).covered).toEqual([]);
    expect(readingSyncState(makeSession(completed), 'book', 3).covered).toEqual([]);
  });

});
