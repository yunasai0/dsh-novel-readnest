import { a as directoryRecovery, c as spoilerBoundaryOf, f as isChapterId, i as snapshotLabel, n as historyConflict, o as novelError, s as compareBookPoints, u as assembleNovelPrompt } from "./book-bridge-B-qkm0v8.mjs";
import { ToolArgsError, defineTool } from "@deepseek-ai/dsh-tools";

//#region src/agent.ts
const name = "novel-reader-agent";
const inject = [
	"novelReader",
	"tools",
	"systemPrompt"
];
const positive = (value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const keysOnly = (args, keys) => Object.keys(args).every((key) => keys.includes(key));
function modelResult(result) {
	const { stopReason, nextCursor, chapters, candidates, source,...rest } = result;
	return JSON.parse(JSON.stringify({
		...rest,
		status: result.error ? "error" : result.status,
		...chapters ? { chapters: chapters.map(({ range: _range,...chapter }) => chapter) } : {},
		...candidates ? { candidates: candidates.map((chapter) => ({
			...chapter,
			read_call: {
				tool: "read_chapter_ids",
				arguments: { chapter_ids: [chapter.chapter_id] }
			}
		})) } : {},
		...stopReason ? { stop_reason: stopReason } : {},
		...nextCursor ? { next_cursor: nextCursor } : {},
		...source ? { source } : {}
	}));
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
			const { title, chapter, chapter_id, endChapter, end_chapter_id, chapterSource, firstParagraph, lastParagraph, selection, start } = active.snapshot;
			const heading = chapterSource ?? {
				section: start.section,
				offset: 0
			};
			const point = selection && compareBookPoints(selection.end, heading) > 0 ? selection.end : heading;
			return snapshotLabel + JSON.stringify({
				book,
				owner: session,
				indexVersion: active.snapshot.indexVersion ?? 0,
				point,
				title,
				chapter,
				chapter_id,
				endChapter,
				end_chapter_id,
				firstParagraph,
				lastParagraph,
				reading: active.snapshot.reading ?? {
					start: active.snapshot.start,
					end: active.snapshot.end,
					chapter,
					chapter_id,
					firstParagraph,
					lastParagraph
				},
				sync: bridge.syncInfo(session),
				spoilerProtection: active.protectedReading,
				spoilerBoundary: spoilerBoundaryOf(active.snapshot),
				...selection ? { selection: selection.text } : {}
			});
		}
	});
	const output = {
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
			const result = value;
			return result?.source ? { novelReader: result.source } : null;
		}
	};
	const register = (name$1, description, parameters, parse, guidance) => {
		const failure = (args, fields) => {
			const values = args && typeof args === "object" && !Array.isArray(args) ? args : void 0;
			const cursor = typeof values?.["cursor"] === "string" ? values["cursor"] : void 0;
			const unexpected = values ? Object.keys(values).filter((key) => !(key in parameters)) : [];
			let reason = !values ? "参数必须是对象。" : unexpected.length ? "不接受这些参数：" + unexpected.join("、") + "。" : fields?.length ? fields.join("；") : "参数值不符合工具要求。";
			if (values && !unexpected.length) {
				if (name$1 === "read_chapters" && positive(values["start"]) && positive(values["end"]) && values["end"] < values["start"]) reason = "结束章号 end=" + values["end"] + " 小于起始章号 start=" + values["start"] + "。";
				else if (name$1 === "read_chapters" && !positive(values["start"])) reason = "start 必须是原书正整数章号，不能省略或传目录 ID。";
				else if (name$1 === "read_chapter_ids" && Array.isArray(values["chapter_ids"])) {
					const invalid = values["chapter_ids"].findIndex((id) => !isChapterId(id));
					reason = values["chapter_ids"].length ? "chapter_ids[" + invalid + "] 不是有效的章节 ID。" : "chapter_ids 不能为空列表。";
				} else if (name$1 === "novel_chapters" && Array.isArray(values["chapter_numbers"])) reason = "chapter_numbers 必须是非空的原书正整数章号列表；不能包含 0、负数或字符串。";
				else if (name$1 === "continue_reading") reason = "cursor 必须是非空字符串，且必须原样复制工具返回值。";
			}
			return modelResult(novelError("INVALID_ARGUMENTS", name$1 + "：" + reason, guidance, {
				fields,
				next_call: cursor && values && Object.keys(values).length === 1 && name$1 !== "continue_reading" ? {
					tool: "continue_reading",
					arguments: { cursor }
				} : name$1 === "read_current" || name$1 === "sync_reading" ? {
					tool: name$1,
					arguments: {}
				} : directoryRecovery
			}));
		};
		const tool = defineTool({
			name: name$1,
			description,
			parameters,
			output,
			async execute(args, { agent, signal, callId }) {
				const query = parse(args);
				if (!query) return failure(args, Object.keys(args));
				if (!agent) return modelResult(novelError("SESSION_UNAVAILABLE", "本工具没有绑定小说会话。", "请从当前书籍的 AI 面板创建或打开会话。"));
				return modelResult(await bridge.query(agent.session.id, query, signal, callId));
			}
		});
		const execute = tool.execute;
		ctx.tools.register({
			...tool,
			async execute(args, exec) {
				try {
					return await execute(args, exec);
				} catch (error) {
					if (error instanceof ToolArgsError) return failure(args, error.violations);
					if (exec.signal.aborted) return modelResult(novelError("READ_CANCELED", "本次读取已取消，没有确认同步成功。", "需要继续时重新发起读取。"));
					const reference = crypto.randomUUID();
					console.error("[novel-tools]", reference, error);
					return modelResult(novelError("INTERNAL_TOOL_ERROR", "工具执行遇到内部异常，错误编号：" + reference, "请重新打开本书后重试；如仍失败，请提供错误编号。不要通过猜测参数重试。"));
				}
			}
		});
	};
	register("read_current", "读取当前讨论片段：有选区时围绕选区，否则读取当前可见正文，补前约3段、后约2段。无需传位置；遵守已读边界和本轮共享30000字额度。", {}, (args) => keysOnly(args, []) ? {
		kind: "near",
		before: 3,
		after: 2
	} : void 0, "read_current 不接受参数，直接调用 read_current({})。需要续读时，把本次结果的 next_cursor 原样传给 continue_reading 的 cursor，并遵循 next_call.when。");
	register("sync_reading", "需要跟进用户新读内容时，获取本会话尚未同步的阅读正文。不接受参数，调用 sync_reading({})。起点、实际浏览区间和本轮目标由插件确定；跳读不等于读完中间章节。首次只取当前片段。讨论回翻位置时使用 read_current。", {}, (args) => keysOnly(args, []) ? { kind: "sync" } : void 0, "sync_reading 不接受位置或章号参数，直接调用 sync_reading({})。只在需要跟进新读内容时调用。");
	register("read_chapters", "按原书章号读取单章或连续章节，不使用目录序号或文件序号。多个卷重号时传 volume；不确定时查询 novel_chapters。最多使用本轮剩余正文额度。", {
		start: {
			type: "integer",
			required: true,
			description: "原书起始章号，正整数。"
		},
		end: {
			type: "integer",
			description: "可选结束章号，包含此章，必须大于等于 start；省略时只读 start。"
		},
		volume: {
			type: "string",
			description: "可选原书卷名，例如“第二卷”；重号时必须明确卷。"
		}
	}, (args) => keysOnly(args, [
		"start",
		"end",
		"volume"
	]) && positive(args["start"]) && (args["end"] === void 0 || positive(args["end"]) && args["end"] >= args["start"]) && (args["volume"] === void 0 || typeof args["volume"] === "string" && !!args["volume"].trim()) ? {
		kind: "numbers",
		start: args["start"],
		end: args["end"] ?? args["start"],
		...args["volume"] ? { volume: args["volume"].trim() } : {}
	} : void 0, "start 必须是原书正整数章号；end 可省略且不能小于 start；volume 是卷名字符串。数字不会被解释成目录或文件序号。");
	register("read_chapter_ids", "按明确章节ID读取，支持不连续章节。ID只复制阅读快照或目录结果；按原文顺序返回所选章节，不读取它们之间未选择的章节。", { chapter_ids: {
		type: "array",
		items: { type: "string" },
		required: true,
		description: "一个或多个真实 chapter_id；不要传数字章号。"
	} }, (args) => keysOnly(args, ["chapter_ids"]) && Array.isArray(args["chapter_ids"]) && args["chapter_ids"].length > 0 && args["chapter_ids"].every(isChapterId) ? {
		kind: "ids",
		chapter_ids: [...new Set(args["chapter_ids"])]
	} : void 0, "chapter_ids 必须是非空 ID 字符串列表。先用 novel_chapters 定位，再复制返回的 chapter_id。");
	register("novel_chapters", "查询本书可读目录，按标题、原书章号列表或卷名筛选；各筛选条件可以同时使用。不传参数时查询可读目录。返回唯一ID及可识别的原书章号，不返回正文，不消耗正文额度。结果按批返回；如有 next_cursor，用 continue_reading 获取下一批，不要把首批当成完整目录。", {
		query: {
			type: "string",
			description: "可选标题关键词。"
		},
		chapter_numbers: {
			type: "array",
			items: { type: "integer" },
			description: "可选原书章号列表，例如 [12,15,18]。"
		},
		volume: {
			type: "string",
			description: "可选原书卷名。"
		}
	}, (args) => keysOnly(args, [
		"query",
		"chapter_numbers",
		"volume"
	]) && (args["query"] === void 0 || typeof args["query"] === "string") && (args["volume"] === void 0 || typeof args["volume"] === "string") && (args["chapter_numbers"] === void 0 || Array.isArray(args["chapter_numbers"]) && args["chapter_numbers"].length > 0 && args["chapter_numbers"].every(positive)) ? {
		kind: "contents",
		...args["query"] ? { query: args["query"].trim() } : {},
		...args["volume"] ? { volume: args["volume"].trim() } : {},
		...args["chapter_numbers"] ? { chapter_numbers: args["chapter_numbers"] } : {}
	} : void 0, "query 和 volume 使用字符串；chapter_numbers 使用原书正整数章号列表。目录续页使用 continue_reading，不能在这里传 cursor。");
	register("continue_reading", "继续尚未完成的正文读取或目录翻页，起点、结束位置、筛选条件和权限由原任务固定。把上一批结果的 next_cursor 原样传入 cursor，不传章号、不自行生成游标。next_call.when 为 now 时可本轮继续，为 next_turn 时必须等下一轮，不能绕过共享正文额度。", { cursor: {
		type: "string",
		required: true,
		description: "上次结果中的 next_cursor，原样复制。"
	} }, (args) => keysOnly(args, ["cursor"]) && typeof args["cursor"] === "string" && !!args["cursor"].trim() && args["cursor"].length <= 160 ? { cursor: args["cursor"] } : void 0, "只传一个非空 cursor 字符串，原样复制上次返回值。没有游标时重新调用原来的读取工具，不要自行拼接。");
}

//#endregion
export { apply, inject, name };