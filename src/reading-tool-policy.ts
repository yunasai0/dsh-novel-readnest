import type { ToolDefinition } from '@deepseek-ai/dsh-tools';

type Schema = Pick<ToolDefinition, 'name' | 'description' | 'parameters'>;
type Lookup = (name: string, scope?: object, step?: unknown) => ToolDefinition | undefined;
const schemaOf = ({ name, description, parameters }: ToolDefinition): Schema => ({ name, description, parameters });

// The supported 0.2.1 runtime owns native presentation. In 0.2.2 the preset
// supplies an executor and DSH owns scheduling, cancellation and result logging.
export interface ReadingToolPolicyContext {
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

export function installReadingToolPolicy(ctx: ReadingToolPolicyContext, owned: ReadonlySet<ToolDefinition>) {
  const isOwned = (tool: ToolDefinition | undefined): tool is ToolDefinition => !!tool && owned.has(tool);
  ctx.tools.guard(({ name, agent }) => isOwned(ctx.tools.get(name, agent))
    ? undefined : '小说陪读只提供当前书籍的阅读工具。');
  if (!ctx.tools.setExecutor) {
    ctx.tools.presentAs!('native');
    ctx.on('system-prompt/assemble', async (_assembly, { scope }, next) => {
      const result = await next();
      const visible = new Set(result.tools.map(({ name }) => ctx.tools.get(name, scope)).filter(isOwned));
      return { ...result, tools: Array.from(visible, schemaOf) };
    });
    return;
  }
  return installNativeExecutor(ctx, isOwned);
}

async function installNativeExecutor(ctx: ReadingToolPolicyContext, isOwned: (tool?: ToolDefinition) => boolean) {
  // This public subpath only exists on the newer runtime. Resolve it from the
  // installed host instead of shipping a second copy of its dispatcher.
  const pipelineModule: string = '@deepseek-ai/dsh-tools/pipeline';
  const { ToolExecutionPipeline, executeToolBatch } = await import(pipelineModule);
  const get: Lookup = (name, scope, step) => {
    const definition = ctx.tools.executable!(name, scope, step);
    return isOwned(definition) ? definition : undefined;
  };
  const pipeline = new ToolExecutionPipeline(ctx, { get });
  ctx.tools.setExecutor!({
    describe(definitions) {
      return { schemas: definitions.filter(isOwned).map(schemaOf) };
    },
    execute: batch => executeToolBatch(batch, pipeline, () => 10),
  });
}
