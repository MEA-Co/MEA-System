import { type Editor, getMarkRange, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

import { isExplorationId } from './rich-text';

export const ExplorationReference = Mark.create({
  name: 'explorationReference',
  inclusive: false,
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        deleteExplorationReference(
          this.editor.state,
          this.editor.view.dispatch,
          'backward',
        ),
      Delete: () =>
        deleteExplorationReference(
          this.editor.state,
          this.editor.view.dispatch,
          'forward',
        ),
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            beforeinput(view, event) {
              if (!(event instanceof InputEvent) || event.isComposing)
                return false;
              const direction =
                event.inputType === 'deleteContentBackward'
                  ? 'backward'
                  : event.inputType === 'deleteContentForward'
                    ? 'forward'
                    : null;
              if (
                !direction ||
                !deleteExplorationReference(
                  view.state,
                  view.dispatch,
                  direction,
                )
              )
                return false;
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-exploration-id'),
        renderHTML: (attrs) => ({ 'data-exploration-id': attrs.id }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-exploration-id]',
        getAttrs: (element) =>
          isExplorationId(element.getAttribute('data-exploration-id'))
            ? {}
            : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class:
          'cursor-pointer rounded bg-blue-100 px-1 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
      }),
      0,
    ];
  },
});

export function explorationCommand(editor: Editor) {
  const { $from, empty } = editor.state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(
    0,
    $from.parentOffset,
    '\n',
    '\ufffc',
  );
  const match = /(?:^|\s)@([^\s@]*)$/.exec(before);
  if (!match) return null;
  return {
    from: $from.pos - match[1].length - 1,
    to: $from.pos,
    matched: '탐구활동'.startsWith(match[1]),
  };
}

/** Expand deletion to the full reference, including portions split by highlighting. */
export function deleteExplorationReference(
  state: Editor['state'],
  dispatch: (transaction: Editor['state']['tr']) => void,
  direction: 'backward' | 'forward',
): boolean {
  const { from, to, empty } = state.selection;
  const start =
    empty && direction === 'backward' ? Math.max(0, from - 1) : from;
  const end =
    empty && direction === 'forward'
      ? Math.min(state.doc.content.size, to + 1)
      : to;
  let range: { from: number; to: number } | null = null;
  state.doc.nodesBetween(start, end, (node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find(
      (item) => item.type.name === 'explorationReference',
    );
    if (!mark) return;
    const reference = getMarkRange(
      state.doc.resolve(pos),
      mark.type,
      mark.attrs,
    );
    if (!reference) return;
    range = {
      from: Math.min(
        range?.from ?? (empty ? reference.from : from),
        reference.from,
      ),
      to: Math.max(range?.to ?? (empty ? reference.to : to), reference.to),
    };
  });
  if (!range) return false;
  const { from: deleteFrom, to: deleteTo } = range as {
    from: number;
    to: number;
  };
  dispatch(
    state.tr
      .delete(deleteFrom, deleteTo)
      .setStoredMarks(
        (state.storedMarks ?? state.selection.$from.marks()).filter(
          (mark) => mark.type.name !== 'explorationReference',
        ),
      ),
  );
  return true;
}
