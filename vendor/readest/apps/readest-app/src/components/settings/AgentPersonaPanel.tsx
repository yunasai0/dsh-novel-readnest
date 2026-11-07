import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  customPersonaPrompt,
  defaultNovelPersona,
  defaultPersonaId,
  fixedNovelRules,
  personaNameLimit,
  personaStorageKey,
  readNovelPersonaSettings,
  selectedNovelPersona,
  writeNovelPersonaSettings,
  type NovelPersona,
  type NovelPersonaSettings,
} from '@dsh-reader/persona';
import BoxedList from './primitives/BoxedList';

const defaultName = '默认小说伴读';

export default function AgentPersonaPanel() {
  const field = useId();
  const [settings, setSettings] = useState(readNovelPersonaSettings);
  const [draft, setDraft] = useState<NovelPersona>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const active = selectedNovelPersona(settings);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === personaStorageKey || event.key === null) {
        setSettings(readNovelPersonaSettings());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function persist(next: NovelPersonaSettings) {
    try {
      writeNovelPersonaSettings(next);
      setSettings(next);
      setError('');
      return true;
    } catch {
      setError('无法保存人设，请检查浏览器存储后重试。');
      return false;
    }
  }

  function select(id: string) {
    const latest = readNovelPersonaSettings();
    const activeId = latest.personas.some((persona) => persona.id === id) ? id : defaultPersonaId;
    persist({ ...latest, activeId });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || confirmDelete) return;
    const name = draft.name.trim();
    const prompt = customPersonaPrompt(draft.prompt);
    if (!name || !prompt) {
      setError('请输入人设名称和提示词。');
      return;
    }
    const latest = readNovelPersonaSettings();
    if (draft.id && !latest.personas.some((item) => item.id === draft.id)) {
      setSettings(latest);
      setDraft(undefined);
      setError('此人设已被删除。');
      return;
    }
    if (name === defaultName || latest.personas.some((persona) => persona.id !== draft.id && persona.name === name)) {
      setError('此名称已被使用，请换一个名称。');
      return;
    }
    const id = draft.id || crypto.randomUUID();
    const persona = { id, name, prompt };
    const personas = latest.personas.some((item) => item.id === id)
      ? latest.personas.map((item) => item.id === id ? persona : item)
      : [...latest.personas, persona];
    if (persist({ activeId: id, personas })) setDraft(undefined);
  }

  function deletePersona() {
    const id = draft?.id;
    if (!id || id === defaultPersonaId) return;
    const latest = readNovelPersonaSettings();
    const personas = latest.personas.filter((item) => item.id !== id);
    const activeId = latest.activeId === id ? defaultPersonaId : latest.activeId;
    if (persist({ activeId, personas })) {
      setDraft(undefined);
      setConfirmDelete(false);
    }
  }
  return (
    <div className='my-4 w-full space-y-5'>
      <BoxedList title='当前人设' innerClassName='px-4'>
        <div className='space-y-3 py-4'>
          <label className='sr-only' htmlFor={field}>当前人设</label>
          <select
            id={field}
            className='select w-full'
            value={settings.activeId}
            disabled={!!draft}
            onChange={(event) => select(event.target.value)}
          >
            <option value={defaultPersonaId}>{defaultName}</option>
            {settings.personas.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.name}</option>
            ))}
          </select>
          <p className='text-base-content/65 text-sm'>适用于此浏览器中的小说会话，从下一条消息生效。</p>
          {!draft && (
            <div className='flex flex-wrap gap-2'>
              <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={() => { setError(''); setDraft({ id: '', name: '', prompt: '' }); }}
              >
                新建人设
              </button>
              {active && (
                <>
                  <button type='button' className='btn btn-outline btn-sm' onClick={() => { setError(''); setDraft(active); }}>
                    编辑人设
                  </button>
                  <button type='button' className='btn btn-ghost btn-sm' onClick={() => select(defaultPersonaId)}>
                    切回默认
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </BoxedList>
      {draft ? (
        <BoxedList title={draft.id ? '编辑人设' : '新建人设'} innerClassName='px-4'>
          <form className='space-y-3 py-4' onSubmit={save}>
            <label className='block space-y-1 text-sm'>
              <span>人设名称</span>
              <input
                className='input w-full'
                value={draft.name}
                maxLength={personaNameLimit}
                placeholder='例如：悬疑编辑'
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className='block space-y-1 text-sm'>
              <span>人设提示词</span>
              <textarea
                className='textarea min-h-36 w-full'
                value={draft.prompt}
                placeholder='描述希望 Agent 使用的语气、回答方式和讨论重点。'
                onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
              />
            </label>
            <div className='flex flex-wrap justify-end gap-2'>
              {draft.id && draft.id !== defaultPersonaId && !confirmDelete && (
                <button type='button' className='btn btn-ghost btn-sm text-error me-auto'
                  onClick={() => setConfirmDelete(true)}>
                  删除人设
                </button>
              )}
              <button type='button' className='btn btn-ghost btn-sm' onClick={() => { setDraft(undefined); setConfirmDelete(false); setError(''); }}>
                取消
              </button>
              <button type='submit' className='btn btn-primary btn-sm' disabled={confirmDelete}>保存并启用</button>
            </div>
            {confirmDelete && (
              <div className='border-error/30 space-y-2 rounded-lg border p-3 text-sm'>
                <p>删除此自建人设？如果它正在启用，将切回默认小说伴读。</p>
                <div className='flex flex-wrap justify-end gap-2'>
                  <button type='button' className='btn btn-ghost btn-sm' onClick={() => setConfirmDelete(false)}>保留人设</button>
                  <button type='button' className='btn btn-error btn-sm' onClick={deletePersona}>确认删除</button>
                </div>
              </div>
            )}
          </form>
        </BoxedList>
      ) : (
        <BoxedList title='生效人设' innerClassName='px-4'>
          <p className='whitespace-pre-wrap break-words py-4 text-sm leading-relaxed'>
            {active?.prompt ?? defaultNovelPersona}
          </p>
        </BoxedList>
      )}
      {error && <p className='text-error text-sm' role='alert'>{error}</p>}
      <BoxedList innerClassName='px-4'>
        <details className='py-3'>
          <summary className='cursor-pointer text-sm font-medium'>插件固定规则</summary>
          <p className='text-base-content/70 mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed'>
            {fixedNovelRules}
          </p>
        </details>
      </BoxedList>
    </div>
  );
}
