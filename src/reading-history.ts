import { compareBookPoints, isBookPoint, spoilerBoundaryOf } from './reading-progress.js';
import type { BookPoint, ReadingProvenance, ReadingSnapshot } from './protocol.js';

export const snapshotLabel = '小说阅读快照 ';
export interface NovelSession {
  id: string;
  seq: number;
  eventAt(seq: number): { type: string; data: unknown } | undefined;
}
export interface NovelEventData {
      name?: string;
      callId?: string;
      turn?: number;
      rootCallId?: string;
      parentCallId?: string;
      subCallId?: string;
      reason?: { kind?: string };
      isError?: boolean;
      interrupted?: boolean;
      meta?: { novelReader?: ReadingProvenance };
      message?: { callId?: string; source?: { callId?: string }; isError?: boolean; content?: { type: string; text?: string }[] };
      source?: { kind?: string };
      content?: { type: string; text?: string }[];
}

export const novelEventData = (value: unknown): NovelEventData => value && typeof value === 'object' ? value as NovelEventData : {};

function isStructuredFailure(data: NovelEventData) {
  return (data.message?.content ?? data.content)?.some((block) => {
    if (block.type !== 'text' || !block.text) return false;
    try {
      const result = JSON.parse(block.text);
      return !!result.error?.code && (!Array.isArray(result.chapters) || result.chapters.every((chapter: { text?: string }) => !chapter.text));
    } catch { return false; }
  });
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
    const { type } = event;
    const data = novelEventData(event.data);
    if (type === 'tool/call' && data.name && ['read_novel', 'read_current', 'sync_reading', 'read_chapters', 'read_chapter_ids', 'novel_chapters', 'continue_reading'].includes(data.name) && data.callId) state.calls.add(data.callId);
    if (type === 'tool/result' || type === 'tool/ptc-dispatch') {
      const mark = data.meta?.novelReader;
      if (mark) record(mark);
      const call = data.message?.callId ?? data.message?.source?.callId;
      if (!mark && call && state.calls.has(call) && !data.message?.isError && !isStructuredFailure(data)) state.unknown = true;
      if (call) state.calls.delete(call);
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
  return state.unknown || (state.last !== undefined && compareBookPoints(state.last, spoilerBoundaryOf(snapshot)) > 0);
}
