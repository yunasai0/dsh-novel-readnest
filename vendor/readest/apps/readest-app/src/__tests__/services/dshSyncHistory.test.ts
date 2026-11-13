// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readingSyncState } from '@dsh-reader/sync-history';
import { historyConflict, readingHistoryConflict, type NovelSession } from '@dsh-reader/reading-history';
import type { ReadingProvenance, ReadingSnapshot } from '@dsh-reader/protocol';

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

  it('does not turn a structured parameter error into unknown spoiler exposure', () => {
    const session = makeSession([
      { type: 'tool/call', data: { name: 'read_chapters', callId: 'call' } },
      { type: 'tool/result', data: { message: { source: { callId: 'call' }, content: [{ type: 'text',
        text: JSON.stringify({ status: 'error', error: { code: 'INVALID_ARGUMENTS' } }) }] } } },
    ]);
    const snapshot = { start: point(0), end: point(10) } as ReadingSnapshot;
    expect(historyConflict(session, 'book', snapshot)).toBe(false);
  });

  it('allows existing conversations with a legacy empty sync receipt and no provenance', () => {
    const events = [
      { type: 'tool/call', data: { name: 'sync_reading', callId: 'sync-empty' } },
      { type: 'tool/result', data: { message: { source: { callId: 'sync-empty' }, content: [{ type: 'text',
        text: JSON.stringify({ status: 'ok', chapters: [], stop_reason: 'completed',
          message: '截至本轮阅读位置，没有需要补齐的新正文；讨论回翻位置可使用 read_current。',
          sync: { state: 'up_to_date', target: point(10) } }) }] } } },
    ];
    const session = makeSession(events);
    const snapshot = { start: point(0), end: point(10) } as ReadingSnapshot;
    expect(historyConflict(session, 'book', snapshot)).toBe(false);
    expect(historyConflict(session, 'book', snapshot)).toBe(false);
  });

  it('allows a legacy completed continuation with no new text but still blocks unlocated text', () => {
    const events = (chapters: unknown[]) => [
      { type: 'tool/call', data: { name: 'continue_reading', callId: 'continue-empty' } },
      { type: 'tool/result', data: { message: { source: { callId: 'continue-empty' }, content: [{ type: 'text',
        text: JSON.stringify({ status: 'ok', chapters, stop_reason: 'completed',
          sync: { state: 'up_to_date', target: point(10) } }) }] } } },
    ];
    const snapshot = { start: point(0), end: point(10) } as ReadingSnapshot;
    expect(historyConflict(makeSession(events([])), 'book', snapshot)).toBe(false);
    expect(historyConflict(makeSession(events([{ text: '没有定位的正文' }])), 'book', snapshot)).toBe(true);
    expect(readingHistoryConflict(makeSession(events([{ text: '没有定位的正文' }])), 'book', snapshot)).toBe('unknown_exposure');
    const exposed = [...events([]), { type: 'tool/result', data: {
      meta: { novelReader: { book: 'book', point: point(20) } },
    } }];
    expect(historyConflict(makeSession(exposed), 'book', snapshot)).toBe(true);
    expect(readingHistoryConflict(makeSession(exposed), 'book', snapshot)).toBe('beyond_reading_boundary');
    expect(historyConflict(makeSession(exposed), 'book', { ...snapshot, spoilerBoundary: point(20) })).toBe(false);
  });
});
