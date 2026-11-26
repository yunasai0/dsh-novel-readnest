import { createHash } from 'node:crypto';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { companionPreset } from './protocol.js';
import { isSkillChoice, type SkillCatalog } from './skill-choice.js';
import { imageScripts, type ScriptEntry } from './skill-image-runner.js';

interface Summary {
  name: string; provider: string; source: string; description: string; path?: string;
  resourceBase?: { kind: string; path?: string; url?: string; description?: string };
  invocation?: { userInvocable: boolean };
}
interface Registry {
  list(options: { scope: object; signal: AbortSignal; cwd?: string }): Promise<Summary[]>;
  get(name: string, options: { scope: object; signal: AbortSignal; cwd?: string }): Promise<(Summary & { content: string }) | undefined>;
}
export interface SkillHost {
  skills?: Registry;
  agentPresets?: { acquireScope(id: string): Promise<{ key: object; [Symbol.asyncDispose](): Promise<void> }> };
  workingDirectory?: { get(session: object): string };
  tools?: { schemas(): { name: string }[]; get(name: string): ToolDefinition | undefined };
}
export interface BoundSkill { name: string; content: string; tool?: ToolDefinition; script?: ScriptEntry }
const keyOf = (s: Summary) => createHash('sha256').update(JSON.stringify([
  s.name, s.provider, s.source, s.path ?? null, s.resourceBase ?? null,
])).digest('hex');

// This filter limits the *human* picker. It is not execution authority: the user
// must pick a concrete registration, whose object identity is checked again at dispatch.
function drawingTool(tool: ToolDefinition | undefined) {
  if (!tool) return false;
  const name = tool.name.toLowerCase();
  if (/(?:^|[_.-])(?:bash|shell|pwsh|exec|eval|terminal|script|agent|subagent|workflow|code|plugin|file)(?:$|[_.-])/.test(name)) return false;
  const semanticName = /(?:image|picture|illustrat|artwork|photo|canvas|imagine)/.test(name) &&
    /(?:generat|imagegen|render|creat|draw|paint|imagine|(?:^|[_.-])gen(?:$|[_.-]))/.test(name);
  return semanticName || /(?:^|[_.-])(?:draw|paint|illustrate|txt2img|text2image|t2i)(?:$|[_.-])/.test(name)
    || (Object.hasOwn(tool.parameters, 'prompt') &&
      /生成.{0,5}(?:图片|图像|插画)|文生图|(?:generate|create)s? (?:an? |new )?(?:image|picture|illustration)/i.test(tool.description));
}
export function installedSkills(ctx: SkillHost) {
  const seen = new Map<string, { def: ToolDefinition; id: string; revision: number }>();
  function imageTools() {
    return (ctx.tools?.schemas() ?? []).flatMap(({ name }) => {
      const def = ctx.tools?.get(name);
      if (!def || !drawingTool(def)) return [];
      const old = seen.get(name);
      if (old?.def === def) return [{ name, id: old.id, def }];
      const revision = old ? old.revision + 1 : 0;
      const id = 'tool-' + createHash('sha256').update(JSON.stringify([name, def.description, def.parameters, revision])).digest('hex');
      seen.set(name, { def, id, revision });
      return [{ name, id, def }];
    });
  }
  async function withScope<T>(session: object | undefined, fn: (registry: Registry, options: { scope: object; signal: AbortSignal; cwd?: string }) => Promise<T>) {
    if (!ctx.skills || !ctx.agentPresets?.acquireScope) throw new Error('当前 DSH 未提供预设技能目录。');
    const lease = await ctx.agentPresets.acquireScope(companionPreset);
    try {
      const cwd = session && ctx.workingDirectory?.get(session);
      return await fn(ctx.skills, { scope: lease.key, signal: AbortSignal.timeout(5000), ...(cwd ? { cwd } : {}) });
    } finally { await lease[Symbol.asyncDispose](); }
  }
  return {
    async catalog(session?: object): Promise<SkillCatalog> {
      return withScope(session, async (registry, options) => ({
        skills: (await registry.list(options)).filter(s => s.invocation?.userInvocable !== false)
          .map(s => ({ name: s.name, key: keyOf(s), description: s.description })),
        tools: imageTools().map(({ name, id }) => ({ name, id })).sort((a, b) => a.name.localeCompare(b.name)),
      }));
    },
    async resolve(choice: unknown, session?: object): Promise<BoundSkill> {
      if (!isSkillChoice(choice)) throw new Error('技能选择无效，请重新选择。');
      return withScope(session, async (registry, options) => {
        const s = await registry.get(choice.name, options);
        if (!s || s.invocation?.userInvocable === false || keyOf(s) !== choice.key)
          throw new Error('所选技能已卸载、来源已变化或不适用于此工作区，请重新选择。');
        if (!s.content.trim() || s.content.length > 64_000) throw new Error('技能说明为空或超过 64000 字符，未启用。');
        if (choice.tool.startsWith('script-')) {
          const script = (await imageScripts(s)).find(row => row.id === choice.tool);
          if (!script) throw new Error('技能脚本已删除、已更新或不支持文生图参数，请重新绑定。');
          return { name: s.name, content: s.content, script };
        }
        const tool = choice.tool ? imageTools().find(t => t.id === choice.tool)?.def : undefined;
        if (choice.tool && !tool) throw new Error('所选生图工具已变化或不可用，请重新绑定。');
        return { name: s.name, content: s.content, tool };
      });
    },
    async scripts(choice: unknown, session?: object) {
      if (!isSkillChoice(choice)) return [];
      return withScope(session, async (registry, options) => {
        const s = await registry.get(choice.name, options);
        if (!s || keyOf(s) !== choice.key || s.invocation?.userInvocable === false) return [];
        return (await imageScripts(s)).map(({ id, label }) => ({ id, label }));
      });
    },
  };
}
