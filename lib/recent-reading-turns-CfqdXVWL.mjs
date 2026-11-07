//#region src/recent-reading-turns.ts
const retainedTurns = 3;
function recentTurnStart(session) {
	let earliest;
	let completed = 0;
	const ended = /* @__PURE__ */ new Set();
	for (let index = Number(session.seq) - 1; index >= 0; index--) {
		const event = session.eventAt(index);
		if (event?.type === "turn/end") ended.add(event.data.turn);
		if (event?.type !== "turn/start") continue;
		earliest = event.seq;
		if (ended.has(event.data.turn) && ++completed === retainedTurns) break;
	}
	return earliest;
}
function originalSurfaceSeq(session, seq) {
	for (;;) {
		const event = session.eventAt(seq);
		const op = event && "surfaceOp" in event ? event.surfaceOp : void 0;
		if (typeof op !== "object" || op.op !== "replace" || op.startSeq >= seq) return seq;
		seq = op.startSeq;
	}
}

//#endregion
export { recentTurnStart as n, originalSurfaceSeq as t };