export const companionChannel = 'readest-companion-v1';
export const companionPreset = 'readest-companion';
export const companionEndpoint = '/novel-reader/companion-bridge';
export const companionRequestBodyLimit = 32 * 1024 * 1024;
export const roundBookBudget = 30_000;
export const novelToolNames = ['read_current', 'sync_reading', 'read_chapters', 'read_chapter_ids', 'novel_chapters', 'continue_reading'] as const;
export type NovelToolName = typeof novelToolNames[number];

export interface BookPoint {
  section: number;
  offset: number;
}

export interface BookRange { start: BookPoint; end: BookPoint }
export interface ReadingLocation extends BookRange {
  chapter_id?: string;
  chapter: string;
  chapter_number?: number;
  volume_title?: string;
  firstParagraph: number;
  lastParagraph: number;
  ranges?: BookRange[];
}

export interface NovelNextCall {
  tool: NovelToolName;
  arguments: Record<string, unknown>;
  when?: 'now' | 'next_turn' | 'after_user_action';
}

export interface NovelToolError {
  code: string;
  message: string;
  retryable: boolean;
  guidance: string;
  fields?: string[];
}

export const isChapterId = (value: unknown): value is string =>
  typeof value === 'string' && /^ch_[a-f0-9]{16}$/.test(value);

export interface ReadingSnapshot {
  title: string;
  chapter: string;
  chapter_id?: string;
  endChapter?: string;
  end_chapter_id?: string;
  chapterSource?: BookPoint;
  firstParagraph: number;
  lastParagraph: number;
  start: BookPoint;
  end: BookPoint;
  // Frozen furthest reading position; older clients fall back to the visible page end.
  spoilerBoundary?: BookPoint;
  indexVersion?: number;
  reading?: ReadingLocation;
  visibleRanges?: BookRange[];
  visitedRanges?: BookRange[];
  selection?: { text: string; start?: BookPoint; end: BookPoint; ranges?: BookRange[] };
}

export type BookQuery =
  | { kind: 'near'; before: number; after: number }
  | { kind: 'chapter'; chapter_id: string }
  | { kind: 'range'; start_chapter_id: string; end_chapter_id: string }
  | { kind: 'ids'; chapter_ids: string[] }
  | { kind: 'numbers'; start: number; end: number; volume?: string }
  | { kind: 'segments'; ranges: BookRange[] }
  | { kind: 'contents'; query?: string; chapter_numbers?: number[]; volume?: string };

export type BookToolQuery = BookQuery | { kind: 'sync' } | { cursor: string };

export interface BookChapter {
  chapter_id: string;
  title: string;
  volume_title?: string;
  chapter_number?: number;
  volume_number?: number;
  kind: 'chapter' | 'unsectioned';
  previous_id?: string;
  next_id?: string;
}

export interface BookExcerpt extends BookChapter {
  coverage: 'full' | 'partial' | 'unavailable';
  text?: string;
  paragraphs?: [number, number];
  range?: { start: BookPoint; end: BookPoint };
  location?: { start: { paragraph: number; character: number }; end: { paragraph: number; character: number } };
  end_notice?: string;
}

export interface BookResult {
  status: 'ok' | 'partial' | 'blocked' | 'ambiguous' | 'not_found' | 'unavailable' | 'invalid_request' | 'invalid_cursor';
  chapters?: BookExcerpt[];
  contents?: BookChapter[];
  candidates?: BookChapter[];
  stopReason?: 'completed' | 'spoiler_limit' | 'batch_limit' | 'round_budget';
  nextCursor?: string;
  message?: string;
  error?: NovelToolError;
  next_call?: NovelNextCall;
  end_notice?: string;
  budget?: { limit_chars: number; returned_chars: number; used_chars: number; remaining_chars: number };
  sync?: { state: 'not_started' | 'pending' | 'up_to_date' | 'partial'; has_gaps: boolean; target: BookPoint };
}

export interface ReaderResult extends BookResult {
  next?: BookPoint;
  last?: BookPoint;
  deliveredRanges?: BookRange[];
  resolvedRanges?: BookRange[];
  limits?: ('spoiler_limit' | 'round_budget')[];
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

export interface SyncState {
  baseline?: BookPoint;
  covered: BookRange[];
  last?: ReadingLocation;
  has_gaps?: boolean;
}

export type BookPoll = BookRequest | { type: 'sync-state'; state: SyncState };

export interface ReadTask {
  id: string;
  owner: string;
  book: string;
  indexVersion: number;
  query: BookQuery;
  snapshot: ReadingSnapshot;
  resume?: BookPoint;
  boundary?: BookPoint;
  sync?: { baseline: BookPoint; target: BookPoint; has_gaps: boolean };
  current?: { baseline: BookPoint; target: BookPoint; ranges: BookRange[] };
}

export interface ReadingProvenance {
  book: string;
  point?: BookPoint;
  indexVersion?: number;
  owner?: string;
  turn?: number;
  cursor?: ReadTask;
  sync?: { baseline: BookPoint; delivered: BookRange[]; target: BookPoint; last?: ReadingLocation };
}

export interface ReaderBook {
  id: string;
  title: string;
  reading?: ReadingLocation;
  theme?: { paper: string; ink: string; accent: string };
}
