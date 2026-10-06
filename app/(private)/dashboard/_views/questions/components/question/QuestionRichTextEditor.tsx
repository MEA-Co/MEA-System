'use client';

import { Popover } from '@base-ui/react/popover';
import { Extension } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { Plugin } from '@tiptap/pm/state';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Highlighter, NotebookPen, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  explorationCommand,
  ExplorationReference,
} from '../../lib/exploration-reference';
import { QuestionList } from '../../lib/list-extension';
import {
  richTextPlainText,
  serializeRichText,
  showRichTextPlaceholder,
  toEditorDocument,
} from '../../lib/rich-text';

import { ExplorationPicker } from './ExplorationCommands';
import { richTextClasses } from './RichTextContent';

function bubbleMenuContainer() {
  return document.body;
}

export function QuestionRichTextEditor({
  id,
  value,
  onChange,
  placeholder = '내용을 작성하세요',
  placeholderTone = 'default',
  disabled = false,
  required = false,
  maxLength = 20000,
  compact = false,
  className,
  ariaLabel,
  ariaLabelledBy,
  explorationRecommended = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  placeholderTone?: 'default' | 'example';
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  explorationRecommended?: boolean;
}) {
  const editorAnchor = useRef<HTMLDivElement>(null);
  const [activityEditorOpen, setActivityEditorOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dismissedCommand, setDismissedCommand] = useState<string | null>(null);
  const hintPopup = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const triggerId = useId();
  const [hintOpen, setHintOpen] = useState(false);
  const showHint =
    explorationRecommended &&
    !disabled &&
    hintOpen &&
    !hintDismissed &&
    !pickerOpen;
  const lengthLimit = useMemo(
    () =>
      Extension.create({
        name: 'questionLengthLimit',
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
        bulletList: false,
        link: false,
        trailingNode: false,
      }),
      Highlight.configure({ multicolor: false }),
      QuestionList,
      ExplorationReference,
      lengthLimit,
    ],
    content: toEditorDocument(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabelledBy
          ? { 'aria-labelledby': ariaLabelledBy }
          : { 'aria-label': ariaLabel ?? placeholder }),
        'aria-required': String(required),
        ...(showHint ? { 'aria-describedby': hintId } : {}),
        class: cn(
          richTextClasses,
          'px-3 py-2 text-base md:text-sm outline-none',
          compact ? 'min-h-9' : 'min-h-24',
        ),
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(serializeRichText(current.getJSON())),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      empty: current
        ? showRichTextPlaceholder(current.isEmpty, current.state.doc)
        : !value,
      highlighted: current?.isActive('highlight') ?? false,
      command: current ? explorationCommand(current) : null,
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

  const commandKey = state?.command
    ? `${state.command.from}:${state.command.to}:${value}`
    : null;
  const commandOpen =
    !disabled &&
    focusWithin &&
    !pickerOpen &&
    !!state?.command &&
    commandKey !== dismissedCommand;
  function openPicker() {
    if (!editor || !state?.command?.matched) return;
    editor.chain().focus().deleteRange(state.command).run();
    setHintOpen(false);
    setPickerOpen(true);
  }

  return (
    <div
      ref={editorAnchor}
      className={cn(
        'relative min-w-0 rounded-lg border-0 bg-neutral-100 shadow-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-neutral-500 dark:bg-neutral-800',
        explorationRecommended && !disabled && 'focus-within:outline-blue-500',
        disabled && 'opacity-50',
        className,
      )}
    >
      <Popover.Root
        open={pickerOpen && !disabled}
        onOpenChange={(open) => {
          if (!activityEditorOpen) setPickerOpen(open);
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={editorAnchor}
            side="top"
            align="start"
            sideOffset={8}
            positionMethod="fixed"
            className={activityEditorOpen ? 'z-40' : 'z-60'}
          >
            <Popover.Popup
              aria-label="탐구활동 첨부"
              finalFocus={() => editor?.view.dom ?? false}
              className="max-h-[min(28rem,var(--available-height))] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
            >
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="icon-sm"
                  aria-label="탐구활동 목록 닫기"
                  variant="ghost"
                  onClick={() => {
                    setPickerOpen(false);
                    editor?.commands.focus();
                  }}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <ExplorationPicker
                onEditorOpenChange={setActivityEditorOpen}
                onSelect={(activityId, title) => {
                  if (!editor || !editor.isEditable) return;
                  const before = editor.state.doc;
                  const inserted = editor
                    .chain()
                    .focus()
                    .insertContent([
                      {
                        type: 'text',
                        text: `@${title}`,
                        marks: [
                          {
                            type: 'explorationReference',
                            attrs: { id: activityId },
                          },
                        ],
                      },
                      { type: 'text', text: ' ', marks: [] },
                    ])
                    .run();
                  if (inserted && !editor.state.doc.eq(before))
                    setPickerOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Tooltip
        open={showHint}
        triggerId={triggerId}
        onOpenChange={(_, details) => {
          if (details.reason === 'escape-key') setHintOpen(false);
        }}
      >
        <TooltipTrigger
          id={triggerId}
          render={<div />}
          tabIndex={-1}
          closeOnClick={false}
          onFocusCapture={(event) => {
            setFocusWithin(true);
            if (event.target.id === id) setHintOpen(true);
          }}
          onKeyDownCapture={(event) => {
            if (!commandOpen || event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setDismissedCommand(commandKey);
              editor?.commands.focus();
            }
            if (!state?.command?.matched) return;
            if (
              event.key === 'Enter' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowUp'
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (event.key === 'Enter') openPicker();
              else menuButton.current?.focus();
            }
          }}
          onBlurCapture={(event) => {
            if (!hintPopup.current?.contains(event.relatedTarget))
              setHintOpen(false);
            if (!event.currentTarget.contains(event.relatedTarget))
              setFocusWithin(false);
          }}
          className="relative min-w-0"
        >
          {commandOpen && (
            <div
              role="menu"
              aria-label="사용 가능한 명령어"
              className="absolute bottom-full left-0 z-40 mb-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-1 shadow-lg"
            >
              {state?.command?.matched ? (
                <Button
                  type="button"
                  ref={menuButton}
                  role="menuitem"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 px-3 py-2 text-left"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openPicker}
                >
                  <NotebookPen
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="shrink-0 font-medium">탐구활동</span>
                  <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                    신규 탐구활동을 추가하거나, 작성한 탐구활동을 첨부해요
                  </span>
                </Button>
              ) : (
                <p
                  role="status"
                  className="px-3 py-2 text-sm text-muted-foreground"
                >
                  검색 결과 없음
                </p>
              )}
            </div>
          )}
          {placeholderTone === 'example' ? (
            <div className="grid">
              {state?.empty && (
                <span
                  className="pointer-events-none col-start-1 row-start-1 px-3 py-2 text-sm whitespace-pre-wrap text-blue-400 wrap-anywhere dark:text-blue-300"
                  aria-hidden="true"
                >
                  {placeholder}
                </span>
              )}
              <EditorContent
                editor={editor}
                className="relative col-start-1 row-start-1 min-w-0 [&_.tiptap]:h-full"
              />
            </div>
          ) : (
            <>
              {state?.empty && (
                <span
                  className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  {placeholder}
                </span>
              )}
              <EditorContent editor={editor} />
            </>
          )}
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
              appendTo={bubbleMenuContainer}
              options={{ placement: 'top', offset: 8, strategy: 'fixed' }}
              className="z-60 rounded-xl border bg-popover p-1 shadow-lg"
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
        </TooltipTrigger>
        {explorationRecommended && (
          <TooltipContent
            ref={hintPopup}
            id={hintId}
            side="top"
            align="end"
            sideOffset={8}
            className="relative block max-w-[min(24rem,calc(100vw-2rem))] bg-blue-600 pr-9 text-white"
          >
            <button
              type="button"
              aria-label="탐구활동 참조 안내 닫기"
              className="absolute right-1 top-1 rounded p-1 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                setHintDismissed(true);
                setHintOpen(false);
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            <p className="font-semibold">탐구활동 참조가 필요한 질문입니다.</p>
            <p>
              &apos;@탐구활동&apos; 을 입력하여 탐구활동을 언급하며
              답변해주세요!
            </p>
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
}
