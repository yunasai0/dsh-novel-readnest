export const companionChannel = 'readest-companion-v1';
export const companionPreset = 'readest-companion';
export const companionEndpoint = '/novel-reader/companion-bridge';
export const nearBookBatchBudget = 3_000;
export const chapterBookBatchBudget = 10_000;
export const roundBookBudget = 30_000;

export interface BookPoint {
  section: number;
  offset: number;
}

export interface ReadingSnapshot {
  title: string;
  chapter: string;
  endChapter?: string;
  chapterSource?: BookPoint;
  firstParagraph: number;
  lastParagraph: number;
  start: BookPoint;
  end: BookPoint;
  selection?: { text: string; end: BookPoint };
}

export type ChapterRef = string | number;
export type BookQuery =
  | { kind: 'near'; before: number; after: number }
  | { kind: 'chapter'; chapter: ChapterRef; volume?: number; paragraphs?: [number, number]; legacy?: true }
  | { kind: 'range'; chapters: [ChapterRef, ChapterRef]; volume?: number }
  | { kind: 'contents'; volume?: number };

export interface BookChapter {
  id: string;
  title: string;
  sequence: number;
  number?: number;
  volume?: number;
  volumeTitle?: string;
  part?: number;
}

export interface BookExcerpt extends BookChapter {
  coverage: 'full' | 'partial' | 'unavailable';
  text?: string;
  paragraphs?: [number, number];
  range?: { start: BookPoint; end: BookPoint };
}

export interface BookResult {
  status: 'ok' | 'ambiguous' | 'not_found' | 'unavailable' | 'invalid_request' | 'invalid_cursor';
  chapters?: BookExcerpt[];
  contents?: BookChapter[];
  candidates?: BookChapter[];
  stopReason?: 'completed' | 'spoiler_limit' | 'batch_limit' | 'round_budget';
  nextCursor?: string;
  message?: string;
}

export interface ReaderResult extends BookResult {
  next?: BookPoint;
  last?: BookPoint;
}

export interface BookRequest {
  id: string;
  query: BookQuery;
  snapshot: ReadingSnapshot;
  protectedReading: boolean;
  cutoff: BookPoint;
  limit: number;
  resume?: BookPoint;
}

export interface ReaderBook {
  id: string;
  title: string;
  theme?: { paper: string; ink: string; accent: string };
}
