import type { BookPoint, BookRange } from './protocol.js';
import { compareBookPoints, isBookPoint } from './reading-progress';

export const validBookRange = (range: unknown): range is BookRange => !!range && typeof range === 'object' &&
  'start' in range && 'end' in range && isBookPoint(range.start) && isBookPoint(range.end) &&
  compareBookPoints(range.start, range.end) < 0;

export function mergeBookRanges(ranges: readonly BookRange[]): BookRange[] {
  const sorted = ranges.filter(validBookRange).map((range) => ({ start: { ...range.start }, end: { ...range.end } }))
    .sort((a, b) => compareBookPoints(a.start, b.start));
  const merged: BookRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && compareBookPoints(range.start, last.end) <= 0) {
      if (compareBookPoints(range.end, last.end) > 0) last.end = range.end;
    } else merged.push(range);
  }
  return merged;
}

export function clipBookRanges(ranges: readonly BookRange[], start: BookPoint, end: BookPoint): BookRange[] {
  return mergeBookRanges(ranges.map((range) => ({
    start: compareBookPoints(range.start, start) < 0 ? start : range.start,
    end: compareBookPoints(range.end, end) > 0 ? end : range.end,
  })));
}

export function subtractBookRanges(ranges: readonly BookRange[], covered: readonly BookRange[]): BookRange[] {
  let remaining = mergeBookRanges(ranges);
  for (const known of mergeBookRanges(covered)) {
    remaining = remaining.flatMap((range) => {
      if (compareBookPoints(known.end, range.start) <= 0 || compareBookPoints(known.start, range.end) >= 0) return [range];
      return [
        { start: range.start, end: compareBookPoints(known.start, range.end) < 0 ? known.start : range.end },
        { start: compareBookPoints(known.end, range.start) > 0 ? known.end : range.start, end: range.end },
      ].filter(validBookRange);
    });
  }
  return remaining;
}

export function countTextCharacters(text: string): number {
  let count = 0;
  for (const _character of text) count++;
  return count;
}

/** Source offsets stay UTF-16; budgets count Unicode characters without splitting surrogate pairs. */
export function textEndWithinBudget(text: string, from: number, until: number, budget: number): number {
  let offset = from;
  let count = 0;
  while (offset < until && count < budget) {
    const code = text.codePointAt(offset)!;
    const size = code > 0xffff ? 2 : 1;
    if (offset + size > until) break;
    offset += size; count++;
  }
  return offset;
}
