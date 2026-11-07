import type { ToolResultPruner } from '@deepseek-ai/dsh-compaction-tool-result-pruner';

type Session = Parameters<ToolResultPruner['pruneSession']>[0];
type Seq = Parameters<Session['eventAt']>[0];
const retainedTurns = 3;

export function recentTurnStart(session: Session) {
  let earliest: Seq | undefined;
  let completed = 0;
  const ended = new Set<number>();
  for (let index = Number(session.seq) - 1; index >= 0; index--) {
    const event = session.eventAt(index as Seq);
    if (event?.type === 'turn/end') ended.add(event.data.turn);
    if (event?.type !== 'turn/start') continue;
    earliest = event.seq;
    if (ended.has(event.data.turn) && ++completed === retainedTurns) break;
  }
  return earliest;
}

export function originalSurfaceSeq(session: Session, seq: Seq): Seq {
  // Replacement events are appended to the log but retain their old position in the model history.
  for (;;) {
    const event = session.eventAt(seq);
    const op = event && 'surfaceOp' in event ? event.surfaceOp : undefined;
    if (typeof op !== 'object' || op.op !== 'replace' || op.startSeq >= seq) return seq;
    seq = op.startSeq;
  }
}
