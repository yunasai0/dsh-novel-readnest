import { n as recentTurnStart, t as originalSurfaceSeq } from "./recent-reading-turns-CfqdXVWL.mjs";
import { ToolResultPruner } from "@deepseek-ai/dsh-compaction-tool-result-pruner";
import { freezeMessage } from "@deepseek-ai/dsh-llm";

//#region src/result-pruner.ts
var NovelResultPruner = class extends ToolResultPruner {
	pruneNovelContent(blocks) {
		const [original] = blocks;
		if (blocks.length !== 1 || original?.type !== "text") return null;
		let result;
		try {
			result = JSON.parse(original.text);
		} catch {
			return null;
		}
		if (!result || !Array.isArray(result.chapters) || result.chapters.some((chapter) => !chapter || typeof chapter !== "object")) return null;
		const passages = result.chapters.flatMap((chapter) => typeof chapter?.text === "string" ? [{
			type: "text",
			text: chapter.title + "\n" + chapter.text + "\n\n"
		}] : []);
		const excerpts = this.pruneContent(passages);
		if (!excerpts) return null;
		const text = JSON.stringify({
			...result,
			chapters: result.chapters.map(({ text: _text,...chapter }) => chapter),
			pruned: true,
			preview: excerpts.map((block) => block.type === "text" ? block.text : "").join("")
		});
		return this.measureContent([{
			type: "text",
			text
		}]) < this.measureContent(blocks) ? [{
			type: "text",
			text
		}] : null;
	}
	pruneSession(session) {
		const boundary = recentTurnStart(session);
		const pruned = [];
		let charsRemoved = 0;
		if (boundary === void 0) return {
			pruned,
			charsRemoved
		};
		const meter = this.ctx.get("tokenMeter");
		for (const seq of [...session.surface.nodes]) {
			const event = session.eventAt(seq);
			if (event?.type !== "tool/result" || originalSurfaceSeq(session, seq) >= boundary) continue;
			const meta = event.data.meta;
			if (!meta || typeof meta !== "object" || !("novelReader" in meta) || !meta.novelReader) continue;
			const original = session.deriveEventMessage(event);
			const content = this.pruneNovelContent(original.content);
			if (!content) continue;
			const charsBefore = this.measureContent(original.content);
			const charsAfter = this.measureContent(content);
			session.append("compaction/prune", {
				shadowedRange: {
					start: seq,
					end: seq
				},
				shadowedSeqs: [seq],
				shadowedTokenCount: meter.estimateMessage(original)
			});
			const replacement = session.append("tool/result", {
				...event.data,
				message: freezeMessage({
					...original,
					content
				})
			}, {
				surfaceOp: {
					op: "replace",
					startSeq: seq,
					endSeq: seq
				},
				sourceEventSeqs: [seq]
			});
			pruned.push({
				originalSeq: seq,
				replacementSeq: replacement.seq,
				callId: event.data.message.source.callId,
				charsBefore,
				charsAfter
			});
			charsRemoved += charsBefore - charsAfter;
		}
		return {
			pruned,
			charsRemoved
		};
	}
};

//#endregion
export { NovelResultPruner as default };