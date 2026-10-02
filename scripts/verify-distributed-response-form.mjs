import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

function mount(distributed = true, empty = false) {
  const calls = [];
  const state = [];
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
    useEffect() {},
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
        definition: { id: 'q' },
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
  const imports = {
    react,
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    swr: { useSWRConfig: () => ({ mutate: async () => {} }) },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/toast': { toast: { add() {} } },
    '../../lib/rich-text': { richTextPlainText: (value) => value },
    '../../lib/question-responses': {
      snapshotRows: (s) =>
        Object.fromEntries(s.questions.map((q) => [q.definition.id, q.rows])),
      mergeGuideResponseRows: (rows) => rows,
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
              rows: body.answers.q,
            })),
          }),
        };
      },
    },
  );
  const render = () => {
    cursor = 0;
    return exports.ResponseEditor({
      questionnaireId: 'questionnaire',
      initial,
      distributed,
    });
  };
  const nodes = (node) =>
    Array.isArray(node)
      ? node.flatMap(nodes)
      : node?.props
        ? [node, ...nodes(node.props.children)]
        : [];
  return {
    calls,
    render,
    find: (tree, type) => nodes(tree).filter((node) => node.type === type),
  };
}

test('a submitted distribution remains editable and has separate save and submit actions', async () => {
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
    '/api/questionnaires/questionnaire/distributed-responses',
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
