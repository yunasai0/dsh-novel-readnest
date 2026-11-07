import {
  useEffect, useRef, useState, useSyncExternalStore,
  type CSSProperties, type ComponentType, type PointerEvent, type ReactNode, type RefObject,
} from 'react';
import { readerPath } from './path.js';
import {
  companionChannel, companionEndpoint, companionPreset,
  type BookRequest, type ReaderBook, type ReaderResult, type ReadingSnapshot,
} from './protocol.js';
import { companionStyle } from './companion-style.js';
import {
  defaultPersonaId, personaStorageKey, readNovelPersonaSettings,
  selectedNovelPersona, writeNovelPersonaSettings,
} from './persona.js';

export const conversationSlot = 'novel-reader.conversation';

interface SessionFace {
  rename(title: string): Promise<{ ok: boolean }>;
  beginSubmission(input: unknown): { requestId: string };
  prompt(content: unknown[], mode: 'queue' | 'steer', signal?: AbortSignal, requestId?: string): Promise<{ ok: boolean }>;
}
interface SessionReference {
  release(): void;
  ready: Promise<{ session: SessionFace }>;
}
type Source<T> = { getSnapshot(): T; subscribe(listener: () => void): () => void };

export interface SessionServices {
  sessions: {
    create(options: { agentPreset: string }): Promise<string>;
    retain(id: string, options: { source: string }): SessionReference;
    refresh(): Promise<void>;
    fork(options: { sessionId: string; increaseTitle: boolean }): Promise<string>;
    list: Source<{ byId: Record<string, { title?: string; displayTitle?: string }> }>;
  };
  workspaces: {
    list: Source<{ archivedSessionIds: string[]; pinnedSessionIds: string[] }>;
    archiveSession(id: string): Promise<void>;
    unarchiveSession(id: string): Promise<void>;
    pinSession(id: string): Promise<void>;
    unpinSession(id: string): Promise<void>;
  };
}

type View = 'chat' | 'trajectory';
type RenderSlot = (name: string, props: Record<string, unknown>) => ReactNode;
export interface PanelSlots {
  SessionProvider: ComponentType<{ session: SessionReference; children: ReactNode }>;
  renderSlot: RenderSlot;
}
interface ConversationProps {
  view: View;
  renderFactorySlot(
    name: string,
    props: { variant: 'embedded'; phase: 'active'; hero: false },
    options: { slots: { views: ComponentType<{ renderSlot: RenderSlot }> } },
  ): ReactNode;
}

function ChatView({ renderSlot }: { renderSlot: RenderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

function TrajectoryView({ renderSlot }: { renderSlot: RenderSlot }) {
  return renderSlot('conversation.session', { view: 'trajectory' });
}

export function NovelConversation({ view, renderFactorySlot }: ConversationProps) {
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, {
    slots: { views: view === 'chat' ? ChatView : TrajectoryView },
  });
}

type Entry = { id: string; token: string };
type BookState = { entries: Entry[]; selected?: string; protectedReading: boolean };
const storageKey = (id: string) => 'dsh.novel-reader.companion.' + id;
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,160}$/.test(id);

function readState(book: string): BookState {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(book)) ?? 'null');
    if (data && Array.isArray(data.entries)) {
      return {
        entries: data.entries.filter((entry: Entry) => entry && validId(entry.id) && validId(entry.token)),
        selected: data.selected,
        protectedReading: data.protectedReading !== false,
      };
    }
  } catch {
    // The first open or damaged local metadata starts with an empty book list.
  }
  return { entries: [], protectedReading: true };
}

function askReader<T>(
  frame: RefObject<HTMLIFrameElement | null>,
  book: string,
  type: 'book-query' | 'book-snapshot',
  request: { id: string },
  signal: AbortSignal,
) {
  const reader = frame.current?.contentWindow;
  if (!reader) return Promise.resolve(undefined);
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(9000)]);
  return new Promise<T | undefined>((resolve) => {
    const abort = () => finish(undefined);
    const finish = (value: T | undefined) => {
      window.removeEventListener('message', receive);
      deadline.removeEventListener('abort', abort);
      resolve(value);
    };
    const receive = (event: MessageEvent) => {
      const reply = event.data;
      if (
        event.source === reader && event.origin === location.origin &&
        reply?.channel === companionChannel && reply.type === (type === 'book-query' ? 'book-reply' : 'book-snapshot-reply') &&
        reply.book === book && reply.id === request.id
      ) finish(reply.value as T | undefined);
    };
    if (deadline.aborted) return abort();
    window.addEventListener('message', receive);
    deadline.addEventListener('abort', abort, { once: true });
    reader.postMessage({
      channel: companionChannel, type, book, ...request,
    }, location.origin);
  });
}

function NativeSession({
  entry, book, frame, services, slots, view, protectedReading, newSession, quoteSnapshot, clearQuote,
}: {
  entry: Entry;
  book: string;
  frame: RefObject<HTMLIFrameElement | null>;
  services: SessionServices;
  slots: PanelSlots;
  view: View;
  protectedReading: boolean;
  newSession(): void;
  quoteSnapshot?: ReadingSnapshot;
  clearQuote(snapshot: ReadingSnapshot): void;
}) {
  const protection = useRef(protectedReading);
  protection.current = protectedReading;
  const [reference, setReference] = useState<SessionReference>();
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState<{ message: string; history?: boolean }>();
  const syncProtection = useRef<() => Promise<unknown> | undefined>(undefined);
  const pendingQuote = useRef(quoteSnapshot);
  const visibleQuote = useRef(quoteSnapshot);
  const consumeQuote = useRef(clearQuote);
  visibleQuote.current = quoteSnapshot;
  consumeQuote.current = clearQuote;

  useEffect(() => {
    pendingQuote.current = quoteSnapshot;
  }, [quoteSnapshot]);

  useEffect(() => {
    void syncProtection.current?.()?.catch(() => {});
  }, [protectedReading]);

  useEffect(() => {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const instance = crypto.randomUUID();
    let owned: SessionReference | undefined;
    let restore: (() => void) | undefined;
    const post = async (op: string, fields: Record<string, unknown> = {}, abort = signal) => {
      const response = await fetch(companionEndpoint, {
        method: 'POST', signal: abort, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op, book, session: entry.id, token: entry.token, instance, ...fields }),
      });
      if (op === 'reply' && response.status === 404) return null;
      if (op === 'prepare' && !response.ok) {
        const value = await response.json() as { message?: string };
        return { rejected: response.status, message: value?.message };
      }
      if (!response.ok) throw new Error('阅读器桥接请求失败（' + response.status + '）');
      return response.json();
    };
    const updateProtection = () => post('protection', { protectedReading: protection.current });
    const capture = () => {
      const quote = pendingQuote.current;
      pendingQuote.current = undefined;
      return {
        protectedReading: protection.current,
        persona: selectedNovelPersona(readNovelPersonaSettings())?.prompt,
        quote,
        snapshot: quote ? Promise.resolve(quote) : askReader<ReadingSnapshot>(
          frame, book, 'book-snapshot', { id: crypto.randomUUID() }, signal,
        ),
      };
    };
    const wrap = (session: SessionFace) => {
      const originalBegin = session.beginSubmission;
      const originalPrompt = session.prompt;
      const captures = new Map<string, ReturnType<typeof capture>>();
      let last: ReturnType<typeof capture> | undefined;
      const begin: SessionFace['beginSubmission'] = function (this: SessionFace, input) {
        const handle = originalBegin.call(this, input);
        captures.set(handle.requestId, capture());
        if (captures.size > 12) captures.delete(captures.keys().next().value!);
        return handle;
      };
      const prompt: SessionFace['prompt'] = async function (this: SessionFace, content, mode, caller, requestId) {
        const abort = caller ? AbortSignal.any([signal, caller]) : signal;
        const id = requestId ?? crypto.randomUUID();
        const captured = content.length ? captures.get(id) ?? capture() : last;
        captures.delete(id);
        let prepared = false;
        let accepted = false;
        try {
          const snapshot = await captured?.snapshot;
          if (!snapshot || !captured) {
            setSendError({ message: '暂时无法锁定正文位置，请回到小说当前页后重试。' });
            throw new Error('阅读位置不可用');
          }
          setSendError(undefined);
          await updateProtection();
          for (;;) {
            abort.throwIfAborted();
            const result = await post('prepare', {
              id, snapshot, protectedReading: captured.protectedReading, persona: captured.persona,
            }, abort);
            if (!result?.rejected) {
              prepared = true;
              break;
            }
            if (result.rejected !== 409) {
              setSendError({ message: result.message ?? '无法准备阅读上下文。', history: result.rejected === 412 });
              throw new Error(result.message ?? '无法准备阅读上下文');
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
          const result = await originalPrompt.call(this, content, mode, abort, id);
          accepted = result.ok;
          if (accepted) {
            last = captured;
            if (captured.quote) consumeQuote.current(captured.quote);
          }
          return result;
        } finally {
          if (!accepted && prepared) void post('withdraw', { id }).catch(() => {});
          if (!accepted && captured?.quote && visibleQuote.current === captured.quote && !pendingQuote.current) {
            pendingQuote.current = captured.quote;
          }
        }
      };
      session.beginSubmission = begin;
      session.prompt = prompt;
      return () => {
        if (session.beginSubmission === begin) session.beginSubmission = originalBegin;
        if (session.prompt === prompt) session.prompt = originalPrompt;
      };
    };
    const run = async () => {
      await post('hello', { protectedReading: protection.current });
      syncProtection.current = updateProtection;
      if (signal.aborted) return;
      try {
        owned = services.sessions.retain(entry.id, { source: 'novelCompanion' });
      } catch {
        await services.sessions.refresh();
        if (signal.aborted) return;
        owned = services.sessions.retain(entry.id, { source: 'novelCompanion' });
      }
      const { session } = await owned.ready;
      if (signal.aborted) return;
      restore = wrap(session);
      setReference(owned);
      while (!signal.aborted) {
        const request: BookRequest | null = await post('poll');
        if (!request || signal.aborted) continue;
        const value = await askReader<ReaderResult>(frame, book, 'book-query', request, signal)
          ?? { status: 'unavailable', message: '阅读器没有返回正文。' };
        if (!signal.aborted) await post('reply', { id: request.id, value });
      }
    };
    void run().catch((reason: unknown) => {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : 'AI 连接失败。');
    });
    return () => {
      lifetime.abort();
      if (syncProtection.current === updateProtection) syncProtection.current = undefined;
      restore?.();
      void post('close', {}, AbortSignal.timeout(2500)).catch(() => {});
      owned?.release();
    };
  }, [book, entry.id, entry.token, frame, services]);

  if (error) return <p className="nr-message" role="alert">{error}</p>;
  if (!reference) return <p className="nr-message">正在打开 AI 会话…</p>;
  return (
    <slots.SessionProvider session={reference}>
      {sendError && <p className="nr-message" role="alert">
        {sendError.message}{sendError.history && <button type="button" onClick={newSession}>按当前位置新建会话</button>}
      </p>}
      {slots.renderSlot(conversationSlot, { view })}
    </slots.SessionProvider>
  );
}

function SessionRailIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      {open ? <path d="M5 5h4v14H5z" fill="currentColor" stroke="none" /> : <path d="M9 4v16" />}
    </svg>
  );
}

function BookPanel({
  book, frame, services, slots, narrow, close, clearQuote,
}: {
  book: ReaderBook & { quoteSnapshot?: ReadingSnapshot };
  frame: RefObject<HTMLIFrameElement | null>;
  services: SessionServices;
  slots: PanelSlots;
  narrow: boolean;
  close(): void;
  clearQuote(snapshot: ReadingSnapshot): void;
}) {
  const [state, setState] = useState(() => readState(book.id));
  const [personaSettings, setPersonaSettings] = useState(readNovelPersonaSettings);
  const [view, setView] = useState<View>('chat');
  const [rail, setRail] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [settings, setSettings] = useState(false);
  const [renaming, setRenaming] = useState<Entry>();
  const [draftTitle, setDraftTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{
    pointerId: number; startY: number; lastY: number; lastAt: number; velocity: number;
  } | undefined>(undefined);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const railToggle = useRef<HTMLButtonElement>(null);
  const railClose = useRef<HTMLButtonElement>(null);
  const chatArea = useRef<HTMLElement>(null);
  const handledQuote = useRef<ReadingSnapshot>(undefined);
  const catalog = useSyncExternalStore(
    (listener) => services.sessions.list.subscribe(listener),
    () => services.sessions.list.getSnapshot(),
  );
  const workspace = useSyncExternalStore(
    (listener) => services.workspaces.list.subscribe(listener),
    () => services.workspaces.list.getSnapshot(),
  );
  const archived = new Set(workspace.archivedSessionIds);
  const pinned = new Set(workspace.pinnedSessionIds);
  const current = state.entries.find(({ id }) => id === state.selected && !archived.has(id));
  const rows = state.entries.filter(({ id }) => archived.has(id) === archivedView)
    .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
  const titleOf = (id: string) => catalog.byId[id]?.title || '新会话';
  const update = (change: (previous: BookState) => BookState) => {
    setState((previous) => {
      const next = change(previous);
      localStorage.setItem(storageKey(book.id), JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === personaStorageKey || event.key === null) {
        setPersonaSettings(readNovelPersonaSettings());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const selectPersona = (id: string) => {
    const latest = readNovelPersonaSettings();
    const activeId = latest.personas.some((persona) => persona.id === id) ? id : defaultPersonaId;
    const next = { ...latest, activeId };
    try {
      writeNovelPersonaSettings(next);
      setPersonaSettings(next);
      setError('');
    } catch {
      setError('无法切换人设，请检查浏览器存储后重试。');
    }
  };

  useEffect(() => {
    if (chatArea.current) chatArea.current.inert = narrow && rail;
    if (narrow && rail) railClose.current?.focus({ preventScroll: true });
  }, [narrow, rail]);

  useEffect(() => {
    const element = panel.current;
    return () => {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = undefined;
      drag.current = undefined;
      element?.removeAttribute('data-nr-sheet-dragging');
      element?.style.removeProperty('--nr-sheet-transform');
    };
  }, [narrow]);

  const moveSheet = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const elapsed = event.timeStamp - gesture.lastAt;
    if (elapsed > 0) gesture.velocity = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastAt = event.timeStamp;
    const offset = Math.max(0, event.clientY - gesture.startY);
    panel.current?.style.setProperty('--nr-sheet-transform', 'translate3d(0,' + offset + 'px,0)');
  };

  const releaseSheet = (event: PointerEvent<HTMLButtonElement>, canceled = false) => {
    const gesture = drag.current;
    const element = panel.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !element) return;
    drag.current = undefined;
    element.removeAttribute('data-nr-sheet-dragging');
    const offset = event.clientY - gesture.startY;
    const velocity = event.timeStamp - gesture.lastAt <= 90 ? gesture.velocity : 0;
    if (!canceled && (offset >= element.clientHeight / 2 || (offset >= 24 && velocity > 0.5))) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        close();
      } else {
        element.style.setProperty('--nr-sheet-transform', 'translate3d(0,100%,0)');
        dismissTimer.current = setTimeout(close, 230);
      }
    } else element.style.removeProperty('--nr-sheet-transform');
  };

  const closeRail = () => {
    setRail(false);
    requestAnimationFrame(() => railToggle.current?.focus({ preventScroll: true }));
  };

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法完成会话操作。');
    } finally {
      setBusy(false);
    }
  };
  const select = (id: string) => {
    update((previous) => ({ ...previous, selected: id }));
    setView('chat');
    if (narrow) setRail(false);
  };
  const addSession = (id: string) => {
    update((previous) => ({ ...previous, entries: [...previous.entries, { id, token: crypto.randomUUID() }], selected: id }));
    setView('chat');
    setArchivedView(false);
    if (narrow) setRail(false);
  };
  const createSession = () => void run(async () =>
    addSession(await services.sessions.create({ agentPreset: companionPreset })),
  );

  useEffect(() => {
    const quote = book.quoteSnapshot;
    if (!quote || handledQuote.current === quote || busy) return;
    handledQuote.current = quote;
    setView('chat');
    setRail(false);
    if (!current) {
      const recent = state.entries.findLast((entry) => !archived.has(entry.id));
      if (recent) select(recent.id);
      else createSession();
    }
  }, [book.quoteSnapshot, busy, current, state.entries, archived, select, createSession]);

  const theme = {
    '--nr-paper': book.theme?.paper || '#f7efe3',
    '--nr-ink': book.theme?.ink || '#392921',
    '--nr-accent': book.theme?.accent || '#855340',
  } as CSSProperties;

  return (
    <aside ref={panel} className="nr-companion" aria-label="AI 面板" data-narrow={narrow} style={theme}>
      {narrow && (
        <button type="button" className="nr-handle" aria-label="下拉收起 AI 面板"
          onClick={(event) => { if (event.detail === 0) close(); }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0 || dismissTimer.current !== undefined) return;
            drag.current = {
              pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY,
              lastAt: event.timeStamp, velocity: 0,
            };
            panel.current?.setAttribute('data-nr-sheet-dragging', '');
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={moveSheet}
          onPointerUp={releaseSheet}
          onPointerCancel={(event) => releaseSheet(event, true)}
          onLostPointerCapture={(event) => releaseSheet(event, true)}
        ><span /></button>
      )}
      {narrow && rail && (
        <button type="button" className="nr-rail-dismiss" aria-label="点外收起会话侧栏"
          tabIndex={-1} onClick={closeRail} />
      )}
      <div className="nr-companion-body">
        {rail && (
          <nav className="nr-rail" id="nr-session-rail" aria-label="本书会话"
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || event.defaultPrevented) return;
              event.preventDefault();
              event.stopPropagation();
              closeRail();
            }}>
            <div className="nr-rail-title">
              {narrow && (
                <button type="button" ref={railClose} aria-label="收起本书会话侧栏"
                  onClick={closeRail}><SessionRailIcon open /></button>
              )}
              <strong title={book.title}>{book.title}</strong>
            </div>
            <button disabled={busy} onClick={createSession}>＋ 新会话</button>
            <div className="nr-rail-heading">
              <span>{archivedView ? '已归档' : '本书会话'}</span>
              <button onClick={() => setArchivedView(!archivedView)}>{archivedView ? '返回' : '归档'}</button>
            </div>
            {rows.map((entry) => (
              <div className="nr-session-row" key={entry.id} data-selected={entry.id === current?.id}>
                <button className="nr-session-name" title={titleOf(entry.id)} disabled={archivedView}
                  onClick={() => select(entry.id)}>{titleOf(entry.id)}</button>
                <details className="nr-row-actions">
                  <summary aria-label={titleOf(entry.id) + '的更多操作'}>⋯</summary>
                  <div>
                    {archivedView ? (
                      <button onClick={() => void run(() => services.workspaces.unarchiveSession(entry.id))}>取消归档</button>
                    ) : (
                      <>
                        <button onClick={() => { setDraftTitle(titleOf(entry.id)); setRenaming(entry); }}>重命名</button>
                        <button onClick={() => void run(async () => addSession(
                          await services.sessions.fork({ sessionId: entry.id, increaseTitle: true }),
                        ))}>分叉</button>
                        <button onClick={() => void run(() => pinned.has(entry.id)
                          ? services.workspaces.unpinSession(entry.id)
                          : services.workspaces.pinSession(entry.id))}>{pinned.has(entry.id) ? '取消置顶' : '置顶'}</button>
                        <button onClick={() => void run(() => services.workspaces.archiveSession(entry.id))}>归档</button>
                      </>
                    )}
                    <button onClick={() => void run(() => navigator.clipboard.writeText(entry.id))}>复制会话 ID</button>
                  </div>
                </details>
              </div>
            ))}
          </nav>
        )}
        <section className="nr-chat" ref={chatArea} aria-label="Agent 会话">
          <header className="nr-chat-header">
            <div className="nr-chat-title-row">
              <button type="button" ref={railToggle} aria-label="切换本书会话侧栏"
                aria-expanded={rail} aria-controls={rail ? 'nr-session-rail' : undefined}
                onClick={() => setRail(!rail)}><SessionRailIcon open={rail} /></button>
              <strong>{current ? titleOf(current.id) : 'AI'}</strong>
              <select className="nr-persona-select" aria-label="Agent 人设"
                title="切换 Agent 人设，从下一条消息生效"
                value={personaSettings.activeId} onChange={(event) => selectPersona(event.currentTarget.value)}>
                <option value={defaultPersonaId}>默认小说伴读</option>
                {personaSettings.personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>{persona.name}</option>
                ))}
              </select>
              <button className="nr-close" aria-label="收起 AI 面板" onClick={close}>×</button>
            </div>
            <div className="nr-chat-tabs">
              <button aria-pressed={view === 'chat'} onClick={() => setView('chat')}>对话</button>
              <button aria-pressed={view === 'trajectory'} onClick={() => setView('trajectory')}>轨迹</button>
              <button className="nr-spoiler" onClick={() => setSettings(true)}>
                防剧透 · {state.protectedReading ? '开启' : '关闭'}
              </button>
            </div>
          </header>
          {book.quoteSnapshot?.selection && (
            <div className="nr-selected-quote">
              <span title={book.quoteSnapshot.selection.text}>选中原文：{book.quoteSnapshot.selection.text}</span>
              <button type="button" aria-label="清除选区" onClick={() => clearQuote(book.quoteSnapshot!)}>×</button>
            </div>
          )}
          {error && <p className="nr-error" role="alert">{error}</p>}
          {current ? (
            <NativeSession key={current.id} entry={current} book={book.id} frame={frame}
              services={services} slots={slots} view={view} protectedReading={state.protectedReading} newSession={createSession}
              quoteSnapshot={book.quoteSnapshot} clearQuote={clearQuote} />
          ) : (
            <div className="nr-message">
              <p>选择本书的会话，或新建会话与 AI 对话。</p>
              {!rail && <button disabled={busy} onClick={createSession}>＋ 新会话</button>}
            </div>
          )}
        </section>
      </div>
      {settings && (
        <div className="nr-overlay">
          <section role="dialog" aria-label="防剧透模式">
            <button className="nr-close" aria-label="关闭防剧透设置" onClick={() => setSettings(false)}>×</button>
            <h3>防剧透模式</h3>
            <p>开启后，AI 只查阅你已读过的内容。关闭后，AI 可以查阅本书的未读内容。这个设置适用于本书的所有会话。</p>
            <label>启用防剧透 <input type="checkbox" role="switch" checked={state.protectedReading}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                update((previous) => ({ ...previous, protectedReading: checked }));
              }} /></label>
          </section>
        </div>
      )}
      {renaming && (
        <div className="nr-overlay">
          <form aria-label="重命名会话" role="dialog" onSubmit={(event) => {
            event.preventDefault();
            if (!draftTitle.trim()) return;
            void run(async () => {
              const ref = services.sessions.retain(renaming.id, { source: 'novelCompanion' });
              try {
                const result = await (await ref.ready).session.rename(draftTitle.trim());
                if (!result.ok) throw new Error('重命名失败。');
                setRenaming(undefined);
              } finally { ref.release(); }
            });
          }}>
            <h3>重命名会话</h3>
            <input aria-label="会话名称" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
            <button type="button" onClick={() => setRenaming(undefined)}>取消</button>
            <button type="submit" disabled={busy}>保存名称</button>
          </form>
        </div>
      )}
    </aside>
  );
}

export function ReaderPanel({ services, ...slots }: PanelSlots & { services: SessionServices }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<(ReaderBook & { quoteSnapshot?: ReadingSnapshot }) | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const measure = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 700));
    const readerRoot = root.current;
    if (readerRoot) measure.observe(readerRoot);
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const top = viewport?.scale === 1 ? Math.max(0, viewport.offsetTop) : 0;
      const bottom = viewport?.scale === 1 ? Math.max(0, window.innerHeight - viewport.height - top) : 0;
      readerRoot?.style.setProperty('--nr-viewport-top', top + 'px');
      readerRoot?.style.setProperty('--nr-viewport-bottom', bottom + 'px');
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    const receive = (event: MessageEvent) => {
      const message = event.data;
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow ||
        message?.channel !== companionChannel) return;
      if (message.type === 'open' && validId(message.book?.id) && typeof message.book.title === 'string') {
        setBook((current) => current?.id === message.book.id ? null : message.book);
      } else if (message.type === 'open-selection' && validId(message.book?.id) &&
        typeof message.book.title === 'string' && typeof message.snapshot?.selection?.text === 'string') {
        setBook({ ...message.book, quoteSnapshot: message.snapshot });
      } else if (message.type === 'closed') {
        setBook((current) => current?.id === message.book ? null : current);
      }
    };
    window.addEventListener('message', receive);
    return () => {
      measure.disconnect();
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('message', receive);
    };
  }, []);
  return (
    <div className="nr-root" ref={root} data-dsh-reader-root>
      <style>{companionStyle}</style>
      <iframe ref={frame} title="Readest 小说书库" src={readerPath} allow="fullscreen" inert={narrow && !!book} />
      {book && <BookPanel key={book.id} book={book} frame={frame} services={services}
        slots={slots} narrow={narrow} close={() => setBook(null)}
        clearQuote={(snapshot) => setBook((current) => current?.quoteSnapshot === snapshot
          ? { ...current, quoteSnapshot: undefined } : current)} />}
    </div>
  );
}
