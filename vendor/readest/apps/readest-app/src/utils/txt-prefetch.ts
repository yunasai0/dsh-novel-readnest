export const TXT_PREFETCH_MAX_BYTES = 8 * 1024 * 1024;

/** Bounded, import-only reuse of the exact XHTML written to the EPUB. */
export function createTxtPrefetch(enabled = false) {
  const texts: Record<string, string> | undefined = enabled ? {} : undefined;
  let bytes = 0;
  const collect = texts ? (name: string, text: string) => {
    const size = text.length * 2;
    if (bytes + size > TXT_PREFETCH_MAX_BYTES) return;
    texts[name] = text;
    bytes += size;
  } : undefined;
  return { texts, collect };
}
