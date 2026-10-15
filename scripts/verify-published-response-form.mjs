import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

import { loadQuestionModule } from './helpers/load-question-module.mjs';

const responseHelpers = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/questions/lib/question-responses.ts',
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: responseHelpers },
);

function mount(published = true, empty = false, registration = false) {
  const calls = [];
  const state = [];
  let effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state))
        state[index] = typeof initial === 'function' ? initial() : initial;
      return [
        state[index],
        (value) => {
          state[index] =
            typeof value === 'function' ? value(state[index]) : value;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      return (state[index] ??= { current: initial });
    },
    useEffect(fn, dependencies) {
      if (!dependencies) effects.push(fn);
    },
    useCallback(fn) {
      return fn;
    },
    useEffectEvent(fn) {
      return fn;
    },
  };
  const initial = {
    id: randomUUID(),
    revision: 2,
    status: 'submitted',
    submittedAt: '2026-10-02T00:00:00Z',
    savedAt: '2026-10-02T00:00:00Z',
    definitionToken: 'a'.repeat(32),
    title: '질문지',
    sections: [],
    sourceDeleted: false,
    questions: [
      {
        questionId: 'q',
        responseId: 'r',
        definition: {
          id: 'q',
          row_mode: 'single',
          fields: [{ id: 'f', label: '답변', kind: 'text' }],
        },
        rows: [{ id: 1, answers: { f: 'submitted' } }],
      },
    ],
  };
  if (empty) {
    initial.questions[0].rows = [];
    initial.revision = 0;
    initial.savedAt = null;
    initial.submittedAt = null;
  }
  if (registration) {
    const card = {
      questionId: 'registration',
      responseId: 'registration-response',
      definition: {
        id: 'registration',
        purpose: 'study_registration',
        fields: [],
      },
      rows: [],
    };
    if (registration === 'mixed') initial.questions.push(card);
    else initial.questions = [card];
  }
  const imports = {
    react,
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    swr: { useSWRConfig: () => ({ mutate: async () => {} }) },
    '@/components/ui/button': { Button: 'Button' },
    '../../lib/responses/submission-navigation': { focusResponseQuestion() {} },
    '@/components/ui/toast': { toast: { add() {} } },
    '../../lib/career-flow-placeholders': {
      CAREER_FLOW_QUESTION_ID: '5f6064ad-1dd6-4e0d-95dd-611ccacbce92',
    },
    '../../lib/rich-text': { richTextPlainText: (value) => value },
    '../../lib/question-responses': {
      hasIncompatibleFlowDraft: responseHelpers.hasIncompatibleFlowDraft,
      snapshotRows: (s) =>
        Object.fromEntries(s.questions.map((q) => [q.definition.id, q.rows])),
      mergeGuideResponseRows: responseHelpers.mergeGuideResponseRows,
    },
    '../../lib/questionnaire/api-client': {
      QUESTIONNAIRE_API: '/api/questionnaires',
      QuestionnaireApiError: class extends Error {},
    },
    './QuestionnaireLoading': { QuestionnaireLoading: 'Loading' },
    './QuestionnairePreview': { QuestionnairePreview: 'Preview' },
  };
  const exports = {};
  const source = readFileSync(
    'app/(private)/dashboard/_views/questions/components/questionnaire/QuestionResponseForm.tsx',
    'utf8',
  ).replace('function ResponseEditor(', 'export function ResponseEditor(');
  const globals = {
    crypto: { randomUUID },
    structuredClone,
    setInterval,
    clearInterval,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      return {
        ok: true,
        json: async () => ({
          ...initial,
          revision: 3,
          questions: initial.questions.map((q) => ({
            ...q,
            rows: body.answers[q.definition.id],
          })),
        }),
      };
    },
  };
  imports['../../hooks/responses/useQuestionResponseEditor'] =
    loadQuestionModule(
      'app/(private)/dashboard/_views/questions/hooks/responses/useQuestionResponseEditor.ts',
      globals,
      (name) =>
        name.endsWith('/rich-text')
          ? { richTextPlainText: (value) => value }
          : name.endsWith('/questionnaire/api-client')
            ? imports['../../lib/questionnaire/api-client']
            : imports[name],
    );
  imports['../../lib/responses/api-client'] = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      crypto: { randomUUID },
      structuredClone,
      setInterval,
      clearInterval,
      fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        calls.push({ url, body });
        return {
          ok: true,
          json: async () => ({
            ...initial,
            revision: 3,
            questions: initial.questions.map((q) => ({
              ...q,
              rows: body.answers[q.definition.id],
            })),
          }),
        };
      },
    },
  );
  const render = () => {
    cursor = 0;
    effects = [];
    const tree = exports.ResponseEditor({
      questionnaireId: 'questionnaire',
      initial,
      published,
    });
    effects.forEach((fn) => fn());
    return tree;
  };
  const nodes = (node) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node?.props
        ? [node, ...nodes(node.props.children)]
        : [];
  return {
    initial,
    calls,
    render,
    applyRemote: (next) =>
      state.find((item) => typeof item?.current === 'function').current(next),
    find: (tree, type) => nodes(tree).filter((node) => node.type === type),
  };
}

test('a submitted publication remains editable and has separate save and submit actions', async () => {
  const view = mount();
  let tree = view.render();
  let preview = view.find(tree, 'Preview')[0];
  assert.equal(preview.props.response.disabled, false);
  assert.equal(preview.props.showPrivateDetails, false);
  assert.equal(preview.props.reviewQuestionnaireId, undefined);
  preview.props.response.onChange('q', [
    { id: 1, answers: { f: 'private edit' } },
  ]);
  tree = view.render();
  const save = view
    .find(tree, 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, false);
  save.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    view.calls[0].url,
    '/api/questionnaires/questionnaire/published-responses',
  );
  assert.equal(view.calls[0].body.complete, false);
  tree = view.render();
  const submit = view
    .find(tree, 'Button')
    .find((node) => node.props.children === '제출');
  submit.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.calls[1].body.complete, true);
  assert.equal(
    view.find(view.render(), 'Preview')[0].props.response.disabled,
    false,
  );
});

test('guide editing keeps its existing save-only flow', () => {
  const view = mount(false);
  const tree = view.render();
  assert.deepEqual(
    view.find(tree, 'Button').map((node) => node.props.children),
    ['저장'],
  );
  assert.equal(view.find(tree, 'Preview')[0].props.showPrivateDetails, true);
});

test('initializing a blank field does not enable save or mark the response dirty', () => {
  const view = mount(true, true);
  const preview = view.find(view.render(), 'Preview')[0];
  preview.props.response.onChange('q', [{ id: 1, answers: { f: '' } }]);
  const save = view
    .find(view.render(), 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, true);
  assert.equal(view.calls.length, 0);
});

test('registration-only questionnaires have no answer save or submit controls', () => {
  const view = mount(true, true, true);
  const preview = view.find(view.render(), 'Preview')[0];
  assert.equal(preview.props.library[0].purpose, 'study_registration');
  preview.props.response.onChange('registration', [
    { id: 1, answers: { injected: 'ignored' } },
  ]);
  assert.equal(view.find(view.render(), 'Button').length, 0);
  assert.equal(view.calls.length, 0);
});

test('registration cards stay empty while ordinary answers continue to save and submit', async () => {
  const view = mount(true, true, 'mixed');
  const preview = view.find(view.render(), 'Preview')[0];
  preview.props.response.onChange('registration', [
    { id: 1, answers: { injected: 'ignored' } },
  ]);
  preview.props.response.onChange('q', [
    { id: 1, answers: { f: 'real answer' } },
  ]);
  const save = view
    .find(view.render(), 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, false);
  save.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(view.calls[0].body.answers.registration, []);
  assert.equal(view.calls[0].body.answers.q[0].answers.f, 'real answer');
});

test('an explicitly added flow period can be saved before its answers are filled', async () => {
  const view = mount(true, true);
  const preview = view.find(view.render(), 'Preview')[0];
  const added = [
    { id: 1, flowIndex: 1, answers: {} },
    { id: 2, flowAfter: 1, label: '', answers: {} },
  ];
  preview.props.response.onChange('q', added);
  let save = view
    .find(view.render(), 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, false);
  save.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(view.calls[0].body.answers.q, added);

  view
    .find(view.render(), 'Preview')[0]
    .props.response.onChange('q', [added[0]]);
  save = view
    .find(view.render(), 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, false);
  save.props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(view.calls[1].body.answers.q, [added[0]]);
});

test('initializing empty fixed flow periods still does not enable save', () => {
  const view = mount(true, true);
  const preview = view.find(view.render(), 'Preview')[0];
  preview.props.response.onChange('q', [
    { id: 1, flowIndex: 1, answers: {} },
    { id: -1, flowIndex: 2, answers: {} },
  ]);
  const save = view
    .find(view.render(), 'Button')
    .find((node) => node.props.children === '저장');
  assert.equal(save.props.disabled, true);
  assert.equal(view.calls.length, 0);
});

test('a changed flow layout locks and keeps the original unsaved table visible', () => {
  const view = mount(false, true);
  view.initial.questions[0].definition = {
    id: 'q',
    answer_layout: 'flow',
    row_mode: 'repeatable',
    max_rows: 2,
    fields: [{ id: 'f', kind: 'text' }],
  };
  const rows = [
    { id: 1, flowIndex: 1, answers: { f: 'first' } },
    { id: 77, flowAfter: 1, label: '추가 시기', answers: { f: 'custom' } },
    { id: 2, flowIndex: 2, answers: { f: 'last fixed answer' } },
  ];
  view.find(view.render(), 'Preview')[0].props.response.onChange('q', rows);
  view.render();
  const next = structuredClone(view.initial);
  next.definitionToken = 'b'.repeat(32);
  next.questions[0].definition.answer_layout = 'table';
  view.applyRemote(next);
  const tree = view.render();
  const preview = view.find(tree, 'Preview')[0];
  assert.deepEqual(preview.props.response.rows.q, rows);
  assert.equal(preview.props.library[0].answer_layout, 'flow');
  assert.equal(preview.props.response.disabled, true);
  assert.equal(view.find(tree, 'Button')[0].props.disabled, true);
  assert.equal(view.calls.length, 0);
});

test('a clean guide adopts newer answers even when the question definition changes too', () => {
  const view = mount(false);
  view.initial.questions[0].definition = {
    id: 'q',
    row_mode: 'repeatable',
    max_rows: 3,
    fields: [{ id: 'f', kind: 'text' }],
  };
  view.render();
  const next = structuredClone(view.initial);
  next.revision++;
  next.definitionToken = 'b'.repeat(32);
  next.questions[0].definition.fields.push({ id: 'g', kind: 'text' });
  next.questions[0].rows[0].answers.f = 'newer remote answer';
  view.applyRemote(next);
  const tree = view.render();
  assert.equal(
    view.find(tree, 'Preview')[0].props.response.rows.q[0].answers.f,
    'newer remote answer',
  );
  assert.equal(view.find(tree, 'Button')[0].props.disabled, true);
  assert.equal(view.calls.length, 0);
});

test('simultaneous remote definition and answer edits preserve dirty inputs and stop saves', () => {
  const view = mount(false);
  view.initial.questions[0].definition = {
    id: 'q',
    row_mode: 'single',
    fields: [{ id: 'f', kind: 'text' }],
  };
  view
    .find(view.render(), 'Preview')[0]
    .props.response.onChange('q', [{ id: 1, answers: { f: 'unsaved local' } }]);
  view.render();
  const next = structuredClone(view.initial);
  next.revision++;
  next.definitionToken = 'b'.repeat(32);
  next.questions[0].rows[0].answers.f = 'remote';
  view.applyRemote(next);
  const tree = view.render();
  const preview = view.find(tree, 'Preview')[0];
  assert.equal(preview.props.response.rows.q[0].answers.f, 'unsaved local');
  assert.equal(preview.props.response.disabled, true);
  assert.equal(view.find(tree, 'Button')[0].props.disabled, true);
});

test('definition-only changes retain dirty compatible fields without advancing another answer revision', () => {
  const view = mount(false);
  view.initial.questions[0].definition = {
    id: 'q',
    row_mode: 'single',
    fields: [{ id: 'f', kind: 'text' }],
  };
  view
    .find(view.render(), 'Preview')[0]
    .props.response.onChange('q', [{ id: 1, answers: { f: 'unsaved local' } }]);
  view.render();
  const next = structuredClone(view.initial);
  next.definitionToken = 'b'.repeat(32);
  next.questions[0].definition.fields.push({ id: 'g', kind: 'text' });
  view.applyRemote(next);
  const tree = view.render();
  assert.equal(
    view.find(tree, 'Preview')[0].props.response.rows.q[0].answers.f,
    'unsaved local',
  );
  assert.equal(view.find(tree, 'Button')[0].props.disabled, false);
});

test('invalid submission stays editable, sends no request, and clears errors after correction', async () => {
  const view = mount(true, true);
  let tree = view.render();
  view
    .find(tree, 'Button')
    .find((node) => node.props.children === '제출')
    .props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  tree = view.render();
  const preview = view.find(tree, 'Preview')[0];
  assert.ok(preview.props.submissionIssues.length);
  assert.equal(preview.props.submissionIssues[0].questionId, 'q');
  assert.equal(preview.props.response.disabled, false);
  assert.equal(view.calls.length, 0);
  preview.props.response.onChange('q', [
    { id: 1, answers: { f: '완성한 답변' } },
  ]);
  tree = view.render();
  assert.equal(view.find(tree, 'Preview')[0].props.submissionIssues.length, 0);
  view
    .find(tree, 'Button')
    .find((node) => node.props.children === '제출')
    .props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0].body.complete, true);
});
