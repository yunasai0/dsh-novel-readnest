import { useNovelPreparation } from '@/services/novel/preparationProgress';

const labels = { reading: '正在读取书籍', converting: '正在整理正文', indexing: '正在建立目录', saving: '正在保存书籍' };

export default function NovelPreparationProgress({ kind }: { kind: 'import' | 'open' }) {
  const jobs = useNovelPreparation((state) => state.jobs);
  const active = Object.entries(jobs).filter(([, job]) => job.kind === kind);
  if (!active.length) return null;
  return (
    <div className='bg-base-100 border-base-300 eink-bordered mx-4 w-full max-w-sm space-y-4 rounded-xl border p-5'>
      {active.map(([id, job]) => {
        const percent = job.total ? Math.round((job.completed ?? 0) / job.total * 100) : undefined;
        return (
          <div key={id} className='space-y-2' data-novel-preparation={job.phase}>
            <p className='truncate text-sm font-medium' title={job.title}>{job.title}</p>
            <div className='flex justify-between gap-3 text-sm'>
              <span role='status'>{labels[job.phase]}…</span>
              {percent !== undefined && <span aria-hidden='true'>{percent}%</span>}
            </div>
            <progress className='progress progress-primary w-full' aria-label={labels[job.phase]} value={percent} max={100} />
          </div>
        );
      })}
    </div>
  );
}
