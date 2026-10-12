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

test('20개 템플릿은 문제와 분류를 함께 채우고 솔루션을 보존한다', () => {
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
  assert.equal(templates.problemTemplates.length, 20);
  assert.equal(
    new Set(templates.problemTemplates.map((item) => item.id)).size,
    20,
  );
  for (const template of templates.problemTemplates) {
    picker(tree).props.onValueChange(template.id);
    assert.equal(next.problem, template.problem);
    assert.equal(next.category, template.category);
    assert.equal(next.subject, template.subject);
    assert.equal(next.customSubject, template.customSubject);
    assert.equal(next.problemSource, 'template');
    assert.equal(next.strategy, values.strategy);
  }
  const input = render(next, (v) => {
    next = v;
  }).find((n) => n.type === 'input' && n.props.name === 'problem');
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

const storage = load('lib/storage-model.ts', { zod: require('zod') });
test('기존 데이터와 임시저장 형식을 보존하며 새 필드를 기본값으로 읽는다', () => {
  const legacy = {
    ...fields.emptyValues(),
    problemSource: 'student',
    checklist: '기존 첫 줄\n기존 둘째 줄',
    resultDiagnosis: '이전 진단',
  };
  delete legacy.periodEnabled;
  delete legacy.problemExperience;
  const value = storage.valuesSchema.parse(legacy);
  assert.equal(value.periodEnabled, true);
  assert.equal(value.problemExperience, '');
  assert.equal(value.problemSource, 'self');
  assert.equal(value.checklist, legacy.checklist);
  assert.equal(value.resultDiagnosis, legacy.resultDiagnosis);
});
test('기간 미설정은 빈 기간을 허용하고 설정 시에는 필수로 검사한다', () => {
  const value = { ...fields.emptyValues(), periodEnabled: false };
  assert.equal(
    storage.missingFields(value).some(([key]) => key === 'practicePeriod'),
    false,
  );
  assert.equal(
    storage
      .missingFields({ ...value, periodEnabled: true })
      .some(([key]) => key === 'practicePeriod'),
    true,
  );
  assert.equal(
    storage.valuesSchema.safeParse({ ...value, periodEnabled: 'false' })
      .success,
    false,
  );
});
test('체크리스트 추가·수정·삭제와 경험 입력이 기존 본문을 보존한다', () => {
  let value = {
    ...fields.emptyValues(),
    checklist: '기존 기준',
    problem: '기존 문제',
  };
  const draw = () =>
    render(value, (next) => {
      value = next;
    });
  draw()
    .find((n) => n.type === 'button' && n.props.children === '+ 항목 추가')
    .props.onClick();
  assert.equal(value.checklist, '기존 기준\n');
  draw()
    .find(
      (n) =>
        n.type === 'input' && n.props['aria-label'] === '체크리스트 항목 2',
    )
    .props.onChange({ target: { value: '새 기준' } });
  assert.equal(value.checklist, '기존 기준\n새 기준');
  draw()
    .find(
      (n) =>
        n.type === 'button' &&
        n.props['aria-label'] === '체크리스트 항목 1 삭제',
    )
    .props.onClick();
  assert.equal(value.checklist, '새 기준');
  draw()
    .find(
      (n) => n.type === 'textarea' && n.props.id === 'study-problem-experience',
    )
    .props.onChange({ target: { value: '경험 내용' } });
  assert.equal(value.problemExperience, '경험 내용');
  assert.equal(value.problem, '기존 문제');
});
test('제외 요청한 두 템플릿은 노출하지 않는다', () => {
  assert.equal(
    templates.problemTemplates
      .map((item) => item.problem)
      .includes('고3 진학 후 국어 성적이 1등급에서 2~3등급으로 하락'),
    false,
  );
  assert.equal(
    templates.problemTemplates
      .map((item) => item.problem)
      .includes('국어 내신 시험 범위에 해당하는 문제집·연습 자료 부족'),
    false,
  );
});

test('템플릿을 바꾸면 이전 세부 과목명이 남지 않는다', () => {
  let value = {
    ...fields.emptyValues(),
    problemSource: 'template',
    category: '내신',
    subject: '수학',
    customSubject: '기하',
  };
  const template = templates.problemTemplates.find(
    (item) => item.id === 'qa-09',
  );
  picker(
    render(value, (next) => {
      value = next;
    }),
  ).props.onValueChange(template.id);
  assert.equal(value.subject, '영어');
  assert.equal(value.category, '내신');
  assert.equal(value.customSubject, '');
});

test('과목 공통 템플릿 4개는 제외한다', () => {
  assert.equal(
    templates.problemTemplates.some((item) =>
      ['qa-21', 'qa-22', 'qa-23', 'qa-24'].includes(item.id),
    ),
    false,
  );
});
