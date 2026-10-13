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
      'app/(private)/dashboard/_views/study/components/StudyList.tsx',
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
        : id === '../lib/fields'
          ? {
              studyTitle: (values) => values.title,
              studySummary: () => '국어',
            }
          : placeholders,
  },
);
const noop = () => {};
const base = {
  canViewOthers: true,
  scope: 'mine',
  setScope: noop,
  query: '',
  setQuery: noop,
  mine: [],
  others: [],
  showOthers: false,
  otherMode: 'all',
  setOtherMode: noop,
  owner: '',
  setOwner: noop,
  ownerLabel: () => '작성자',
  people: [],
  filtered: [],
  busy: false,
  ready: true,
  isLoading: false,
  remoteError: null,
  localError: null,
  canEdit: () => true,
  onOpen: noop,
  onDelete: noop,
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const draw = (overrides) => nodes(exports.StudyList({ ...base, ...overrides }));
const ofType = (tree, type) => tree.filter((node) => node.type === type);

test('초기 저장소 준비와 원격 로딩은 목록 안에서 표시하고 빈 목록으로 오인하지 않는다', () => {
  for (const pending of [{ ready: false }, { isLoading: true }]) {
    const tree = draw(pending);
    assert.equal(ofType(tree, 'CollectionLoadingState').length, 1);
    assert.equal(ofType(tree, 'CollectionEmptyState').length, 0);
    const region = tree.find((node) => node.props['aria-busy'] === true);
    assert.ok(
      nodes(region).some((node) => node.type === 'CollectionLoadingState'),
    );
    assert.ok(
      ofType(tree, 'Badge').every((node) => node.props.children === '—'),
    );
  }
});

test('로딩 완료 후 빈 목록과 검색 없음·실패를 구분하고 같은 결과 영역을 유지한다', () => {
  const loadingRegion = draw({ isLoading: true }).find(
    (node) => node.props['aria-busy'] === true,
  );
  for (const [overrides, title] of [
    [{}, '등록된 학습법이 없습니다'],
    [{ query: '없는 검색어' }, '검색 결과가 없습니다'],
    [{ remoteError: new Error('network') }, '목록을 불러오지 못했습니다'],
    [{ showOthers: true, otherMode: 'person' }, '작성자를 선택해 주세요'],
  ]) {
    const tree = draw(overrides);
    assert.equal(ofType(tree, 'CollectionLoadingState').length, 0);
    assert.equal(ofType(tree, 'CollectionEmptyState')[0].props.title, title);
    assert.equal(
      tree.find((node) => node.props['aria-busy'] === false).props.className,
      loadingRegion.props.className,
    );
  }
});

test('원격 로딩 중에도 기존 로컬 항목과 열기·삭제 동작을 유지한다', () => {
  const activity = {
    clientKey: 'local-1',
    status: 'draft',
    revision: 0,
    values: { title: '저장한 학습법' },
  };
  let opened;
  let deleted;
  const tree = draw({
    isLoading: true,
    filtered: [activity],
    onOpen: (value) => {
      opened = value;
    },
    onDelete: (value) => {
      deleted = value;
    },
  });
  assert.equal(ofType(tree, 'CollectionLoadingState').length, 0);
  assert.equal(ofType(tree, 'Item').length, 1);
  ofType(tree, 'button')[0].props.onClick({ currentTarget: {} });
  ofType(tree, 'Button')
    .find((node) => node.props.title === '삭제')
    .props.onClick();
  assert.equal(opened, activity);
  assert.equal(deleted, activity);
});

test('타인 학습법은 읽기 전용으로 표시하고 삭제를 제공하지 않는다', () => {
  const tree = draw({
    filtered: [
      {
        clientKey: 'other-1',
        status: 'confirmed',
        values: { title: '다른 학습법' },
      },
    ],
    canEdit: () => false,
  });
  assert.equal(
    ofType(tree, 'Button').some((node) => node.props.title === '삭제'),
    false,
  );
  assert.equal(
    ofType(tree, 'Button').some((node) => node.props.title === '상세 보기'),
    true,
  );
});
