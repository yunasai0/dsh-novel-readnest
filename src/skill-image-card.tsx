import type { ReactNode } from 'react';
import type { ImageBlock } from '@deepseek-ai/dsh-llm';

interface ResultPart { type: string; text?: string; attachment?: ImageBlock['attachment'] }
export function SkillImageCard({ phase, block, loadImage, renderFactorySlot }: {
  phase: string; block?: { content?: ResultPart[]; isError?: boolean };
  loadImage?: unknown; renderFactorySlot?(name: string, input: object): ReactNode;
}) {
  if (phase !== 'result') return <p role="status">正在绘制小说插画…</p>;
  const parts = block?.content ?? [];
  const images = parts.filter(p => p.type === 'image' && p.attachment).map(p => ({ attachment: p.attachment }));
  return <div><p>{parts.find(p => p.type === 'text')?.text ?? (block?.isError ? '插画未生成。' : '小说插画')}</p>
    {!!images.length && renderFactorySlot?.('conversation.images.content', { images, loadImage, align: 'start' })}</div>;
}
