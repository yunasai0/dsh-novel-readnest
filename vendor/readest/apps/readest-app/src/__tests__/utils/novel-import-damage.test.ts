// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TxtToEpubConverter } from '@/utils/txt';
import { cleanNovelTitle, createNewlineNormalizer } from '@/utils/novelHeadings';

type Chapter = { title: string; content: string; detected?: boolean; printedContents?: boolean; headingRepair?: string };
type Converter = {
  convertLargeFile(options: { file: File; language: string }): Promise<unknown>;
  createEpub(chapters: Chapter[]): Promise<Blob>;
  iterateSegmentsFromTextChunks(chunks: Iterable<string>, linesBetweenSegments: number): Generator<string>;
  consumeCompleteSegments(text: string, regex: RegExp): { pending: string; segments: string[] };
};
const paragraph = '山路蜿蜒，旅人继续向前走去。这是一段普通正文，应该完整保留在相应的章节中。';
async function convert(text: string, large = false) {
  const converter = new TxtToEpubConverter();
  const internal = converter as unknown as Converter;
  let chapters: Chapter[] = [];
  internal.createEpub = async (items) => { chapters = items; return new Blob(['fixture']); };
  const options = { file: new File([text], '验证.txt'), language: 'zh' };
  if (large) await internal.convertLargeFile(options);
  else await converter.convert(options);
  return chapters;
}

describe('real-novel format damage regressions', () => {
  it('recognizes decorated chapter headings while retaining their original text', async () => {
    const chapters = await convert('☆、第1章 惊蛰\n' + paragraph + '\n☆、第2章 稗草\n' + paragraph);
    expect(chapters.map((chapter) => cleanNovelTitle(chapter.title))).toEqual(['第1章 惊蛰', '第2章 稗草']);
    expect(chapters[0]?.content).toContain('☆、第1章 惊蛰');
  });

  it('keeps a sentence starting with a numbered essay inside its existing chapter', async () => {
    const sentence = '第四篇，知行合一！错则改之，无则加勉。';
    const chapters = await convert('第1章 开始\n' + paragraph + '\n' + sentence + '\n' + paragraph + '\n第2章 后续\n' + paragraph);
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第1章 开始', '第2章 后续']);
    expect(chapters[0]?.content).toContain(sentence);
    expect(chapters.map((chapter) => chapter.content).join('').split(sentence)).toHaveLength(2);
  });

  it('separates a glued first paragraph from title metadata without discarding it', async () => {
    const firstLine = '哪怕仍然心存疑虑，也不能否认这是一个有意思的人。';
    const chapters = await convert('第1章 玉簪 ' + firstLine + '\n' + paragraph + '\n第2章 出发\n' + paragraph);
    expect(chapters[0]?.title).toBe('第1章 玉簪');
    expect(chapters[0]?.headingRepair).toBe('mixed');
    expect(chapters[0]?.content).toContain('<p>' + firstLine);
  });

  it('collects a printed TOC into a marked non-chapter section', async () => {
    const titles = ['第1章 惊蛰', '第2章 稗草', '第3章 出发'];
    const text = ['目录', ...titles, '正文开始', ...titles.flatMap((title) => [title, paragraph])].join('\n');
    const chapters = await convert(text);
    expect(chapters.filter((chapter) => chapter.detected).map((chapter) => chapter.title)).toEqual(titles);
    expect(chapters.filter((chapter) => chapter.printedContents)).toHaveLength(1);
    titles.forEach((title) => expect(chapters[0]?.content).toContain(title));
  });

  it.each([false, true])('recognizes CR, CRLF and LF in the %s large-file path', async (large) => {
    const chapters = await convert('第1章 开始\r' + paragraph + '\r\n第2章 后续\n' + paragraph + '\r第3章 终点\r\n' + paragraph, large);
    expect(chapters.map((chapter) => chapter.title)).toEqual(['第1章 开始', '第2章 后续', '第3章 终点']);
  });

  it('normalizes a CRLF divided between stream chunks exactly once', () => {
    const normalize = createNewlineNormalizer();
    expect(normalize('甲\r') + normalize('\n乙\r') + normalize('丙\r', true)).toBe('甲\n乙\n丙\n');
  });

  it.each([1, 2, 7, 64])('preserves separators and text at %i-character stream boundaries', (size) => {
    const text = '第一段正文\r\n' + '\r\n'.repeat(9) + '第二段正文\n' + '-'.repeat(13) + '\r\n第三段正文\r尾声';
    const chunks = Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));
    const converter = new TxtToEpubConverter() as unknown as Converter;
    const actual = [...converter.iterateSegmentsFromTextChunks(chunks, 8)].map((part) => part.trim()).filter(Boolean);
    const expected = text.replace(/\r\n?/g, '\n').split(/\n{8,}|-{8,}\n/).map((part) => part.trim()).filter(Boolean);
    expect(actual).toEqual(expected);
  });

  it('scans each new chunk instead of repeatedly scanning the accumulated long novel', () => {
    const converter = new TxtToEpubConverter() as unknown as Converter;
    const original = converter.consumeCompleteSegments.bind(converter);
    let scanned = 0;
    converter.consumeCompleteSegments = (text, regex) => { scanned += text.length; return original(text, regex); };
    const chunks = Array.from({ length: 128 }, () => '连续正文'.repeat(2000));
    const actual = [...converter.iterateSegmentsFromTextChunks(chunks, 8)];
    expect(actual.join('')).toBe(chunks.join(''));
    expect(scanned).toBeLessThanOrEqual(chunks.join('').length * 1.01);
  });
});
