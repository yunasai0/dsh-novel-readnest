import type { BookPoint, ReadingSnapshot } from './protocol.js';

export const compareBookPoints = (a: BookPoint, b: BookPoint) => a.section - b.section || a.offset - b.offset;

export function isBookPoint(value: unknown): value is BookPoint {
  if (!value || typeof value !== 'object' || !('section' in value) || !('offset' in value)) return false;
  return [value.section, value.offset].every((part) => typeof part === 'number' && Number.isSafeInteger(part) && part >= 0);
}

export function furthestPoint(...points: (BookPoint | undefined)[]) {
  return points.reduce<BookPoint | undefined>((furthest, point) =>
    point && (!furthest || compareBookPoints(point, furthest) > 0) ? point : furthest, undefined);
}

export const spoilerBoundaryOf = (snapshot: ReadingSnapshot) => snapshot.spoilerBoundary ?? snapshot.end;
const storageKey = (book: string) => 'dsh.novel-reader.furthest.' + book;

export function readFurthestPoint(book: string): BookPoint | undefined {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage.getItem(storageKey(book)) ?? 'null');
    return isBookPoint(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveFurthestPoint(book: string, point: BookPoint): BookPoint {
  const stored = readFurthestPoint(book);
  const furthest = furthestPoint(stored, point)!;
  if (!stored || compareBookPoints(furthest, stored) > 0) {
    try {
      globalThis.localStorage.setItem(storageKey(book), JSON.stringify(furthest));
    } catch {
      // The open reader still retains its furthest position if storage is unavailable.
    }
  }
  return furthest;
}
