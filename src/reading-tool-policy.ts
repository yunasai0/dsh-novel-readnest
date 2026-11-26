import type { ToolDefinition } from '@deepseek-ai/dsh-tools';

type Schema = Pick<ToolDefinition, 'name' | 'description' | 'parameters'>;
type Lookup = (name: string, scope?: object, step?: unknown) => ToolDefinition | undefined;
const schemaOf = ({ name, description, parameters }: ToolDefinition): Schema => ({ name, description, parameters });

// The supported 0.2.1 runtime owns native presentation. In 0.2.2 the preset
// supplies an executor and DSH owns scheduling, cancellation and result logging.
export interface ReadingToolPolicyContext {
  systemPrompt?: { tools?(provide: (input: { scope?: object; toolSet?: unknown }) => { schemas: Schema[] }): () => void };
  tools: {
    get: Lookup;
    guard(check: (call: { name: string; agent?: object }) => string | undefined): () => void;
    presentAs?(mode: 'native'): () => void;
    setExecutor?(executor: {
      describe(definitions: ToolDefinition[]): { schemas: Schema[] };
      execute(batch: unknown): Promise<unknown>;
    }): () => void;
    executable?: Lookup;
  };
  on(event: 'system-prompt/assemble', listener: (assembly: { tools: Schema[] }, input: { scope?: object },
    next: () => Promise<{ tools: Schema[] }>) => Promise<{ tools: Schema[] }>): () => void;
}

export function installReadingToolPolicy(ctx: ReadingToolPolicyContext, owned: ReadonlySet<ToolDefinition>,
  selected: (scope?: object) => ToolDefinition | undefined = () => undefined) {
  const admitted = (tool: ToolDefinition | undefined, scope?: object): tool is ToolDefinition =>
    !!tool && (owned.has(tool) || selected(scope) === tool);
  ctx.tools.guard(({ name, agent }) => admitted(ctx.tools.get(name, agent), agent)
    ? undefined : '小说陪读只提供当前书籍的阅读工具。');
  if (!ctx.tools.setExecutor) {
    ctx.tools.presentAs!('native');
    ctx.on('system-prompt/assemble', async (_assembly, { scope }, next) => {
      const result = await next();
      const visible = result.tools.map(({ name }) => ctx.tools.get(name, scope)).filter(def => admitted(def, scope));
      return { ...result, tools: visible.map(schemaOf) };
    });
    return;
  }
  // Modern describe() has no agent argument. Contribute the one optional schema
  // via DSH's scoped provider, using the same step admission as native dispatch.
  ctx.systemPrompt?.tools?.(({ scope, toolSet }) => {
    const tool = selected(scope);
    const visible = tool && ctx.tools.get(tool.name, scope, toolSet) === tool;
    return { schemas: visible ? [schemaOf(tool)] : [] };
  });
  return installNativeExecutor(ctx, owned, admitted);
}

async function installNativeExecutor(ctx: ReadingToolPolicyContext, owned: ReadonlySet<ToolDefinition>, admitted: (tool?: ToolDefinition, scope?: object) => boolean) {
  // This public subpath only exists on the newer runtime. Resolve it from the
  // installed host instead of shipping a second copy of its dispatcher.
  const pipelineModule: string = '@deepseek-ai/dsh-tools/pipeline';
  const { ToolExecutionPipeline, executeToolBatch } = await import(pipelineModule);
  const get: Lookup = (name, scope, step) => {
    const definition = ctx.tools.executable!(name, scope, step);
    return admitted(definition, scope) ? definition : undefined;
  };
  const pipeline = new ToolExecutionPipeline(ctx, { get });
  ctx.tools.setExecutor!({
    describe(definitions) {
      return { schemas: definitions.filter(tool => owned.has(tool)).map(schemaOf) };
    },
    execute: batch => executeToolBatch(batch, pipeline, () => 10),
  });
}
