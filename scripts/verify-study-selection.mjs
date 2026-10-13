import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (id) =>
        id === 'react/jsx-runtime'
          ? require(id)
          : (imports[id] ?? new Proxy({}, { get: (_, key) => String(key) })),
    },
  );
  return exports;
}
function nodes(node) {
  return Array.isArray(node)
    ? node.flatMap(nodes)
    : node && typeof node === 'object'
      ? [node, ...nodes(node.props?.children)]
      : [];
}
const react = {
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
};
test('question selection keeps an existing ID visible outside the current search page', () => {
  const calls = [];
  const selected = { id: 'selected', values: { title: '기존 선택' } };
  const { QuestionStudyInput } = load(
    'app/(private)/dashboard/_views/questions/components/question/QuestionStudyInput.tsx',
    {
      react,
      '@base-ui/react/menu': {
        Menu: new Proxy({}, { get: (_, key) => String(key) }),
      },
      '@/app/(private)/dashboard/_views/study/hooks/useStudyList': {
        useStudyList: (...args) => {
          calls.push(args);
          return {
            data: { activities: args[2] ? [selected] : [], page: 1, total: 0 },
          };
        },
      },
      '@/lib/study/fields': {
        studyTitle: (v) => v.title,
        studySummary: () => '',
      },
      '@/lib/study/storage-model': { fromRow: (v) => v },
    },
  );
  const tree = nodes(QuestionStudyInput({ value: 'selected' }));
  assert.equal(calls[1][0], 'own');
  assert.equal(calls[1][2], 'selected');
  assert.ok(tree.some((n) => n.props?.children === '기존 선택'));
  assert.ok(
    !tree.some((n) =>
      String(n.props?.children).includes('선택한 활동을 찾을 수'),
    ),
  );
});
test('reference picker uses page metadata and confirmed rows without loading drafts', () => {
  let options, page;
  const { StudySelectList } = load(
    'app/(private)/dashboard/_views/study/components/StudySelectList.tsx',
    {
      react: {
        ...react,
        useState: (initial) => [
          initial,
          (next) => {
            if (typeof next === 'number') page = next;
          },
        ],
      },
      '../hooks/useStudyList': {
        useStudyList: (_scope, _enabled, _reference, input) => {
          options = input;
          return {
            data: {
              activities: [{ id: 'one', values: { title: '확정본' } }],
              page: 1,
              total: 11,
            },
          };
        },
      },
      '@/lib/study/fields': {
        studyTitle: (v) => v.title,
        studySummary: () => '',
      },
      '@/lib/study/storage-model': { fromRow: (v) => v },
    },
  );
  let selected;
  const tree = nodes(
    StudySelectList({
      busy: false,
      onSelect: (v) => (selected = v),
      onOpen() {},
      onCreate() {},
    }),
  );
  assert.equal(options.page, 1);
  tree.find((n) => n.type === 'button').props.onClick();
  assert.equal(selected.id, 'one');
  const next = tree.find((n) => n.props?.children === '다음');
  assert.equal(next.props.disabled, false);
  next.props.onClick();
  assert.equal(page, 2);
});
