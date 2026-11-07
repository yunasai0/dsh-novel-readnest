import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction';
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { originalSurfaceSeq, recentTurnStart } from './recent-reading-turns.js';

class NoOlderReadingHistory extends Error {}

export default class NovelCompactionEngine extends BasicCompactionEngine {
  override async compactIfNeeded(...args: Parameters<BasicCompactionEngine['compactIfNeeded']>) {
    try {
      return await super.compactIfNeeded(...args);
    } catch (error) {
      if (error instanceof NoOlderReadingHistory) return null;
      throw error;
    }
  }

  override async compactRegion(...args: Parameters<BasicCompactionEngine['compactRegion']>) {
    const [start, end, agent, signal] = args;
    const { session } = agent;
    const boundary = recentTurnStart(session);
    if (boundary === undefined) return super.compactRegion(...args);
    const nodes = session.surface.nodes;
    const first = nodes.indexOf(start);
    const last = nodes.indexOf(end);
    if (first < 0 || last < first) return super.compactRegion(...args);
    let keep = nodes.findIndex((seq) => originalSurfaceSeq(session, seq) >= boundary);
    if (keep < 0 || last < keep) return super.compactRegion(...args);
    while (keep > first && !toolPairingBalancedBefore(session, nodes[keep]!)) keep--;
    if (keep <= first) throw new NoOlderReadingHistory('没有可自动压缩的较早阅读历史。');
    return super.compactRegion(start, nodes[keep - 1]!, agent, signal);
  }
}
