/** Versioned, text-column-compatible content. Legacy strings remain literal text. */
export const RICH_TEXT_PREFIX = '::mea-rich-text:v1::';
export type RichTextNode = {
  type: 'doc' | 'paragraph' | 'bulletList' | 'listItem' | 'text' | 'hardBreak';
  text?: string;
  attrs?: { marker: 'plus' };
  marks?: { type: 'highlight' }[];
  content?: RichTextNode[];
};

export function normalizeRichText(input: unknown): RichTextNode | null {
  let remaining = 10000;
  function visit(value: unknown, depth: number): RichTextNode | null {
    if (--remaining < 0 || depth > 16 || !value || typeof value !== 'object')
      return null;
    const n = value as Record<string, unknown>;
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || !n.text.length) return null;
      if (
        n.marks !== undefined &&
        (!Array.isArray(n.marks) ||
          n.marks.some(
            (m) => !m || typeof m !== 'object' || m.type !== 'highlight',
          ))
      )
        return null;
      return {
        type: 'text',
        text: n.text,
        ...(Array.isArray(n.marks) && n.marks.length
          ? { marks: [{ type: 'highlight' as const }] }
          : {}),
      };
    }
    if (n.type === 'hardBreak') return { type: 'hardBreak' };
    if (
      !['doc', 'paragraph', 'bulletList', 'listItem'].includes(String(n.type))
    )
      return null;
    if (n.content !== undefined && !Array.isArray(n.content)) return null;
    const children = ((n.content ?? []) as unknown[]).map((child) =>
      visit(child, depth + 1),
    );
    if (children.some((child) => child === null)) return null;
    const content = children as RichTextNode[];
    const allowed =
      n.type === 'paragraph'
        ? ['text', 'hardBreak']
        : n.type === 'bulletList'
          ? ['listItem']
          : ['paragraph', 'bulletList'];
    if (content.some((child) => !allowed.includes(child.type))) return null;
    if (n.type !== 'paragraph' && !content.length) return null;
    if (n.type === 'listItem' && content[0]?.type !== 'paragraph') return null;
    return {
      type: n.type as RichTextNode['type'],
      ...(n.type === 'bulletList' &&
      n.attrs &&
      typeof n.attrs === 'object' &&
      (n.attrs as Record<string, unknown>).marker === 'plus'
        ? { attrs: { marker: 'plus' as const } }
        : {}),
      ...(content.length ? { content } : {}),
    };
  }
  const root = visit(input, 0);
  return root?.type === 'doc' ? root : null;
}

export function parseRichText(value: string): RichTextNode | null {
  if (!value.startsWith(RICH_TEXT_PREFIX) || value.length > 100000) return null;
  try {
    return normalizeRichText(JSON.parse(value.slice(RICH_TEXT_PREFIX.length)));
  } catch {
    return null;
  }
}
export function toEditorDocument(value: string): RichTextNode {
  return (
    parseRichText(value) ?? {
      type: 'doc',
      content: value.split('\n').map((line) => ({
        type: 'paragraph',
        ...(line ? { content: [{ type: 'text', text: line }] } : {}),
      })),
    }
  );
}
export function richTextPlainText(value: string | RichTextNode): string {
  const doc = typeof value === 'string' ? parseRichText(value) : value;
  if (!doc) return typeof value === 'string' ? value : '';
  function text(n: RichTextNode): string {
    if (n.type === 'text') return n.text ?? '';
    if (n.type === 'hardBreak') return '\n';
    return (n.content ?? []).map(text).join(n.type === 'paragraph' ? '' : '\n');
  }
  return text(doc);
}
export function serializeRichText(input: unknown): string {
  const doc = normalizeRichText(input);
  if (!doc) throw new Error('Invalid questionnaire rich text');
  const plain = richTextPlainText(doc);
  if (!plain.trim()) return plain;
  function formatted(n: RichTextNode): boolean {
    return (
      n.type === 'bulletList' ||
      !!n.marks?.length ||
      (n.content ?? []).some(formatted)
    );
  }
  return formatted(doc) || plain.startsWith(RICH_TEXT_PREFIX)
    ? RICH_TEXT_PREFIX + JSON.stringify(doc)
    : plain;
}

export function normalizeRichTextValue(value: string): string {
  const doc = parseRichText(value);
  return doc ? serializeRichText(doc) : value;
}
