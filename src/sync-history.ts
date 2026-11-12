import type { BookPoint, ReadTask, ReadingLocation, ReadingProvenance, SyncState } from './protocol.js';
import { compareBookPoints, isBookPoint } from './reading-progress.js';
import { mergeBookRanges, validBookRange } from './reading-ranges.js';
import { novelEventData, snapshotLabel, type NovelSession } from './reading-history.js';

type Delivery = { seq: number; source: ReadingProvenance; parent?: string };

/** Derive committed synchronization from durable events, not volatile UI/Host state. */
export function readingSyncState(session: NovelSession | undefined, book: string, indexVersion: number): SyncState {
  const state: SyncState = { covered: [] };
  if (!session) return state;
  let turn = -1;
  let baseline: BookPoint | undefined;
  let replySeq = -1;
  let deliveries: Delivery[] = [];
  let completedTools = new Set<string>();
  for (let seq = 0; seq < session.seq; seq++) {
    const event = session.eventAt(seq);
    if (!event) continue;
    const data = novelEventData(event.data);
    if (event.type === 'turn/start') {
      turn = data.turn ?? -1; baseline = undefined; replySeq = -1; deliveries = []; completedTools = new Set();
    }
    if (event.type === 'user/message' && data.source?.kind === 'runtime-context') {
      const line = data.content?.flatMap((block) => block.text?.split('\n') ?? []).find((text) => text.startsWith(snapshotLabel));
      if (line) {
        try {
          const value = JSON.parse(line.slice(snapshotLabel.length)) as { book?: string; owner?: string; indexVersion?: number; reading?: ReadingLocation };
          if (value.book === book && value.owner === session.id && value.indexVersion === indexVersion &&
            validBookRange(value.reading)) {
            baseline ??= value.reading.start;
            // A baseline is a task origin, not a claim that its text was synchronized.
            state.baseline ??= value.reading.start;
          }
        } catch { /* Old context formats do not establish a synchronization baseline. */ }
      }
    }
    if (event.type === 'assistant/message' && data.turn === turn && !data.interrupted &&
      data.message?.content?.some((block) => block.type === 'text' && block.text?.trim())) replySeq = seq;
    if (event.type === 'tool/result' && !data.message?.isError) {
      const call = data.message?.callId ?? data.message?.source?.callId;
      if (call) completedTools.add(call);
    }
    if ((event.type === 'tool/result' && !data.message?.isError) || (event.type === 'tool/ptc-dispatch' && !data.isError)) {
      const source = data.meta?.novelReader;
      if (source?.owner === session.id && source.book === book && source.indexVersion === indexVersion &&
        source.turn === turn && source.sync && isBookPoint(source.sync.baseline) &&
        Array.isArray(source.sync.delivered) && source.sync.delivered.every(validBookRange)) {
        state.baseline ??= source.sync.baseline;
        deliveries.push({ seq, source, ...(event.type === 'tool/ptc-dispatch' ? { parent: data.rootCallId ?? data.parentCallId } : {}) });
      }
    }
    if (event.type === 'turn/end' && data.turn === turn && data.reason?.kind === 'completed') {
      if (replySeq >= 0) {
        state.baseline ??= baseline;
        for (const delivery of deliveries) {
          if (delivery.seq >= replySeq || (delivery.parent && !completedTools.has(delivery.parent))) continue;
          const sync = delivery.source.sync!;
          state.baseline ??= sync.baseline;
          state.covered = mergeBookRanges([...state.covered, ...sync.delivered]);
          state.has_gaps = state.covered.length > 1;
          if (sync.last && validBookRange(sync.last) && (!state.last || compareBookPoints(sync.last.end, state.last.end) > 0)) state.last = sync.last;
        }
      }
    }
  }
  return state;
}

export function recoverReadTask(session: NovelSession | undefined, book: string, cursor: string): ReadTask | undefined {
  if (!session) return undefined;
  for (let seq = session.seq - 1; seq >= 0; seq--) {
    const event = session.eventAt(seq);
    if (!event || (event.type !== 'tool/result' && event.type !== 'tool/ptc-dispatch')) continue;
    const data = novelEventData(event.data);
    if (data.isError || data.message?.isError) continue;
    const task = data.meta?.novelReader?.cursor;
    if (task?.id === cursor && task.owner === session.id && task.book === book) return task;
  }
  return undefined;
}
