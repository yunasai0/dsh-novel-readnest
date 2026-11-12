import { create } from 'zustand';

export interface NovelPreparation {
  title: string;
  kind: 'import' | 'open';
  phase: 'reading' | 'converting' | 'indexing' | 'saving';
  completed?: number;
  total?: number;
}

export const useNovelPreparation = create<{ jobs: Record<string, NovelPreparation> }>(() => ({ jobs: {} }));
const updated = new Map<string, number>();

export function setNovelPreparation(id: string, progress: NovelPreparation | null) {
  const previous = useNovelPreparation.getState().jobs[id];
  const now = Date.now();
  if (progress && previous?.phase === progress.phase && progress.completed !== progress.total &&
    now - (updated.get(id) ?? 0) < 60) return;
  useNovelPreparation.setState(({ jobs }) => {
    const next = { ...jobs };
    if (progress) { next[id] = progress; updated.set(id, now); }
    else { delete next[id]; updated.delete(id); }
    return { jobs: next };
  });
}
