const ignored = 'script,style,head,template,[hidden],[aria-hidden="true"],[cfi-inert]';
const block = 'p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre,section,article,td,body';
export const comparable = (text: string) => text.replace(/\s+/g, ' ').trim();

export function extractBookText(doc: Document) {
  const spans: { node: Text; start: number; end: number }[] = [];
  const paragraphs: { start: number; end: number }[] = [];
  const parts: string[] = [];
  let length = 0;
  let parent: Element | null = null;
  if (doc.body) {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (node.parentElement?.closest(ignored)) continue;
      const group = node.parentElement?.closest(block) ?? doc.body;
      if (group !== parent && !node.data.trim()) continue;
      if (group !== parent || paragraphs.length === 0) {
        if (length) {
          parts.push('\n\n');
          length += 2;
        }
        parent = group;
        paragraphs.push({ start: length, end: length });
      }
      parts.push(node.data);
      spans.push({ node, start: length, end: length + node.length });
      length += node.length;
      paragraphs[paragraphs.length - 1]!.end = length;
    }
  }
  return { text: parts.join(''), paragraphs, spans };
}

export type SectionText = ReturnType<typeof extractBookText>;

export function textOffset(range: Range, book: SectionText, end: boolean) {
  const point = range.cloneRange();
  point.collapse(!end);
  const { startContainer, startOffset } = point;
  let previous = 0;
  for (const span of book.spans) {
    if (span.node === startContainer) return span.start + startOffset;
    if (point.comparePoint(span.node, 0) >= 0) return end ? previous : span.start;
    previous = span.end;
  }
  return previous;
}

export function paragraphAt(section: SectionText, offset: number) {
  let first = 0;
  let last = section.paragraphs.length;
  while (first < last) {
    const middle = (first + last) >>> 1;
    if (section.paragraphs[middle]!.end <= offset) first = middle + 1;
    else last = middle;
  }
  return Math.min(first, Math.max(0, section.paragraphs.length - 1));
}
