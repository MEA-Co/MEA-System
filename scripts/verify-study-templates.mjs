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
let hookFrame;
const { StudyFields } = load('components/StudyFields.tsx', {
  react: {
    useState(initial) {
      const { states } = hookFrame;
      const index = hookFrame.index++;
      if (!(index in states)) {
        states[index] = typeof initial === 'function' ? initial() : initial;
      }
      return [
        states[index],
        (next) => {
          states[index] =
            typeof next === 'function' ? next(states[index]) : next;
        },
      ];
    },
  },
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
function createRenderer() {
  const states = [];
  return (values, onChange) => {
    hookFrame = { states, index: 0 };
    try {
      return nodes(StudyFields({ values, onChange }));
    } finally {
      hookFrame = undefined;
    }
  };
}
function render(values, onChange) {
  return createRenderer()(values, onChange);
}
function picker(tree) {
  return tree.find(
    (node) =>
      node.type === 'Select' &&
      nodes(node).some(
        (child) =>
          child.type === 'SelectTrigger' &&
          child.props.id === 'study-problem-template',
      ),
  );
}
function pickerLabel(tree) {
  return nodes(picker(tree)).find((node) => node.type === 'SelectValue').props
    .children;
}

test('56개 템플릿은 문제와 분류를 함께 채우고 솔루션을 보존한다', () => {
  const values = {
    ...fields.emptyValues(),
    category: '내신',
    subject: '수학',
    problemSource: 'template',
    problem: '기존 문제',
    strategy: '기존 전략',
    practiceGuide: '기존 실천 가이드',
    checklist: '기존 기준',
    followup: '기존 후속 대응',
    problemExperience: '기존 경험',
  };
  let next;
  const draw = createRenderer();
  const tree = draw(values, (v) => {
    next = v;
  });
  assert.equal(templates.problemTemplates.length, 56);
  assert.equal(
    new Set(templates.problemTemplates.map((item) => item.id)).size,
    56,
  );
  for (const template of templates.problemTemplates) {
    picker(tree).props.onValueChange(template.id);
    assert.equal(next.problem, template.problem);
    assert.equal(next.category, template.category);
    assert.equal(next.subject, template.subject);
    assert.equal(next.customSubject, template.customSubject);
    assert.equal(next.problemSource, 'template');
    assert.deepEqual(
      structuredClone(next),
      structuredClone({
        ...values,
        problem: template.problem,
        category: template.category,
        subject: template.subject,
        customSubject: template.customSubject,
      }),
    );
    const selectedTree = draw(next, () => {});
    assert.equal(picker(selectedTree).props.value, template.id);
    assert.equal(pickerLabel(selectedTree), template.problem);
  }
  const input = draw(next, (v) => {
    next = v;
  }).find((n) => n.type === 'input' && n.props.name === 'problem');
  input.props.onChange({ target: { value: '내 상황에 맞게 수정한 문장' } });
  assert.equal(next.problem, '내 상황에 맞게 수정한 문장');
  const editedTree = draw(next, () => {});
  const lastTemplate = templates.problemTemplates.at(-1);
  assert.equal(picker(editedTree).props.value, lastTemplate.id);
  assert.equal(pickerLabel(editedTree), lastTemplate.problem);
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
test('저장한 템플릿 문제 상황을 다시 열어도 선택 문구를 표시한다', () => {
  for (const template of templates.problemTemplates) {
    const { id, ...templateValues } = template;
    const saved = storage.valuesSchema.parse({
      ...fields.emptyValues(),
      ...templateValues,
      problemSource: 'template',
    });
    const tree = render(saved, () => {});
    assert.equal(picker(tree).props.value, id);
    assert.equal(pickerLabel(tree), template.problem);
  }
});
test('분류를 직접 바꿔도 같은 문제 상황의 템플릿 선택은 유지한다', () => {
  const template = templates.problemTemplates[0];
  const values = {
    ...fields.emptyValues(),
    problemSource: 'template',
    problem: template.problem,
    category: '내신',
    subject: '기타',
    customSubject: '직접 수정한 과목명',
  };
  const tree = render(values, () => {});
  assert.equal(picker(tree).props.value, template.id);
  assert.equal(pickerLabel(tree), template.problem);
});
test('새 블록은 선택이 남지 않고 수정한 저장 본문은 등록된 상황으로 표시한다', () => {
  const template = templates.problemTemplates[0];
  const values = {
    ...fields.emptyValues(),
    problemSource: 'template',
    problem: template.problem,
  };
  const existing = createRenderer();
  assert.equal(picker(existing(values, () => {})).props.value, template.id);
  const edited = { ...values, problem: '내 상황에 맞게 수정한 문제' };
  const editedTree = existing(edited, () => {});
  assert.equal(picker(editedTree).props.value, template.id);
  assert.equal(pickerLabel(editedTree), template.problem);

  const reopened = render(storage.valuesSchema.parse(edited), () => {});
  assert.equal(picker(reopened).props.value, null);
  assert.equal(pickerLabel(reopened), '등록한 문제 상황');
  const newBlock = render(
    { ...fields.emptyValues(), problemSource: 'template' },
    () => {},
  );
  assert.equal(picker(newBlock).props.value, null);
  assert.equal(pickerLabel(newBlock), undefined);
});
test('빈 문제는 선택 안내를 표시하고 무효 선택은 입력을 바꾸지 않는다', () => {
  let changes = 0;
  const values = { ...fields.emptyValues(), problemSource: 'template' };
  const tree = render(values, () => {
    changes += 1;
  });
  assert.equal(picker(tree).props.value, null);
  assert.equal(pickerLabel(tree), undefined);
  picker(tree).props.onValueChange('unknown-template');
  picker(tree).props.onValueChange(null);
  assert.equal(changes, 0);
  assert.equal(values.problem, '');
});
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
    (item) => item.id === 'week2-english-09',
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

test('교과군별 10·10·10·8·8·10개와 문구 중복을 확인한다', () => {
  const expected = { 국어: 10, 영어: 10, 수학: 10, 사회: 8, 과학: 8, 기타: 10 };
  for (const [subject, count] of Object.entries(expected)) {
    assert.equal(
      templates.problemTemplates.filter((item) => item.subject === subject)
        .length,
      count,
    );
  }
  assert.equal(
    new Set(templates.problemTemplates.map((item) => item.problem)).size,
    56,
  );
  for (const template of templates.problemTemplates) {
    assert.ok(fields.subjectOptions.includes(template.subject));
    assert.ok(fields.categoryOptions.includes(template.category));
  }
});

test('교체 전 저장한 문제는 원문과 분류를 유지하며 새 템플릿으로 치환하지 않는다', () => {
  const saved = storage.valuesSchema.parse({
    ...fields.emptyValues(),
    problemSource: 'template',
    problem: '기하 독학 시 방학 중 예습 범위와 문제 난이도 설정에 어려움',
    category: '내신',
    subject: '수학',
    customSubject: '기하',
    strategy: '기존 전략',
  });
  const before = structuredClone(saved);
  let changes = 0;
  const tree = render(saved, () => {
    changes += 1;
  });
  assert.equal(picker(tree).props.value, null);
  assert.equal(pickerLabel(tree), '등록한 문제 상황');
  assert.deepEqual(structuredClone(saved), before);
  assert.equal(changes, 0);
});
