import { useCallback, useEffect, useState } from 'react';
import {
  savedSkill, saveSkill, skillCatalogEndpoint, type SkillCatalog, type SkillChoice,
} from '@dsh-reader/skill-choice';
import BoxedList from './primitives/BoxedList';

type ScriptOption = { id: string; label: string };
async function request<T>(signal: AbortSignal, body?: object): Promise<T> {
  const response = await fetch(skillCatalogEndpoint, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message ?? '无法读取 DSH 的技能目录。');
  return payload as T;
}

export default function AgentSkillSettings({ personaId, personaName }: { personaId: string; personaName: string }) {
  const [catalog, setCatalog] = useState<SkillCatalog>();
  const [choice, setChoice] = useState(() => savedSkill(personaId));
  const [applied, setApplied] = useState(choice);
  const [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => setCount(c => c + 1), []);
  useEffect(() => {
    const ac = new AbortController();
    setCatalog(undefined); setError('');
    void request<SkillCatalog>(ac.signal).then(v => { if (!ac.signal.aborted) setCatalog(v); })
      .catch(() => { if (!ac.signal.aborted) setError('未能读取当前 DSH 的技能目录，请刷新重试。'); });
    return () => ac.abort();
  }, [count]);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  const selected = catalog?.skills.find(s => s.key === choice?.key);
  useEffect(() => {
    const ac = new AbortController();
    setScripts([]);
    if (selected) void request<ScriptOption[]>(ac.signal, { op: 'scripts', choice: { name: selected.name, key: selected.key, tool: '' } })
      .then(rows => { if (!ac.signal.aborted) setScripts(rows); })
      .catch(() => { if (!ac.signal.aborted) setError('无法检查该技能的脚本入口。'); });
    return () => ac.abort();
  }, [selected]);
  const script = scripts.some(s => s.id === choice?.tool);
  const native = catalog?.tools.some(t => t.id === choice?.tool);
  const available = !!selected && (!choice?.tool || script || native);
  const missing = applied && catalog && !catalog.skills.some(s => s.key === applied.key);
  const change = async (next: SkillChoice | null) => {
    setBusy(true); setError('');
    try {
      if (next) await request(new AbortController().signal, { op: 'check', choice: next });
      saveSkill(personaId, next);
      setChoice(next ?? undefined); setApplied(next ?? undefined);
    } catch (e) { setError(e instanceof Error ? e.message : '无法保存技能设置。'); }
    finally { setBusy(false); }
  };
  return <BoxedList title="陪读技能" innerClassName="px-4">
    <div className="space-y-3 py-4">
      <p className="text-sm">当前人设：{personaName} · {applied ? (missing ? '此设备未找到 ' : '已配置 ') + applied.name : '未启用技能'}</p>
      <label className="block space-y-1 text-sm"><span>已安装的 Skills</span>
        <select className="select w-full" disabled={!catalog || busy} value={choice?.key ?? ''}
          onChange={e => { const s = catalog?.skills.find(item => item.key === e.target.value);
            setChoice(s ? { name: s.name, key: s.key, tool: '' } : undefined); }}>
          <option value="">{catalog ? '不使用技能' : '正在检测…'}</option>
          {choice && !selected && <option value={choice.key} disabled>{choice.name}（{catalog ? '此设备不可用' : '正在检查'}）</option>}
          {catalog?.skills.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </label>
      <p className="text-base-content/65 text-sm" role="status">{catalog ? (catalog.skills.length ?
        '已检测到 ' + catalog.skills.length + ' 个技能。只有保存的这一项会交给陪读。' :
        '没有检测到可用技能。在运行 DSH 的设备上安装技能后刷新。') : error ? '' : '正在检查此设备的 DSH 技能目录…'}</p>
      {selected && <>
        <p className="text-base-content/75 text-sm">{selected.description}</p>
        <label className="block space-y-1 text-sm"><span>生图入口（可选）</span>
          <select className="select w-full" value={choice?.tool ?? ''} disabled={busy}
            onChange={e => { const tool = e.target.value; setChoice(c => c && { ...c, tool }); }}>
            <option value="">仅使用技能说明</option>
            {choice?.tool && !script && !native && <option value={choice.tool} disabled>上次绑定的入口（不可用）</option>}
            {catalog?.tools.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            {scripts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="text-base-content/65 text-sm">{script ?
          '只选择你信任的脚本。它以 DSH 主机用户身份运行，陪读只能传画面描述。' :
          '需要实际生成插画时，绑定该技能对应的生图工具或兼容脚本；只使用说明不会自动出图。'}</p>
      </>}
      {error && <p className="text-error text-sm" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={refresh}>重新检测</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || (!available && !!choice) || (!choice && !applied)}
          onClick={() => void change(choice ?? null)}>保存技能设置</button>
        {applied && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void change(null)}>停用技能</button>}
      </div>
    </div>
  </BoxedList>;
}
