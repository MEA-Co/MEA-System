import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { type RichTextNode, toEditorDocument } from '../lib/rich-text';

import styles from './RichTextContent.module.css';

export const richTextClasses = `${styles.content} whitespace-pre-wrap break-words [&_p]:min-h-[1.5em] [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:pl-1 [&_mark]:rounded-sm [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:text-inherit dark:[&_mark]:bg-yellow-400/35`;

function renderNode(node: RichTextNode, key: number): ReactNode {
  const content = node.content?.map(renderNode);
  switch (node.type) {
    case 'text':
      return node.marks?.length ? (
        <mark key={key}>{node.text}</mark>
      ) : (
        node.text
      );
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{content ?? <br />}</p>;
    case 'bulletList':
      return (
        <ul key={key} data-marker={node.attrs?.marker}>
          {content}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start ?? 1}>
          {content}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{content}</li>;
    default:
      return content;
  }
}
export function RichTextContent({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <div className={cn(richTextClasses, className)}>
      {toEditorDocument(value).content?.map(renderNode)}
    </div>
  );
}
