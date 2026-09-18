'use client';

import { Extension } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { Plugin } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Highlighter } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

import { QuestionnaireList } from '../lib/list-extension';
import {
  richTextPlainText,
  serializeRichText,
  toEditorDocument,
} from '../lib/rich-text';

import { richTextClasses } from './RichTextContent';

export function QuestionRichTextEditor({
  id,
  value,
  onChange,
  placeholder = '내용을 작성하세요',
  disabled = false,
  required = false,
  maxLength = 20000,
  className,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const lengthLimit = useMemo(
    () =>
      Extension.create({
        name: 'questionnaireLengthLimit',
        addProseMirrorPlugins() {
          let lastWarning = 0;
          return [
            new Plugin({
              filterTransaction(transaction, state) {
                if (!transaction.docChanged) return true;
                let next: string;
                try {
                  next = serializeRichText(transaction.doc.toJSON());
                } catch {
                  return false;
                }
                if (
                  next.length <= maxLength ||
                  next.length <= serializeRichText(state.doc.toJSON()).length
                )
                  return true;
                if (Date.now() - lastWarning > 3000) {
                  lastWarning = Date.now();
                  toast.add({
                    type: 'error',
                    title: '입력 가능한 길이를 넘었어요. 내용을 줄여 주세요.',
                    timeout: 4000,
                  });
                }
                return false;
              },
            }),
          ];
        },
      }),
    [maxLength],
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        heading: false,
        blockquote: false,
        horizontalRule: false,
        orderedList: false,
        bulletList: false,
        link: false,
        trailingNode: false,
      }),
      Highlight.configure({ multicolor: false }),
      QuestionnaireList,
      lengthLimit,
    ],
    content: toEditorDocument(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? placeholder,
        'aria-required': String(required),
        class: cn(richTextClasses, 'min-h-24 px-3 py-2 text-sm outline-none'),
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(serializeRichText(current.getJSON())),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      empty: current?.isEmpty ?? !value,
      highlighted: current?.isActive('highlight') ?? false,
    }),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor || serializeRichText(editor.getJSON()) === value) return;
    // Parent only supplies accepted remote snapshots. Do not reset selection or
    // undo history for the normal onChange echo (including autosave responses).
    editor.commands.setContent(toEditorDocument(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className={cn(
        'relative min-w-0 rounded-lg border border-border bg-muted shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        disabled && 'opacity-50',
        className,
      )}
    >
      {state?.empty && (
        <span
          className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground"
          aria-hidden="true"
        >
          {placeholder}
        </span>
      )}
      <EditorContent editor={editor} />
      {required && (
        <textarea
          className="pointer-events-none absolute size-px opacity-0"
          aria-hidden="true"
          tabIndex={-1}
          required
          disabled={disabled}
          value={richTextPlainText(value).trim()}
          onChange={() => {}}
          onInvalid={(event) => {
            event.preventDefault();
            editor?.commands.focus();
          }}
        />
      )}
      {editor && !disabled && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top', offset: 8 }}
          className="z-50 rounded-xl border bg-popover p-1 shadow-lg"
          role="toolbar"
          aria-label="선택한 글 서식"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={state?.highlighted ?? false}
            className={
              state?.highlighted
                ? 'bg-yellow-100 text-yellow-950 hover:bg-yellow-200'
                : ''
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="size-4" aria-hidden="true" />
            {state?.highlighted ? '하이라이트 해제' : '하이라이트'}
          </Button>
        </BubbleMenu>
      )}
    </div>
  );
}
