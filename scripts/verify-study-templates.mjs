import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const base = 'app/(private)/dashboard/_views/study/';
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(base + path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (id) => (id === 'react/jsx-runtime' ? require(id) : imports[id]),
    },
  );
  return exports;
}
const fields = load('lib/fields.ts');
const templates = load('lib/problem-templates.ts');
const { StudyFields } = load('components/StudyFields.tsx', {
  '../lib/fields': fields,
  '../lib/problem-templates': templates,
  '@/components/ui/input': { Input: 'input' },
  '@/components/ui/label': { Label: 'label' },
  '@/components/ui/textarea': { Textarea: 'textarea' },
  '@/components/ui/select': Object.fromEntries(
    [
      'Select',
      'SelectContent',
      'SelectItem',
      'SelectTrigger',
      'SelectValue',
    ].map((name) => [name, name]),
  ),
  './StudyRequiredMark': { StudyRequiredMark: 'required' },
});
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function render(values, onChange) {
  return nodes(StudyFields({ values, onChange }));
}
function picker(tree) {
  return tree.find(
    (node) => node.type === 'Select' && node.props.value === null,
  );
}

test('16개 템플릿 본문이 제목 대신 입력되고 다른 필드는 보존된다', () => {
  const values = {
    ...fields.emptyValues(),
    category: '내신',
    subject: '수학',
    problemSource: 'template',
    problem: '기존 문제',
    strategy: '기존 전략',
  };
  let next;
  const tree = render(values, (v) => {
    next = v;
  });
  assert.equal(templates.problemTemplates.length, 16);
  assert.equal(new Set(templates.problemTemplates).size, 16);
  for (const text of templates.problemTemplates) {
    picker(tree).props.onValueChange(text);
    assert.equal(next.problem, text);
    assert.equal(next.problemSource, 'template');
    assert.equal(next.strategy, values.strategy);
  }
  const input = render(next, (v) => {
    next = v;
  }).find((n) => n.type === 'textarea' && n.props.name === 'problem');
  input.props.onChange({ target: { value: '내 상황에 맞게 수정한 문장' } });
  assert.equal(next.problem, '내 상황에 맞게 수정한 문장');
});

test('출처 전환은 문제 본문을 유지하고 템플릿에서만 선택기를 표시한다', () => {
  const values = {
    ...fields.emptyValues(),
    category: '내신',
    subject: '수학',
    problemSource: 'template',
    problem: '직접 수정한 내용',
  };
  let next;
  const tree = render(values, (v) => {
    next = v;
  });
  tree
    .find((n) => n.type === 'Select' && n.props.value === 'template')
    .props.onValueChange('self');
  assert.equal(next.problem, values.problem);
  assert.equal(next.problemSource, 'self');
  assert.equal(picker(render(next, () => {})), undefined);
  picker(tree).props.onValueChange(null);
  assert.equal(next.problem, values.problem);
});
