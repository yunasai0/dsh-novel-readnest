import { compareBookPoints, isBookPoint } from './book-bridge.js';
import type { BookPoint, ReadingSnapshot } from './protocol.js';

export const snapshotLabel = '小说阅读快照 ';
export interface NovelSession {
  id: string;
  seq: number;
  eventAt(seq: number): {
    type: string;
    data: {
      name?: string;
      callId?: string;
      turn?: number;
      meta?: { novelReader?: { book: string; point?: BookPoint } };
      message?: { callId?: string; isError?: boolean };
      source?: { kind?: string };
      content?: { type: string; text?: string }[];
    };
  } | undefined;
}

interface Exposure {
  scanned: number;
  calls: Set<string>;
  last?: BookPoint;
  unknown: boolean;
}
const history = new WeakMap<NovelSession, Exposure>();

export function historyConflict(session: NovelSession, book: string, snapshot: ReadingSnapshot) {
  const state = history.get(session) ?? { scanned: 0, calls: new Set<string>(), unknown: false };
  history.set(session, state);
  function record(origin: { book?: string; point?: BookPoint }) {
    if (origin.book !== book) {
      state.unknown = true;
      return;
    }
    if (isBookPoint(origin.point) && (!state.last || compareBookPoints(origin.point, state.last) > 0)) {
      state.last = origin.point;
    }
  }
  for (; state.scanned < session.seq; state.scanned++) {
    const event = session.eventAt(state.scanned);
    if (!event) continue;
    const { data, type } = event;
    if (type === 'tool/call' && data.name === 'read_novel' && data.callId) state.calls.add(data.callId);
    if (type === 'tool/result') {
      const mark = data.meta?.novelReader;
      if (mark) record(mark);
      else if (data.message?.callId && state.calls.has(data.message.callId) && !data.message.isError) state.unknown = true;
      if (data.message?.callId) state.calls.delete(data.message.callId);
    }
    if (type === 'user/message' && data.source?.kind === 'runtime-context') {
      const line = data.content?.[0]?.text?.split('\n').find((item) => item.startsWith(snapshotLabel));
      if (line) {
        try {
          record(JSON.parse(line.slice(snapshotLabel.length)));
        } catch {
          state.unknown = true;
        }
      }
    }
  }
  return state.unknown || (state.last !== undefined && compareBookPoints(state.last, snapshot.end) > 0);
}
