const numbers = '0-9零〇一二两兩三四五六七八九十百千万萬壹贰貳叁參肆伍陆陸柒捌玖拾佰仟';

/** Clean display metadata only; the source heading remains in the book text. */
export function cleanNovelTitle(value: string) {
  return value.replace(/[\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^[☆★◇◆●○、·•※# ]+(?=第|chapter\b)/i, '');
}

export function isProseHeading(value: string) {
  const title = cleanNovelTitle(value);
  return new RegExp(`^第[ ${numbers}]+[篇节節讲講话話]`).test(title) && /[。；;]/.test(title);
}

/** A short title followed by a sentence on the same line is a lost newline. */
export function splitMixedHeading(value: string) {
  const match = value.match(new RegExp(`^((?:[☆★◇◆●○、·•※# ]*)第[ ${numbers}]+[章回]\\s+\\S+)\\s+(.{8,}[。！？!?].*)$`));
  return match ? { title: match[1]!, body: match[2]! } : undefined;
}

/** Normalize CRLF and lone CR, including a CR split across stream chunks. */
export function createNewlineNormalizer() {
  let carry = '';
  return (value: string, final = false) => {
    let text = carry + value;
    carry = !final && text.endsWith('\r') ? '\r' : '';
    if (carry) text = text.slice(0, -1);
    return text.replace(/\r\n?/g, '\n');
  };
}
