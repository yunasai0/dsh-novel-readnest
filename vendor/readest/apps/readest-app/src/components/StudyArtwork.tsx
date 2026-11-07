import type { ReactNode } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

const studyPath = process.env['NEXT_PUBLIC_DSH_READER_PATH'];
export const isPrivateStudy = Boolean(studyPath);

export type StudyArtworkKind =
  | 'assistant'
  | 'audio'
  | 'book'
  | 'bookmark'
  | 'cover'
  | 'crest'
  | 'globe'
  | 'preferences'
  | 'quill';

interface StudyArtworkProps {
  kind: StudyArtworkKind;
  fallback?: ReactNode;
  className?: string;
  active?: boolean;
}

export default function StudyArtwork({ kind, fallback, className, active }: StudyArtworkProps) {
  if (!studyPath) return fallback ?? null;

  return (
    <span
      className={clsx('study-artwork', className)}
      data-active={active || undefined}
      aria-hidden='true'
    >
      <Image
        src={`${studyPath}/study/${kind}.webp`}
        alt=''
        width={48}
        height={48}
        className='study-artwork-image'
        loading={kind === 'crest' ? 'eager' : 'lazy'}
      />
      <span className='study-artwork-fallback'>{fallback}</span>
    </span>
  );
}
