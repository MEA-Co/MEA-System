import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(
    'app/(private)/dashboard/_views/questions/components/question/QuestionRichTextEditor.tsx',
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree?.props
      ? [tree, ...nodes(tree.props.children)]
      : [];
const componentNames = new Proxy({}, { get: (_, name) => name });

function createHarness() {
  const slots = [];
  let cursor = 0;
  let value = '@';
  let editorFocuses = 0;
  let menuFocuses = 0;
  let deletedRange;
  const editorElement = { area: 'editor' };
  const menuElement = { area: 'menu' };
  const anchor = { contains: (node) => node?.area === 'editor' };
  const popup = { contains: (node) => node?.area === 'menu' };
  const chain = {
    focus() {
      editorFocuses++;
      return chain;
    },
    deleteRange(range) {
      deletedRange = range;
      return chain;
    },
    run() {
      return true;
    },
  };
  const editor = {
    view: { dom: editorElement },
    commands: {
      focus() {
        editorFocuses++;
      },
    },
    chain: () => chain,
  };
  const exports = {};
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next) => {
          slots[index] = next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useId() {
      return `id-${cursor++}`;
    },
    useMemo(factory) {
      return factory();
    },
    useEffect() {},
  };
  const extension = { configure: () => ({}) };
  const dependencies = {
    react,
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    '@base-ui/react/popover': {
      Popover: {
        Root: 'PopoverRoot',
        Portal: 'Portal',
        Positioner: 'Positioner',
        Popup: 'Popup',
      },
    },
    '@tiptap/core': { Extension: { create: (config) => config } },
    '@tiptap/extension-highlight': { default: extension },
    '@tiptap/starter-kit': { default: extension },
    '@tiptap/pm/state': {},
    '@tiptap/react': {
      EditorContent: 'EditorContent',
      useEditor: () => editor,
      useEditorState: () => ({
        command: { from: 1, to: value.length + 1, matched: true },
        studyCommand: { matched: true },
        empty: false,
      }),
    },
    '@tiptap/react/menus': { BubbleMenu: 'BubbleMenu' },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '../../lib/rich-text': {
      toEditorDocument: () => ({}),
      richTextPlainText: (text) => text,
    },
  };
  vm.runInNewContext(source, {
    exports,
    require(name) {
      if (name in dependencies) return dependencies[name];
      if (
        name.startsWith('@/components/') ||
        name.startsWith('./') ||
        name.startsWith('../../lib/') ||
        name === 'lucide-react'
      )
        return componentNames;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function render(nextValue = value) {
    value = nextValue;
    cursor = 0;
    const tree = exports.QuestionRichTextEditor({
      id: 'answer',
      value,
      onChange() {},
    });
    tree.props.ref.current = anchor;
    const trigger = nodes(tree).find((node) => node.type === 'TooltipTrigger');
    const command = nodes(trigger).find((node) => node.type === 'PopoverRoot');
    const menu = nodes(command).find((node) => node.props.role === 'menu');
    menu.props.ref.current = popup;
    const items = nodes(menu).filter((node) => node.props.role === 'menuitem');
    items[0].props.ref.current = {
      focus() {
        menuFocuses++;
      },
    };
    return { tree, trigger, command, menu, items };
  }
  function focus() {
    render().trigger.props.onFocusCapture({ target: { id: 'answer' } });
    return render();
  }
  return {
    render,
    focus,
    anchor,
    editorElement,
    menuElement,
    counts: () => ({ editorFocuses, menuFocuses, deletedRange }),
  };
}

test('command menu escapes the table through a fixed portal without taking typing focus', () => {
  const app = createHarness();
  const view = app.focus();
  assert.equal(view.command.props.open, true);
  const portal = nodes(view.command).find((node) => node.type === 'Portal');
  assert.ok(nodes(portal).includes(view.menu));
  assert.equal(
    nodes(portal).find((node) => node.type === 'Positioner').props
      .positionMethod,
    'fixed',
  );
  assert.equal(view.menu.props.initialFocus, false);
  assert.equal(view.menu.props.finalFocus, false);
});

test('focus can move between the editor and portaled commands; leaving both closes the menu', () => {
  const app = createHarness();
  let view = app.focus();
  view.trigger.props.onBlurCapture({
    currentTarget: app.anchor,
    relatedTarget: app.menuElement,
  });
  view = app.render();
  assert.equal(view.command.props.open, true);
  view.trigger.props.onBlurCapture({
    currentTarget: app.anchor,
    relatedTarget: app.editorElement,
  });
  assert.equal(app.render().command.props.open, true);
  view.trigger.props.onBlurCapture({
    currentTarget: app.anchor,
    relatedTarget: null,
  });
  assert.equal(app.render().command.props.open, false);
});

test('caret clicks stay open, outside clicks dismiss without returning focus, and new input reopens', () => {
  const app = createHarness();
  let view = app.focus();
  let cancelled = false;
  view.command.props.onOpenChange(false, {
    reason: 'outside-press',
    event: { target: app.editorElement },
    cancel() {
      cancelled = true;
    },
  });
  assert.equal(cancelled, true);
  assert.equal(app.render().command.props.open, true);
  view.command.props.onOpenChange(false, {
    reason: 'outside-press',
    event: { target: {} },
    cancel() {
      assert.fail('Outside clicks must dismiss');
    },
  });
  view = app.render();
  assert.equal(view.command.props.open, false);
  assert.equal(app.counts().editorFocuses, 0);
  assert.equal(app.render('@학').command.props.open, true);
});

test('keyboard navigation reaches the portaled menu and selecting study opens its picker', () => {
  const app = createHarness();
  const view = app.focus();
  let prevented = false;
  view.trigger.props.onKeyDownCapture({
    key: 'ArrowDown',
    nativeEvent: {},
    target: app.editorElement,
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {},
  });
  assert.equal(prevented, true);
  assert.equal(app.counts().menuFocuses, 1);
  let nextFocused = false;
  view.items[0].props.onKeyDown({
    key: 'ArrowDown',
    currentTarget: {
      parentElement: {
        querySelectorAll: () => [
          { focus() {} },
          {
            focus() {
              nextFocused = true;
            },
          },
        ],
      },
    },
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(nextFocused, true);
  view.items[1].props.onClick();
  const next = app.render();
  assert.equal(next.command.props.open, false);
  const picker = nodes(next.tree).find((node) => node.type === 'PopoverRoot');
  assert.equal(picker.props.open, true);
  assert.ok(
    nodes(picker).some((node) => node.props['aria-label'] === '학습법 첨부'),
  );
  assert.equal(app.counts().deletedRange.from, 1);
  assert.equal(app.counts().deletedRange.to, 2);
});

test('Escape returns focus to the editor and keeps the current command dismissed', () => {
  const app = createHarness();
  const view = app.focus();
  view.command.props.onOpenChange(false, { reason: 'escape-key', event: {} });
  assert.equal(app.render().command.props.open, false);
  assert.equal(app.counts().editorFocuses, 1);
  assert.equal(app.render().command.props.open, false);
});
