import { ToolResultPruner, type PruneResult } from '@deepseek-ai/dsh-compaction-tool-result-pruner';
import { freezeMessage, type ContentBlock, type ToolResultMessage } from '@deepseek-ai/dsh-llm';
import type { BookResult } from './protocol.js';
import { originalSurfaceSeq, recentTurnStart } from './recent-reading-turns.js';

type Session = Parameters<ToolResultPruner['pruneSession']>[0];

export default class NovelResultPruner extends ToolResultPruner {
  private pruneNovelContent(blocks: readonly ContentBlock[]): ContentBlock[] | null {
    const [original] = blocks;
    if (blocks.length !== 1 || original?.type !== 'text') return null;
    let result: BookResult;
    try {
      result = JSON.parse(original.text) as BookResult;
    } catch {
      return null;
    }
    if (!result || !Array.isArray(result.chapters) ||
      result.chapters.some((chapter) => !chapter || typeof chapter !== 'object')) return null;
    const passages: ContentBlock[] = result.chapters.flatMap((chapter) =>
      typeof chapter?.text === 'string'
        ? [{ type: 'text' as const, text: chapter.title + '\n' + chapter.text + '\n\n' }]
        : []);
    const excerpts = this.pruneContent(passages);
    if (!excerpts) return null;

    // Keep the JSON envelope, chapter coordinates and nextCursor intact.
    const text = JSON.stringify({
      ...result,
      chapters: result.chapters.map(({ text: _text, ...chapter }) => chapter),
      pruned: true,
      preview: excerpts.map((block) => block.type === 'text' ? block.text : '').join(''),
    });
    return this.measureContent([{ type: 'text', text }]) < this.measureContent(blocks)
      ? [{ type: 'text', text }] : null;
  }

  override pruneSession(session: Session): PruneResult {
    const boundary = recentTurnStart(session);
    const pruned: Array<PruneResult['pruned'][number]> = [];
    let charsRemoved = 0;
    if (boundary === undefined) return { pruned, charsRemoved };
    const meter = this.ctx.get('tokenMeter') as { estimateMessage(message: ToolResultMessage): number };

    for (const seq of [...session.surface.nodes]) {
      const event = session.eventAt(seq);
      if (event?.type !== 'tool/result' || originalSurfaceSeq(session, seq) >= boundary) continue;
      const meta = event.data.meta;
      if (!meta || typeof meta !== 'object' || !('novelReader' in meta) || !meta.novelReader) continue;

      const original = session.deriveEventMessage(event) as ToolResultMessage;
      const content = this.pruneNovelContent(original.content);
      if (!content) continue;
      const charsBefore = this.measureContent(original.content);
      const charsAfter = this.measureContent(content);
      session.append('compaction/prune', {
        shadowedRange: { start: seq, end: seq },
        shadowedSeqs: [seq],
        shadowedTokenCount: meter.estimateMessage(original),
      });
      const replacement = session.append('tool/result', {
        ...event.data, message: freezeMessage<ToolResultMessage>({ ...original, content }),
      }, {
        surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq },
        sourceEventSeqs: [seq],
      });
      pruned.push({ originalSeq: seq, replacementSeq: replacement.seq,
        callId: event.data.message.source.callId, charsBefore, charsAfter });
      charsRemoved += charsBefore - charsAfter;
    }
    return { pruned, charsRemoved };
  }
}
