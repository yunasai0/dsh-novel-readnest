const digits = '零一二三四五六七八九';
const aliases: Record<string, string> = { '〇': '零', '两': '二', '兩': '二', '壹': '一', '贰': '二', '貳': '二', '叁': '三', '參': '三', '肆': '四', '伍': '五', '陆': '六', '陸': '六', '柒': '七', '捌': '八', '玖': '九', '拾': '十', '佰': '百', '仟': '千', '萬': '万' };
const numeral = '0-9零〇一二两兩三四五六七八九十百千万萬壹贰貳叁參肆伍陆陸柒捌玖拾佰仟';

export function originalNumber(value: string): number | undefined {
  const text = [...value.normalize('NFKC').replace(/\s/g, '')].map((char) => aliases[char] ?? char).join('');
  if (/^[0-9]+$/.test(text)) {
    const number = Number(text);
    return Number.isSafeInteger(number) && number > 0 ? number : undefined;
  }
  if (/^[ivxlcdm]+$/i.test(text)) {
    const roman: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    const numbers = [...text.toLowerCase()].map((char) => roman[char]!);
    return numbers.reduce((sum, n, i) => sum + (n < (numbers[i + 1] ?? 0) ? -n : n), 0);
  }
  if (!/^[零一二三四五六七八九十百千万]+$/.test(text)) return undefined;
  if (!/[十百千万]/.test(text)) return Number([...text].map((char) => digits.indexOf(char)).join('')) || undefined;
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
  let total = 0, part = 0, digit = 0;
  for (const char of text) {
    const unit = units[char];
    if (unit === 10000) { total += (part + digit || 1) * unit; part = digit = 0; }
    else if (unit) { part += (digit || 1) * unit; digit = 0; }
    else digit = digits.indexOf(char);
  }
  return total + part + digit || undefined;
}

export function chapterNumberOf(title: string): number | undefined {
  const normalized = title.normalize('NFKC').trim();
  const raw = normalized.match(new RegExp(`^第\\s*([${numeral}\\s]+)[章回节節]`))?.[1]
    ?? normalized.match(/^chapter\s+(\d+|[ivxlcdm]+)\b/i)?.[1];
  return raw ? originalNumber(raw) : undefined;
}

export function volumeNumberOf(title: string): number | undefined {
  const normalized = title.normalize('NFKC').trim();
  const raw = normalized.match(new RegExp(`^第?\\s*([${numeral}\\s]+)[卷部册冊]`))?.[1]
    ?? normalized.match(new RegExp(`^[卷部]\\s*([${numeral}]+)`))?.[1]
    ?? normalized.match(/^(?:volume|vol\.?|book|part)\s+(\d+|[ivxlcdm]+)\b/i)?.[1];
  return raw ? originalNumber(raw) : undefined;
}

export function volumeMatches(actual: string | undefined, requested: string | undefined): boolean {
  if (!requested) return true;
  if (!actual) return false;
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s/g, '').toLocaleLowerCase();
  if (normalize(actual) === normalize(requested)) return true;
  const number = volumeNumberOf(requested);
  const bare = new RegExp(`^(?:第?[${numeral}]+[卷部册冊]|[卷部][${numeral}]+|(?:volume|vol\\.?|book|part)\\s+(?:\\d+|[ivxlcdm]+))$`, 'i');
  return number !== undefined && bare.test(requested.normalize('NFKC').trim()) && volumeNumberOf(actual) === number;
}
