import { n as snapshotLabel, o as assembleNovelPrompt, r as compareBookPoints, t as historyConflict } from "./reading-history-djfCNejj.mjs";
import { defineTool } from "@deepseek-ai/dsh-tools";

//#region src/agent.ts
const name = "novel-reader-agent";
const inject = [
	"novelReader",
	"tools",
	"systemPrompt"
];
const positive = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const ref = (value) => positive(value) || typeof value === "string" && (value === "current" || /^section-[1-9]\d*(?:-part-[1-9]\d*)?$/.test(value));
const options = [
	"near",
	"chapter",
	"chapters",
	"volume",
	"paragraphs",
	"contents",
	"cursor",
	"action",
	"offset"
];
const selector = [
	"near",
	"chapter",
	"chapters",
	"contents",
	"cursor"
];
function queryOf(args) {
	if (Object.keys(args).some((key) => !options.includes(key))) return;
	const { action, offset, near, chapter, chapters, volume, paragraphs, contents, cursor } = args;
	const count = selector.filter((key) => args[key] !== void 0).length;
	if (count > 1 || volume !== void 0 && !positive(volume)) return;
	if (action !== void 0) {
		if (volume !== void 0 || paragraphs !== void 0) return;
		if (action === "current" && !count && offset === void 0) return {
			kind: "near",
			before: 0,
			after: 0
		};
		if (action === "contents" && !count && offset === void 0) return { kind: "contents" };
		if (action === "chapter" && count === 1 && positive(chapter) && (!offset || offset === 0)) return {
			kind: "chapter",
			chapter,
			legacy: true
		};
		return;
	}
	if (offset !== void 0 || paragraphs !== void 0 && chapter === void 0) return;
	if (cursor !== void 0) {
		if (typeof cursor === "string" && volume === void 0) return { cursor };
		return;
	}
	if (contents === true) return {
		kind: "contents",
		...volume ? { volume } : {}
	};
	if (Array.isArray(chapters) && chapters.length === 2 && ref(chapters[0]) && ref(chapters[1])) return {
		kind: "range",
		chapters: [chapters[0], chapters[1]],
		...volume ? { volume } : {}
	};
	if (ref(chapter)) {
		if (paragraphs !== void 0 && (!Array.isArray(paragraphs) || paragraphs.length !== 2 || !positive(paragraphs[0]) || !positive(paragraphs[1]) || paragraphs[1] < paragraphs[0])) return;
		return {
			kind: "chapter",
			chapter,
			...volume ? { volume } : {},
			...paragraphs ? { paragraphs } : {}
		};
	}
	if (volume !== void 0 || count && near === void 0) return;
	if (near && typeof near === "object") {
		const { before = 0, after = 0 } = near;
		if ([before, after].some((n) => !Number.isSafeInteger(n) || n < 0)) return;
		return {
			kind: "near",
			before,
			after
		};
	}
	if (!count) return {
		kind: "near",
		before: 2,
		after: 2
	};
}
function apply(ctx) {
	const bridge = ctx.novelReader;
	ctx.systemPrompt.suppressRuntimeContext();
	ctx.systemPrompt.section({
		name: "novel-reader-persona",
		order: 100,
		complete: true,
		interpolate: false,
		text: ({ agent }) => assembleNovelPrompt(agent ? bridge.persona(agent.session.id) : void 0)
	});
	ctx.on("agent/pre-step", async ({ agent, turn }, next) => {
		const decision = await next();
		if (decision.kind !== "enter") return decision;
		const session = agent.session;
		const user = decision.messages.find(({ source }) => source?.kind === "user" || source?.kind === "retry");
		if (!user) return decision;
		const rpcId = user.source?.rpcId;
		const active = rpcId ? bridge.admit(session.id, rpcId, turn, user.source?.kind === "retry") : void 0;
		const book = bridge.book(session.id);
		if (!active || !book) return { kind: "reject" };
		if (active.protectedReading && historyConflict(session, book, active.snapshot)) {
			bridge.finish(session.id, turn);
			return { kind: "reject" };
		}
		return decision;
	});
	ctx.on("session/event", (session, event) => {
		if (event.type === "turn/end") bridge.finish(session.id, event.data.turn);
	});
	ctx.systemPrompt.context({
		name: "novel-reader-position",
		order: 100,
		required: true,
		interpolate: false,
		text({ agent }) {
			if (!agent) return "";
			const session = agent.session.id;
			const active = bridge.active(session);
			const book = bridge.book(session);
			if (!active || !book) return "";
			const { title, chapter, endChapter, chapterSource, firstParagraph, lastParagraph, selection, start } = active.snapshot;
			const heading = chapterSource ?? {
				section: start.section,
				offset: 0
			};
			const point = selection && compareBookPoints(selection.end, heading) > 0 ? selection.end : heading;
			return snapshotLabel + JSON.stringify({
				book,
				point,
				title,
				chapter,
				endChapter,
				firstParagraph,
				lastParagraph,
				spoilerProtection: active.protectedReading,
				...selection ? { selection: selection.text } : {}
			});
		}
	});
	const chapterSchema = { oneOf: [{ type: "integer" }, { type: "string" }] };
	ctx.tools.register(defineTool({
		name: "read_novel",
		description: "Read the novel bound to this session. Call with no arguments for the current page, chapter: \"current\" for this chapter, chapters: [first,last] for a range, contents: true for chapter IDs, or cursor to continue. Spoiler protection is enforced at the frozen page boundary.",
		parameters: {
			near: {
				type: "object",
				additionalProperties: false,
				properties: {
					before: { type: "integer" },
					after: { type: "integer" }
				},
				description: "Extend the visible passage by this many paragraphs before and after it."
			},
			chapter: {
				...chapterSchema,
				description: "Chapter number, directory ID, or \"current\"."
			},
			chapters: {
				type: "array",
				items: chapterSchema,
				description: "Exactly two inclusive chapter numbers or directory IDs."
			},
			volume: {
				type: "integer",
				description: "Optional volume number for chapter, chapters, or contents."
			},
			paragraphs: {
				type: "array",
				items: { type: "integer" },
				description: "Optional inclusive 1-based paragraph pair for a single chapter."
			},
			contents: {
				type: "boolean",
				description: "Set true to list accessible chapters."
			},
			cursor: {
				type: "string",
				description: "Continuation cursor. Use by itself."
			},
			action: {
				type: "string",
				enum: [
					"current",
					"contents",
					"chapter"
				],
				description: "Compatibility for old requests."
			},
			offset: {
				type: "integer",
				description: "Legacy field. Omit it and use the returned cursor."
			}
		},
		output: {
			schema: { type: "json" },
			render(_args, value) {
				if (!value || typeof value !== "object" || Array.isArray(value)) return [];
				const { source: _source,...result } = value;
				return [{
					type: "text",
					text: JSON.stringify(result)
				}];
			},
			presentationMeta(_args, value) {
				return value && typeof value === "object" && !Array.isArray(value) && value.source ? { novelReader: value.source } : null;
			}
		},
		async execute(args, { agent, signal }) {
			const book = agent && bridge.book(agent.session.id);
			const query = queryOf(args);
			if (!query) return {
				status: "invalid_request",
				message: "请选择一个有效范围或单独传续读游标；旧偏移量请改用续读游标。",
				...book ? { source: { book } } : {}
			};
			if (!agent) return { status: "unavailable" };
			const result = await bridge.query(agent.session.id, query, signal);
			return JSON.parse(JSON.stringify(book ? {
				source: { book },
				...result
			} : result));
		}
	}));
}

//#endregion
export { apply, inject, name };