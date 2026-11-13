import type { ReadingProvenance } from './protocol.js';

export const snapshotLabel = '小说阅读快照 ';
export interface NovelSession {
  id: string;
  seq: number;
  eventAt(seq: number): { type: string; data: unknown } | undefined;
}
export interface NovelEventData {
      name?: string;
      callId?: string;
      turn?: number;
      rootCallId?: string;
      parentCallId?: string;
      subCallId?: string;
      reason?: { kind?: string };
      isError?: boolean;
      interrupted?: boolean;
      meta?: { novelReader?: ReadingProvenance };
      message?: { callId?: string; source?: { callId?: string }; isError?: boolean; content?: { type: string; text?: string }[] };
      source?: { kind?: string };
      content?: { type: string; text?: string }[];
}

export const novelEventData = (value: unknown): NovelEventData => value && typeof value === 'object' ? value as NovelEventData : {};
