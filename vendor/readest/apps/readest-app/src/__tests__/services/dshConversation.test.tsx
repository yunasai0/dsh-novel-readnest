import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel, type SessionServices } from '@dsh-reader/companion-panel';
import { companionChannel, type ReadingSnapshot } from '@dsh-reader/protocol';
import { personaStorageKey } from '@dsh-reader/persona';

const book = 'conversation-book';
const sessionId = 'conversation-session';
const snapshot: ReadingSnapshot = { title: '测试书', chapter: '第一章', firstParagraph: 1, lastParagraph: 1,
  start: { section: 0, offset: 0 }, end: { section: 0, offset: 10 } };
let readerSnapshot: ReadingSnapshot | undefined;
let prepareStatus: number;
let disconnected: boolean;
let readerSilent: boolean;
let operations: Record<string, unknown>[];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('dsh.novel-reader.companion.' + book, JSON.stringify({
    entries: [{ id: sessionId, token: 'conversation-token' }], selected: sessionId, protectedReading: true,
  }));
  readerSnapshot = snapshot; prepareStatus = 200; disconnected = false; readerSilent = false; operations = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)); operations.push(body);
    if (disconnected) throw new TypeError('Reader bridge unavailable');
    if (body.op === 'poll') return new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (options.signal?.aborted) abort();
      else options.signal?.addEventListener('abort', abort, { once: true });
    });
    if (body.op === 'prepare') return new Response(JSON.stringify({ message: 'Legacy reader error' }), { status: prepareStatus });
    return new Response(JSON.stringify(body.op === 'state' ? { covered: [] } : null));
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openConversation(quote?: string) {
  const send = vi.fn(async (_content: unknown[], _mode: 'queue' | 'steer', _signal?: AbortSignal, _id?: string) => ({ ok: true }));
  const face = { rename: vi.fn(async () => ({ ok: true })), beginSubmission: () => ({ requestId: 'submission-conversation' }),
    prompt: send as (content: unknown[], mode: 'queue' | 'steer', signal?: AbortSignal, id?: string) => Promise<{ ok: boolean }> };
  const reference = { ready: Promise.resolve({ session: face }), release: vi.fn() };
  const catalog = { byId: { [sessionId]: { title: '原会话' } } };
  const workspace = { archivedSessionIds: [], pinnedSessionIds: [] };
  const subscribe = () => () => {};
  const services: SessionServices = {
    sessions: { create: vi.fn(async () => sessionId), retain: () => reference, refresh: vi.fn(), fork: vi.fn(),
      list: { subscribe, getSnapshot: () => catalog } },
    workspaces: { list: { subscribe, getSnapshot: () => workspace }, archiveSession: vi.fn(),
      unarchiveSession: vi.fn(), pinSession: vi.fn(), unpinSession: vi.fn() },
  };
  const view = render(<ReaderPanel services={services}
    SessionProvider={({ children }: { children: ReactNode }) => <>{children}</>}
    renderSlot={() => <div data-testid='native-chat'>原生聊天</div>} />);
  const frame = view.container.querySelector('iframe')!;
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation((message) => {
    if (message.type !== 'book-snapshot' || readerSilent) return;
    window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow,
      data: { channel: companionChannel, type: 'book-snapshot-reply', book, id: message.id, value: readerSnapshot } }));
  });
  act(() => window.dispatchEvent(new MessageEvent('message', { origin: location.origin, source: frame.contentWindow,
    data: { channel: companionChannel, type: quote ? 'open-selection' : 'open', book: { id: book, title: '测试书' },
      ...(quote ? { snapshot: { ...snapshot, selection: { text: quote, start: snapshot.start, end: snapshot.end } } } : {}) },
  })));
  await screen.findByTestId('native-chat');
  async function submit(signal?: AbortSignal) {
    let result: { ok: boolean } | undefined;
    await act(async () => {
      const handle = face.beginSubmission();
      result = await face.prompt([{ type: 'text', text: '继续聊这里的剧情' }], 'queue', signal, handle.requestId);
    });
    return result;
  }
  return { send, submit, reference };
}

describe('conversation remains available without reading admission', () => {
  it('sends normally when the current reading snapshot is missing', async () => {
    readerSnapshot = undefined;
    const { send, submit } = await openConversation();
    expect(await submit()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([400, 412, 503])('does not turn a reading preparation %s response into a chat error', async (status) => {
    prepareStatus = status;
    const { send, submit } = await openConversation();
    expect(await submit()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('按已读范围新建会话')).toBeNull();
  });

  it('does not wait indefinitely for a busy reading bridge', async () => {
    prepareStatus = 409;
    const { send, submit } = await openConversation();
    expect(await submit()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens chat immediately and sends after a bounded wait when the reader never replies', async () => {
    readerSilent = true;
    const { send, submit } = await openConversation();
    expect(screen.getByTestId('native-chat')).toBeTruthy();
    expect(await submit()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
  });

  it('keeps the native chat and quoted text when the reader bridge is disconnected', async () => {
    disconnected = true;
    const { send, submit } = await openConversation('这句原文是用户主动引用的。');
    expect(await submit()).toEqual({ ok: true });
    expect(send.mock.calls[0]?.[0]).toEqual([
      { type: 'text', text: '继续聊这里的剧情' },
      { type: 'text', text: '用户引用的原文：\n这句原文是用户主动引用的。' },
    ]);
    expect(screen.getByTestId('native-chat')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still prepares reading context and uploads a long persona when available', async () => {
    localStorage.setItem(personaStorageKey, JSON.stringify({ activeId: 'custom', builtInPersonasVersion: 1,
      personas: [{ id: 'custom', name: '测试人设', prompt: '甲'.repeat(18000) }] }));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (body.op === 'prepare' && body.persona) return new Response('null', { status: 413 });
      return originalFetch(url, options);
    }));
    const { send, submit } = await openConversation();
    expect(await submit()).toEqual({ ok: true });
    expect(operations.filter(item => item['op'] === 'persona-chunk').map(item => item['chunk']).join('')).toBe('甲'.repeat(18000));
    expect(send.mock.calls[0]?.[0]).toEqual([{ type: 'text', text: '继续聊这里的剧情' }]);
  });

  it('still honors explicit user cancellation', async () => {
    const { send, submit } = await openConversation();
    const controller = new AbortController(); controller.abort();
    await expect(submit(controller.signal)).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('native-chat')).toBeTruthy());
  });
});
