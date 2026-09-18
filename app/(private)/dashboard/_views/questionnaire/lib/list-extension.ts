import { mergeAttributes, Node, wrappingInputRule } from '@tiptap/core';

// Keep the standard list node name so Enter/Tab/Backspace use ListItem's rules.
export const QuestionnaireList = Node.create({
  name: 'bulletList',
  group: 'block list',
  content: 'listItem+',
  addAttributes() {
    return {
      marker: {
        default: 'bullet',
        parseHTML: (element) =>
          element.getAttribute('data-marker') === 'plus' ? 'plus' : 'bullet',
        renderHTML: (attributes) =>
          attributes.marker === 'plus' ? { 'data-marker': 'plus' } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'ul' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () =>
        this.editor.commands.toggleList(this.name, 'listItem'),
    };
  },
  addInputRules() {
    return ['bullet', 'plus'].map((marker) =>
      wrappingInputRule({
        find: marker === 'plus' ? /^\s*\+\s$/ : /^\s*[-*]\s$/,
        type: this.type,
        getAttributes: { marker },
        joinPredicate: (_match, node) => node.attrs.marker === marker,
      }),
    );
  },
});
