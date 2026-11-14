import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as novelPlugin from '../lib/agent.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = resolve(process.argv[2] ?? root);
const runtimeRequire = createRequire(resolve(runtime, 'package.json'));
const require = createRequire(runtimeRequire.resolve('@deepseek-ai/dsh-tools'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
const { Context } = await load('@deepseek-ai/cordis');
const Prompt = await load('@deepseek-ai/dsh-system-prompt');
const Tools = await load('@deepseek-ai/dsh-tools');
const { createScope, bindScopeParent, scopeTarget } = await load('@deepseek-ai/dsh-scope');
const expected = ['read_current', 'sync_reading', 'read_chapters', 'read_chapter_ids', 'novel_chapters', 'continue_reading'].sort();
const ctx = new Context();
let foreignCalls = 0, bookCalls = 0;
const scopes = [];
try {
  await ctx.plugin(Prompt.default ?? Prompt.SystemPrompt, { includeHarnessIdentity: false }).await();
  await ctx.plugin(Tools.default, {}).await();
  const modern = typeof ctx.tools.setExecutor === 'function';
  const Native = modern ? await load('@deepseek-ai/dsh-tool-executor-native') : undefined;
  if (Native) await ctx.plugin(Native).await();
  let toolOwner;
  await ctx.inject(['tools', 'systemPrompt'], owner => { toolOwner = owner; }).await();
  ctx.provide('novelReader', {
    book: () => 'test-book', active: () => undefined, persona: () => undefined, admit: () => undefined, finish() {},
    async query() { bookCalls++; return { status: 'ok', chapters: [] }; },
  });
  const registerForeign = name => ctx.tools.register(Tools.defineTool({ name,
    description: 'UNRELATED_PLUGIN_DESCRIPTION_' + name, parameters: {},
    output: { schema: { type: 'json' }, render: () => [{ type: 'text', text: 'foreign result' }] },
    execute() { foreignCalls++; return {}; },
  }));
  registerForeign('foreign_search'); registerForeign('foreign_terminal');
  const presetKey = {};
  const preset = createScope(toolOwner, presetKey); scopes.push(preset);
  if (Native) await preset.ctx.plugin(Native).await(); else preset.ctx.tools.presentAs('native');
  await preset.ctx.plugin(novelPlugin).await();
  const createAgent = async (id, parent, source = 'new') => {
    const agent = { session: { id, seq: 0, eventAt: () => undefined } };
    const scope = createScope(toolOwner, agent); scopes.push(scope); agent.ctx = scope.ctx;
    const binding = parent ? bindScopeParent(agent, parent) : undefined;
    await ctx.serial(scopeTarget(ctx, agent), 'agent/created', { agent, source });
    return { agent, binding };
  };
  const { agent, binding } = await createAgent('novel-session', presetKey);
  const { agent: normal } = await createAgent('ordinary-session');
  const names = scope => ctx.tools.schemas(scope).map(tool => tool.name).sort();
  const verifyCatalog = async subject => {
    assert.deepEqual(names(subject), expected);
    const assembly = await ctx.systemPrompt.assemble({ scope: subject, agent: subject });
    assert.deepEqual(assembly.tools.map(tool => tool.name).sort(), expected);
    assert(!JSON.stringify(assembly).includes('UNRELATED_PLUGIN_DESCRIPTION'));
    assert(!assembly.tools.some(tool => tool.name === 'run_code'));
  };
  await verifyCatalog(agent);
  assert.deepEqual(names(normal), ['foreign_search', 'foreign_terminal']);
  registerForeign('late_plugin_tool');
  await verifyCatalog(agent);
  assert(names(normal).includes('late_plugin_tool'));

  let call = 0;
  const invoke = (subject, name) => modern
    ? ctx.tools.execute({ agent: subject, signal: AbortSignal.timeout(2000),
      calls: [{ type: 'tool-call', id: 'call-' + ++call, name, arguments: '{}' }] })
    : ctx.tools.execute({ agent: subject, signal: AbortSignal.timeout(2000),
      callId: 'call-' + ++call, name, arguments: {} });
  for (const name of ['foreign_search', 'foreign_terminal', 'late_plugin_tool', 'run_code']) {
    assert.equal(ctx.tools.get(name, agent), undefined);
    await invoke(agent, name);
  }
  assert.equal(foreignCalls, 0);
  await invoke(agent, 'read_current'); assert.equal(bookCalls, 1);
  await invoke(normal, 'foreign_search'); assert.equal(foreignCalls, 1);
  const { agent: resumed } = await createAgent('resumed-novel-session', presetKey, 'resume');
  await verifyCatalog(resumed);

  // Changing a blank session to a normal preset must release the novel-only mask.
  binding.rebind({});
  ctx.emit('agent-preset/selected', agent.session.id, 'ordinary');
  assert.deepEqual(names(agent), names(normal));
  await invoke(agent, 'foreign_terminal'); assert.equal(foreignCalls, 2);

  console.log(JSON.stringify({ status: 'passed', runtime, modernExecutor: modern, novelTools: expected,
    externalToolsHidden: true, guessedCallsBlocked: true, lateRegistrationHidden: true,
    resumedSessionIsolated: true, ordinarySessionsUnaffected: true, presetSwitchCleanup: true }));
} finally {
  for (const scope of scopes.reverse()) await scope.dispose();
  await ctx.fiber.dispose();
}
