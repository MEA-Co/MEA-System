import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

import {
  mergeGuideResponseRows,
  snapshotRows,
} from '../app/(private)/dashboard/_views/questions/lib/question-responses.ts';

const jsx = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
};
const questionRoot =
  'app/(private)/dashboard/_views/questions/components/question/';
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) =>
        imports[name] ??
        (name === 'react/jsx-runtime'
          ? jsx
          : new Proxy(
              {},
              { get: (_, key) => (key === '__esModule' ? true : String(key)) },
            )),
    },
  );
  return exports;
}
function nodes(node) {
  return Array.isArray(node)
    ? node.flatMap(nodes)
    : node?.props
      ? [node, ...nodes(node.props.children)]
      : [];
}
const document = {
  id: 'registration',
  purpose: 'study_registration',
  title: '학습법을 등록해 주세요',
  prompt: '여러분의 학습법을 먼저 등록해 주세요.',
  fields: [],
  details: [],
  buttonLabel: '나의 학습법 추가',
  rowMode: 'single',
};

test('registration preview never runs answer hooks or forwards answer callbacks', () => {
  const noHooks = new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('Answer hook ran for registration');
      },
    },
  );
  const { QuestionBlockPreview } = load(
    `${questionRoot}QuestionBlockPreview.tsx`,
    { react: noHooks },
  );
  const result = QuestionBlockPreview({
    document,
    onStoredRowsChange() {
      throw new Error('Answer saved');
    },
    onAnsweredRowsChange() {
      throw new Error('Answered row emitted');
    },
  });
  assert.equal(result.type, 'StudyRegistrationCard');
  assert.equal(result.props.document, document);
  assert.equal('onStoredRowsChange' in result.props, false);
  assert.equal('onAnsweredRowsChange' in result.props, false);
});

test('the registration action opens the existing editor for the authenticated owner without an attachment callback', () => {
  const scopes = [];
  const { StudyRegistrationAction } = load(
    `${questionRoot}StudyRegistrationAction.tsx`,
    {
      '@/app/(private)/dashboard/_views/study/hooks/useStudyList': {
        useStudyList: (scope) => {
          scopes.push(scope);
          return { data: { userId: 'owner', activities: [] } };
        },
      },
    },
  );
  const editor = StudyRegistrationAction({ label: document.buttonLabel });
  assert.deepEqual(scopes, ['own']);
  assert.equal(editor.type, 'StudyView');
  assert.equal(editor.props.userId, 'owner');
  assert.equal(editor.props.registrationOnly, true);
  assert.equal(editor.props.registrationLabel, '나의 학습법 추가');
  assert.equal(editor.props.onSelect, undefined);
});

test('read-only cards neither load a study list nor mount a registration editor', () => {
  const { StudyRegistrationCard } = load(
    `${questionRoot}StudyRegistrationCard.tsx`,
    {
      '@/app/(private)/dashboard/_views/study/hooks/useStudyList': {
        useStudyList() {
          throw new Error('Readonly queried studies');
        },
      },
    },
  );
  const card = StudyRegistrationCard({ document, disabled: true });
  assert.equal(
    nodes(card).some((node) => typeof node.type === 'function'),
    false,
  );
  const button = nodes(card).find((node) => node.type === 'Button');
  assert.equal(button.props.disabled, true);
});

test('registration-only StudyView reuses its creation action and hides the management list', () => {
  const calls = [];
  const { StudyView } = load(
    'app/(private)/dashboard/_views/study/StudyView.tsx',
    {
      react: {
        useRef: () => ({ current: null }),
        useState: (initial) => [initial, () => {}],
        useEffect() {},
      },
      './hooks/useStudyStorage': {
        useStudyStorage: (userId) => {
          calls.push(userId);
          return {
            activities: [],
            draft: null,
            ready: true,
            busy: false,
            create: () => calls.push('create'),
          };
        },
      },
    },
  );
  const tree = StudyView({
    userId: 'owner',
    registrationOnly: true,
    registrationLabel: '학습법 작성',
  });
  const button = nodes(tree).find((node) => node.type === 'Button');
  assert.equal(button.props.disabled, false);
  button.props.onClick({ currentTarget: { id: 'opener' } });
  assert.deepEqual(calls, ['owner', 'create']);
  assert.equal(
    nodes(tree).some(
      (node) => node.type === 'DashboardPageCategory' || node.type === 'table',
    ),
    false,
  );
});

test('registration metadata has no answer rows even when merging a cached snapshot', () => {
  const card = {
    responseId: 'card-response',
    questionId: 'registration',
    definition: {
      id: 'registration',
      purpose: 'study_registration',
      fields: [],
    },
    rows: [{ id: 1, answers: { injected: 'not an answer' } }],
  };
  const question = {
    responseId: 'answer-response',
    questionId: 'question',
    definition: {
      id: 'question',
      fields: [{ id: 'answer', kind: 'text' }],
      row_mode: 'single',
    },
    rows: [{ id: 1, answers: { answer: 'real answer' } }],
  };
  const snapshot = { questions: [card, question] };
  assert.deepEqual(snapshotRows(snapshot).registration, []);
  const merged = mergeGuideResponseRows(
    { registration: card.rows, question: question.rows },
    snapshot,
    snapshot,
  );
  assert.deepEqual(merged.registration, []);
  assert.deepEqual(merged.question, question.rows);
});

test('questionnaire start notice renders original content and action without a question number', () => {
  const { QuestionnaireStartNotice } = load(
    'app/(private)/dashboard/_views/questions/components/questionnaire/QuestionnaireStartNotice.tsx',
  );
  const notice = { title: '학습법 등록', body: '원문 안내', buttonLabel: '학습법 추가' };
  const result = QuestionnaireStartNotice({ notice });
  assert.equal(result.type, 'aside');
  assert.equal(result.props['aria-label'], '질문지 시작 안내');
  const content = nodes(result).find((node) => node.type === 'RichTextContent');
  assert.equal(content.props.value, notice.body);
  const action = nodes(result).find((node) => node.type === 'StudyRegistrationAction');
  assert.equal(action.props.label, notice.buttonLabel);
  assert.equal(nodes(result).some((node) => node.type === 'span'), false);
});
