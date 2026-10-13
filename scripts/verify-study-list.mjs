import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const require = createRequire(import.meta.url);
const exports = {};
const placeholders = new Proxy({}, { get: (_, name) => name });
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      'app/(private)/dashboard/_views/study/components/StudyTable.tsx',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText,
  {
    exports,
    require: (id) =>
      id === 'react/jsx-runtime'
        ? require(id)
        : id === '@/lib/study/fields'
          ? { studyTitle: (values) => values.title }
          : id === '@/lib/study/list-query'
            ? { STUDY_PAGE_SIZE: 10 }
            : placeholders,
  },
);
const noop = () => {};
const base = {
  rows: [],
  loading: false,
  error: null,
  total: 0,
  userId: 'me',
  showOthers: false,
  busy: false,
  onOpen: noop,
  onDelete: noop,
  onRetry: noop,
  query: '',
  owner: '',
  drafts: false,
  local: [],
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const draw = (props = {}) =>
  nodes(exports.StudyTableRows({ ...base, ...props }));
const ofType = (tree, type) => tree.filter((node) => node.type === type);
const activity = {
  clientKey: 'one',
  ownerId: 'me',
  status: 'confirmed',
  updatedAt: '2026-10-13T00:00:00Z',
  values: {
    title: '학습법',
    problem: '문제',
    subject: '국어',
    customSubject: '',
  },
};
test('loading renders ten rows; loading, empty and data use the same fixed viewport', () => {
  const loading = draw({ loading: true });
  assert.equal(ofType(loading, 'TableRow').length, 11);
  assert.equal(ofType(loading, 'Skeleton').length, 50);
  for (const props of [{}, { rows: [activity] }])
    assert.equal(draw(props)[0].props.className, loading[0].props.className);
  assert.equal(loading[0].props['aria-busy'], true);
});
test('empty, filtered, local and failed results have distinct messages and retries', () => {
  for (const [props, title] of [
    [{}, '등록된 학습법이 없습니다'],
    [{ query: '없는 검색어' }, '검색 결과가 없습니다'],
    [{ drafts: true }, '임시저장한 학습법이 없습니다'],
    [{ error: new Error() }, '목록을 불러오지 못했습니다'],
  ]) {
    assert.ok(draw(props).some((node) => node.props.children === title));
  }
  let retries = 0;
  ofType(draw({ error: new Error(), onRetry: () => retries++ }), 'Button')
    .find((node) => node.props.children === '다시 불러오기')
    .props.onClick();
  assert.equal(retries, 1);
});
test('other authors are read-only and cannot be deleted', () => {
  const tree = draw({
    rows: [{ ...activity, ownerId: 'other' }],
    showOthers: true,
  });
  assert.equal(ofType(tree, 'Button').length, 1);
  assert.equal(
    ofType(tree, 'Button')[0].props['aria-label'],
    '학습법 상세 보기',
  );
});
test('own rows reopen local edits without discarding them and delete the visible draft only', () => {
  const draft = { ...activity, status: 'draft' };
  let opened;
  let removed;
  const tree = draw({
    rows: [draft],
    local: [draft],
    onOpen: (value) => (opened = value),
    onDelete: (value) => (removed = value),
  });
  ofType(tree, 'button')[0].props.onClick({ currentTarget: {} });
  ofType(tree, 'Button')
    .find((node) => node.props['aria-label'] === '학습법 삭제')
    .props.onClick();
  assert.equal(opened, draft);
  assert.equal(removed, draft);
});

test('confirmed rows keep their own open/delete target even when an unsaved local copy exists', () => {
  let opened, removed;
  const tree = draw({
    rows: [activity],
    local: [{ ...activity, status: 'draft' }],
    onOpen: (value) => (opened = value),
    onDelete: (value) => (removed = value),
  });
  ofType(tree, 'button')[0].props.onClick({ currentTarget: {} });
  ofType(tree, 'Button')
    .find((node) => node.props['aria-label'] === '학습법 삭제')
    .props.onClick();
  assert.equal(opened, activity);
  assert.equal(removed, activity);
});
