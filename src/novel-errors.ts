import type { BookResult, NovelNextCall } from './protocol.js';

export function novelError(code: string, message: string, guidance: string,
  options: { retryable?: boolean; next_call?: NovelNextCall; fields?: string[] } = {}): BookResult {
  return { status: code.startsWith('CURSOR_') ? 'invalid_cursor' : code === 'INVALID_ARGUMENTS' ? 'invalid_request'
    : code === 'CHAPTER_NOT_FOUND' ? 'not_found' : code === 'AMBIGUOUS_CHAPTER' ? 'ambiguous' : 'unavailable',
    message, error: { code, message, retryable: options.retryable ?? false, guidance,
      ...(options.fields ? { fields: options.fields } : {}) },
    ...(options.next_call ? { next_call: options.next_call } : {}) };
}

export const directoryRecovery: NovelNextCall = { tool: 'novel_chapters', arguments: {} };
export const syncRecovery: NovelNextCall = { tool: 'sync_reading', arguments: {} };
export const spoilerNotice = '【防剧透截止】剩余请求超出用户最远阅读位置，后文用户尚未读到，本次未提供；调整参数或更换工具不能继续读取后文。';
export const budgetNotice = '【本轮正文额度不足】本轮新增正文最多 30000 个字符，剩余额度不足以继续返回后文。请依据已有内容回复，在下一轮使用返回的游标继续。';
