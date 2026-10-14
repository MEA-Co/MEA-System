import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const base = 'app/(private)/dashboard/_views/questions/';
const jsx = (type, props) => ({ type, props });
const ui = new Proxy({}, { get: (_, name) => name });
function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(base + path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (name in dependencies) return dependencies[name];
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react')
          return { useState: (initial) => [initial, () => {}] };
        if (name.startsWith('@/components/ui/') || name === 'lucide-react')
          return ui;
        if (name === '@base-ui/react/popover') return { Popover: ui };
        if (
          name === './RichTextContent' ||
          name === './StudyCommands' ||
          name === './CareerFlowExampleTable'
        )
          return ui;
        throw new Error('Unexpected import: ' + name);
      },
    },
  );
  return exports;
}
function nodes(tree) {
  return Array.isArray(tree)
    ? tree.flatMap(nodes)
    : tree?.props
      ? [tree, ...nodes(tree.props.children)]
      : [];
}
function content(tree) {
  return Array.isArray(tree)
    ? tree.map(content).join('')
    : tree?.props
      ? content(tree.props.children)
      : typeof tree === 'string' || typeof tree === 'number'
        ? String(tree)
        : '';
}
const labels = load('lib/submitted-row-label.ts');
const { QuestionAnswerTable } = load(
  'components/question/QuestionAnswerTable.tsx',
  { '../../lib/submitted-row-label': labels },
);
const { QuestionGuideAnswerTable } = load(
  'components/question/QuestionGuideAnswerTable.tsx',
  {
    '../../lib/question-types': {
      scaleAnswer: () => ({}),
      choiceAnswerValue: () => ({}),
    },
  },
);
const document = {
  title: '진로 흐름',
  rowLabels: ['첫 항목', '둘째 항목', '셋째 항목'],
  fields: [{ id: 'field', label: '고1-1', kind: 'text' }],
};
const rows = [
  { id: 500, label: '첫 항목', answers: { field: '첫 답변' } },
  { id: -17, label: '셋째 항목', answers: { field: '셋째 답변' } },
];
function table(answerRows, disabled = true) {
  return QuestionAnswerTable({
    document,
    rows: answerRows,
    waiting: false,
    disabled,
    summary: (_, value) => value,
    renderField: () => null,
    canAdd: true,
    canRemove: true,
    onAdd: () => {},
    onRemove: () => {},
  });
}
test('duplicate guide labels preserve each ID and answer, including labels outside the definition', () => {
  const answer = {
    rows: rows.map((row, index) => ({
      ...row,
      label: index < 2 ? '같은 이름' : '추가 이름',
    })),
  };
  answer.rows.push({
    id: 999,
    label: '추가 이름',
    answers: { field: '추가 답변' },
  });
  const tree = QuestionGuideAnswerTable({
    document,
    answer,
    summary: (_, value) => value,
  });
  assert.deepEqual(
    nodes(tree)
      .filter((node) => node.type === 'RichTextContent')
      .map((node) => node.props.value),
    ['첫 답변', '셋째 답변', '추가 답변'],
  );
  assert.deepEqual(
    nodes(tree)
      .filter((node) => node.type === 'th' && node.props.scope === 'row')
      .map(content),
    ['같은 이름', '같은 이름', '추가 이름'],
  );
});
test('submitted career popup uses saved names without inferring ordinal from IDs', () => {
  assert.deepEqual(
    nodes(table(rows))
      .filter((node) => node.type === 'th' && node.props.scope === 'row')
      .map(content),
    ['첫 항목', '셋째 항목'],
  );
});
test('compressed legacy rows without metadata never receive an invented configured name', () => {
  const legacy = rows.map(({ label: _label, ...row }) => row);
  assert.deepEqual(
    nodes(table(legacy))
      .filter((node) => node.type === 'th' && node.props.scope === 'row')
      .map(content),
    ['항목 1 · 원래 이름 미확인', '항목 2 · 원래 이름 미확인'],
  );
});
test('intact legacy rows retain positional labels and unnamed rows keep ordinal fallback', () => {
  assert.equal(
    labels.submittedRowLabel({ id: -200 }, 2, 3, document.rowLabels),
    '셋째 항목',
  );
  assert.equal(labels.submittedRowLabel({ id: 999 }, 1, 2), '항목 2');
});
test('read-only career popup hides write and delete controls', () => {
  const tree = table(rows);
  assert.ok(
    !nodes(tree).some((node) => node.props['aria-label']?.endsWith('삭제')),
  );
  assert.ok(!content(tree).includes('항목 추가'));
  assert.ok(!content(tree).includes('@탐구활동'));
});
