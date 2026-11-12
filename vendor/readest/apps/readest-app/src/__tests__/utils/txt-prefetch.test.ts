// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { TxtToEpubConverter } from '@/utils/txt';
import { createTxtPrefetch, TXT_PREFETCH_MAX_BYTES } from '@/utils/txt-prefetch';
import { DocumentLoader } from '@/libs/document';

describe('bounded TXT import text reuse', () => {
  it('does not change EPUB bytes when collecting text for the index', async () => {
    const file = new File(['第1章 初见\n这是原文。\n第2章 重逢\n原文包含 & < > 和表情🙂。'], 'fixture.txt');
    const ordinary = await new TxtToEpubConverter().convert({ file, language: 'zh' });
    const cached = await new TxtToEpubConverter().convert({ file, language: 'zh', prefetchText: true });
    expect(new Uint8Array(await cached.file.arrayBuffer())).toEqual(new Uint8Array(await ordinary.file.arrayBuffer()));
    expect(Object.keys(cached.prefetchedText!)).toEqual(['OEBPS/chapter1.xhtml', 'OEBPS/chapter2.xhtml']);
    expect(cached.prefetchedText!['OEBPS/chapter2.xhtml']).toContain('&amp; &lt; &gt;');
    expect(ordinary.prefetchedText).toBeUndefined();
  });

  it('caps retained text rather than retaining an unbounded whole novel', () => {
    const cache = createTxtPrefetch(true);
    cache.collect!('first.xhtml', '甲'.repeat(TXT_PREFETCH_MAX_BYTES / 2));
    cache.collect!('overflow.xhtml', '乙');
    expect(Object.keys(cache.texts!)).toEqual(['first.xhtml']);
    expect(Object.values(cache.texts!).reduce((bytes, text) => bytes + text.length * 2, 0)).toBe(TXT_PREFETCH_MAX_BYTES);
    expect(createTxtPrefetch().collect).toBeUndefined();
  });

  it('consumes generated text once, then falls back to the original ZIP loader', async () => {
    const name = 'OEBPS/chapter1.xhtml';
    const xml = '<html><body><p>原文</p></body></html>';
    const transientText = new Map([[name, xml]]);
    const getData = vi.fn(async () => xml);
    const document = new DocumentLoader(new File(['fixture'], 'book.epub'), { transientText }) as unknown as {
      makeZipLoader(entries: Promise<unknown[]>): Promise<{ loadText(name: string): Promise<string> }>;
    };
    const loader = await document.makeZipLoader(Promise.resolve([{ filename: name, getData }]));
    expect(await loader.loadText(name)).toBe(xml);
    expect(transientText.size).toBe(0);
    expect(getData).not.toHaveBeenCalled();
    expect(await loader.loadText(name)).toBe(xml);
    expect(getData).toHaveBeenCalledOnce();
  });
});
