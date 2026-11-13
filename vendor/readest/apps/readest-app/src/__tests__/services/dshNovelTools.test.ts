// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apply } from '@dsh-reader/agent';
import type { BookBridge } from '@dsh-reader/book-bridge';
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';

const first = 'ch_0123456789abcdef';
const last = 'ch_fedcba9876543210';
const tools = new Map<string, ToolDefinition>();
const query = vi.fn();
const exec = { agent: { session: { id: 'session-test' } }, signal: new AbortController().signal } as ToolRunContext;
beforeEach(() => {
  tools.clear(); query.mockReset().mockResolvedValue({ status: 'ok', chapters: [] });
  const noop = () => () => {};
  apply({ novelReader: { query, book: () => 'book-test' } as unknown as BookBridge,
    tools: { register(tool) { tools.set(tool.name, tool); return () => {}; } },
    systemPrompt: { section: noop, context: noop, suppressRuntimeContext: noop }, on: noop,
  });
});

describe('single-purpose novel tools', () => {
  it('never rejects a conversation because history is ahead or the reading snapshot is unavailable', async () => {
    const handlers = new Map<string, Function>();
    const admit = vi.fn();
    const finish = vi.fn();
    let runtimeContext: ((input: unknown) => string) | undefined;
    const noop = () => () => {};
    apply({ novelReader: { admit, finish, active: () => undefined, book: () => 'book-test' } as unknown as BookBridge,
      tools: { register: noop },
      systemPrompt: { section: noop, suppressRuntimeContext: noop, context(spec) { runtimeContext = spec.text as typeof runtimeContext; return noop(); } },
      on(event, handler) { handlers.set(event, handler); return noop(); },
    });
    const session = { id: 'session-test', seq: 1, eventAt: () => ({ type: 'tool/result', data: {
      meta: { novelReader: { book: 'book-test', point: { section: 9, offset: 500 } } },
    } }) };
    const decision = { kind: 'enter', messages: [{ source: { kind: 'user', rpcId: 'new-message' } }] };
    admit.mockReturnValue({ protectedReading: true, snapshot: { end: { section: 0, offset: 10 } } });
    expect(await handlers.get('agent/pre-step')!({ agent: { session }, turn: 2 }, async () => decision)).toBe(decision);
    admit.mockReturnValue(undefined);
    expect(await handlers.get('agent/pre-step')!({ agent: { session }, turn: 3 }, async () => decision)).toBe(decision);
    expect(finish).toHaveBeenCalledWith(session.id);
    expect(runtimeContext!({ agent: { session } })).toContain('可以正常继续交流');
    const rejected = { kind: 'reject' };
    expect(await handlers.get('agent/pre-step')!({ agent: { session }, turn: 3 }, async () => rejected)).toBe(rejected);
  });

  it('exposes exactly six tools and keeps current/sync reading parameterless', async () => {
    expect([...tools.keys()]).toEqual(['read_current', 'sync_reading', 'read_chapters', 'read_chapter_ids', 'novel_chapters', 'continue_reading']);
    await tools.get('read_current')!.execute({}, exec);
    expect(query.mock.calls[0]?.[1]).toEqual({ kind: 'near', before: 3, after: 2 });
    await tools.get('sync_reading')!.execute({}, exec);
    expect(query.mock.calls[1]?.[1]).toEqual({ kind: 'sync' });
  });

  it('keeps original chapter numbers separate from IDs', async () => {
    await tools.get('read_chapters')!.execute({ start: 12, end: 14, volume: '第二卷' }, exec);
    expect(query.mock.calls[0]?.[1]).toEqual({ kind: 'numbers', start: 12, end: 14, volume: '第二卷' });
    await tools.get('read_chapters')!.execute({ start: 12 }, exec);
    expect(query.mock.calls[1]?.[1]).toEqual({ kind: 'numbers', start: 12, end: 12 });
    await tools.get('read_chapter_ids')!.execute({ chapter_ids: [last, first] }, exec);
    expect(query.mock.calls[2]?.[1]).toEqual({ kind: 'ids', chapter_ids: [last, first] });
  });

  it('returns structured explanations for schema and semantic errors without dispatching a read', async () => {
    for (const [name, args] of [
      ['read_current', { chapter: 12 }], ['sync_reading', { start: 12 }],
      ['read_chapters', {}], ['read_chapters', { start: '12' }], ['read_chapters', { start: 12, end: 3 }],
      ['read_chapter_ids', { chapter_ids: [12] }], ['read_chapter_ids', { chapter_ids: [] }],
      ['novel_chapters', { chapter_numbers: [0] }], ['continue_reading', { cursor: '' }],
    ] as [string, unknown][]) {
      expect(await tools.get(name)!.execute(args, exec)).toMatchObject({
        status: 'error', error: { code: 'INVALID_ARGUMENTS', retryable: false }, next_call: expect.any(Object),
      });
    }
    expect(query).not.toHaveBeenCalled();
  });

  it('directs misplaced cursors to the one continuation tool', async () => {
    expect(await tools.get('read_current')!.execute({ cursor: 'read-opaque' }, exec)).toMatchObject({
      status: 'error', next_call: { tool: 'continue_reading', arguments: { cursor: 'read-opaque' } },
    });
    expect(await tools.get('read_chapters')!.execute({ start: 12, cursor: 'read-opaque' }, exec)).toMatchObject({
      status: 'error', next_call: { tool: 'novel_chapters' },
    });
    const reversed = await tools.get('read_chapters')!.execute({ start: 12, end: 3 }, exec) as { error: { message: string } };
    expect(reversed.error.message).toContain('end=3 小于起始章号 start=12');
    await tools.get('continue_reading')!.execute({ cursor: 'read-opaque' }, exec);
    expect(query.mock.calls[0]?.[1]).toEqual({ cursor: 'read-opaque' });
  });

  it('combines directory filters without reinterpreting numeric chapter queries', async () => {
    await tools.get('novel_chapters')!.execute({ chapter_numbers: [12, 15, 18], volume: '第二卷' }, exec);
    expect(query.mock.calls[0]?.[1]).toEqual({ kind: 'contents', chapter_numbers: [12, 15, 18], volume: '第二卷' });
  });

  it('keeps readable positions and notices while hiding physical range coordinates from rendered results', async () => {
    query.mockResolvedValue({ status: 'partial', stopReason: 'round_budget', nextCursor: 'sync-opaque',
      next_call: { tool: 'continue_reading', arguments: { cursor: 'sync-opaque' }, when: 'next_turn' },
      chapters: [{ chapter_id: first, title: '第一章', kind: 'chapter', text: '原文', coverage: 'partial', end_notice: '额度不足',
        location: { start: { paragraph: 1, character: 1 }, end: { paragraph: 1, character: 3 } },
        range: { start: { section: 0, offset: 0 }, end: { section: 0, offset: 2 } } }],
      source: { book: 'book-test', point: { section: 0, offset: 2 } },
    });
    const tool = tools.get('sync_reading')!;
    const result = await tool.execute({}, exec);
    const rendered = tool.output.render({}, result as Parameters<typeof tool.output.render>[1]);
    const body = JSON.parse((rendered[0] as { text: string }).text);
    expect(body.chapters[0].range).toBeUndefined();
    expect(body.chapters[0].end_notice).toBe('额度不足');
    expect(body.stop_reason).toBe('round_budget');
    expect(body.next_call.when).toBe('next_turn');
    expect(body.source).toBeUndefined();
    expect(tool.output.presentationMeta!({}, result as Parameters<typeof tool.output.render>[1])).toEqual({
      novelReader: { book: 'book-test', point: { section: 0, offset: 2 } },
    });
  });
});
