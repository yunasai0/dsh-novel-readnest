import type { BookRange } from '@dsh-reader/protocol';
import { mergeBookRanges, validBookRange } from '@dsh-reader/reading-ranges';

const key = (book: string) => 'dsh.novel-reader.visited.' + book;
export function readVisitedRanges(book: string, indexVersion: number): BookRange[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key(book)) ?? 'null');
    return stored?.indexVersion === indexVersion && Array.isArray(stored.ranges) && stored.ranges.every(validBookRange)
      ? mergeBookRanges(stored.ranges) : [];
  } catch { return []; }
}

export function saveVisitedRanges(book: string, indexVersion: number, ranges: BookRange[]): BookRange[] {
  const merged = mergeBookRanges([...readVisitedRanges(book, indexVersion), ...ranges]);
  try { localStorage.setItem(key(book), JSON.stringify({ indexVersion, ranges: merged })); }
  catch { /* The open reader retains the same coverage in memory; missing persisted ranges are never guessed. */ }
  return merged;
}
