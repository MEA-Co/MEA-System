import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const base = 'app/(private)/dashboard/_views/questions/';
const jsx = (type, props) => ({ type, props });
const stubs = new Proxy({}, { get: (_, name) => name });
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(base + file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (dependencies[name]) return dependencies[name];
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react') return { useState: (value) => [value, () => {}] };
        return stubs;
      },
    },
  );
  return exports;
}
const types = load('lib/question-types.ts');
const { QuestionTypeEditor } = load(
  'components/question/QuestionTypeEditor.tsx',
  { '../../lib/question-types': types },
);
function nodes(tree) {
  return Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree?.props
      ? [tree, ...nodes(tree.props.children)]
      : [];
}
function editor(kind, onChange = () => {}) {
  return nodes(
    QuestionTypeEditor({
      question: { id: 'test', kind },
      part: 'header',
      disabled: false,
      onChange,
    }),
  );
}
test('new field menu offers only the four supported answer kinds', () => {
  assert.deepEqual(
    editor('text')
      .filter((node) => node.type === 'SelectItem')
      .map((node) => node.props.value),
    ['text', 'scale', 'single', 'multiple'],
  );
});
test('type change rejects stale attachment options while allowing text', () => {
  const changes = [];
  const select = editor('text', (value) => changes.push(value)).find(
    (node) => node.type === 'Select',
  );
  select.props.onValueChange('study');
  assert.equal(changes.length, 0);
  select.props.onValueChange('text');
  assert.equal(changes[0].kind, 'text');
});
