import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = 'app/(private)/dashboard/_views/questions/';
const element = (type, props) => ({ type, props });
const stub = new Proxy({}, { get: (_, name) => name });
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(root + path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      ...globals,
      require: (name) =>
        imports[name] ??
        (name === 'react/jsx-runtime'
          ? { jsx: element, jsxs: element, Fragment: 'Fragment' }
          : stub),
    },
  );
  return exports;
}
function preview(notices, submittedView = false, questions = ['a', 'b']) {
  const { QuestionnairePreview } = load(
    'components/questionnaire/QuestionnairePreview.tsx',
    {
      react: {
        Fragment: 'Fragment',
        useCallback: (fn) => fn,
        useState: () => [{}, () => {}],
      },
      swr: { default: () => ({}) },
      '@/lib/utils': { cn: () => '' },
      './questionnaire-styles': { questionnaireStyles: {} },
    },
  );
  return QuestionnairePreview({
    notices,
    submittedView,
    title: 'test',
    sections: [
      {
        id: 'section',
        title: 'section',
        questions: questions.map((id) => ({ id, sourceQuestionId: id })),
      },
    ],
  });
}
function sequence(node) {
  if (!node) return [];
  if (Array.isArray(node)) return Array.from(node).flatMap(sequence);
  if (node.type === 'QuestionnaireStartNotice') return [node.props.notice.id];
  if (node.props?.['data-response-question'])
    return [node.props['data-response-question']];
  return sequence(node.props?.children);
}
const notices = [
  { id: 'first', position: 'start' },
  { id: 'between', position: 'a' },
  { id: 'second-between', position: 'a' },
  { id: 'last', position: 'end' },
];
test('notices render at the start, between questions, and at the end without taking a question number', () => {
  assert.deepEqual(sequence(preview(notices)), [
    'first',
    'a',
    'between',
    'second-between',
    'b',
    'last',
  ]);
});
test('moving a question carries its notices and deleting it preserves notices at the end', () => {
  assert.deepEqual(sequence(preview(notices, false, ['b', 'a'])), [
    'first',
    'b',
    'a',
    'between',
    'second-between',
    'last',
  ]);
  assert.deepEqual(sequence(preview(notices, false, ['b'])), [
    'first',
    'b',
    'between',
    'second-between',
    'last',
  ]);
});
test('submitted view excludes all notices', () => {
  assert.deepEqual(sequence(preview(notices, true)), ['a', 'b']);
});
function action(beforeNavigate) {
  const paths = [],
    errors = [];
  const { LinkRegistrationAction } = load(
    'components/questionnaire/LinkRegistrationAction.tsx',
    {
      react: {
        useRef: (value) => ({ current: value }),
        useState: () => [false, () => {}],
      },
      'next/navigation': {
        useRouter: () => ({ push: (path) => paths.push(path) }),
      },
      '@/components/ui/toast': {
        toast: { add: (message) => errors.push(message) },
      },
    },
  );
  return {
    paths,
    errors,
    button: LinkRegistrationAction({ label: '등록', beforeNavigate }),
  };
}
test('registration waits for successful save and excludes overlapping clicks', async () => {
  let release,
    saves = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const { button, paths } = action(async () => {
    saves++;
    return pending;
  });
  const first = button.props.onClick();
  await button.props.onClick();
  assert.equal(saves, 1);
  assert.equal(paths.length, 0);
  release(true);
  await first;
  assert.deepEqual(paths, [
    '/dashboard?view=exploration&tab=links&linkEditor=new',
  ]);
});
test('failed, conflicted, or uncertain saves never navigate', async () => {
  for (const save of [
    async () => false,
    async () => {
      throw new Error('offline');
    },
  ]) {
    const { button, paths, errors } = action(save);
    await button.props.onClick();
    assert.equal(paths.length, 0);
    assert.equal(errors.length, 1);
  }
});

function responseEditor(request) {
  const state = [],
    effects = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state))
        state[i] = typeof initial === 'function' ? initial() : initial;
      return [
        state[i],
        (value) => {
          state[i] = typeof value === 'function' ? value(state[i]) : value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (state[i] ??= { current: initial });
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (
        !state[i] ||
        !deps ||
        deps.some((v, j) => !Object.is(v, state[i][j]))
      ) {
        state[i] = deps;
        effects.push(fn);
      }
    },
    useCallback: (fn) => fn,
    useEffectEvent: (fn) => fn,
  };
  const initial = {
    id: 'session',
    revision: 1,
    title: 'test',
    status: 'in_progress',
    sourceDeleted: false,
    definitionToken: 'token',
    sections: [],
    questions: [
      {
        definition: {
          id: 'q',
          purpose: 'question',
          fields: [{ id: 'field', kind: 'text' }],
        },
        rows: [],
      },
    ],
  };
  const events = {
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
  };
  const { useQuestionResponseEditor } = load(
    'hooks/responses/useQuestionResponseEditor.ts',
    {
      react,
      swr: { useSWRConfig: () => ({ mutate: async () => {} }) },
      '@/components/ui/toast': { toast: { add() {} } },
      '../../lib/question-responses': {
        snapshotRows: () => ({ q: [] }),
        hasIncompatibleFlowDraft: () => false,
        mergeGuideResponseRows: () => ({}),
      },
      '../../lib/rich-text': { richTextPlainText: (v) => v },
      '../../lib/responses/submission-validation': {
        validateResponseSubmission: () => [],
      },
      '../../lib/responses/api-client': {
        requestQuestionResponse: async (...args) => {
          await request(...args);
          return { ...initial, revision: 2, savedAt: 'saved' };
        },
      },
      '../../lib/questionnaire/api-client': {
        QuestionnaireApiError: class extends Error {},
        QUESTIONNAIRE_API: '/api/questionnaires',
      },
    },
    {
      crypto: globalThis.crypto,
      structuredClone,
      setInterval: () => 1,
      clearInterval() {},
      window: events,
      document: events,
    },
  );
  return {
    render() {
      cursor = 0;
      const result = useQuestionResponseEditor({
        questionnaireId: 'document',
        initial,
      });
      while (effects.length) effects.shift()();
      return result;
    },
  };
}
test('response save reports success only when the latest inputs are fully saved', async () => {
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const editor = responseEditor(() => pending);
  let current = editor.render();
  current.change('q', [{ id: 1, answers: { field: 'first' } }]);
  current = editor.render();
  const saving = current.save();
  current.change('q', [{ id: 1, answers: { field: 'newer' } }]);
  editor.render();
  finish();
  assert.equal(await saving, false);
  current = editor.render();
  assert.equal(current.dirty, true);
  assert.equal(await current.save(), true);
});
test('clean answers need no request and failed answer saves cannot authorize navigation', async () => {
  let calls = 0;
  const editor = responseEditor(() => {
    calls++;
    throw new Error('offline');
  });
  let current = editor.render();
  assert.equal(await current.save(), true);
  assert.equal(calls, 0);
  current.change('q', [{ id: 1, answers: { field: 'draft' } }]);
  current = editor.render();
  assert.equal(await current.save(), false);
  assert.equal(calls, 1);
  assert.equal(editor.render().dirty, true);
});
