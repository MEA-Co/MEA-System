import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const base = 'app/(private)/dashboard/_views/exploration/';
const placeholders = new Proxy({}, { get: (_, key) => key });
function load(path, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        path.startsWith('lib/exploration/') ? path : base + path,
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports,
      require: (id) =>
        id === 'react/jsx-runtime'
          ? require(id)
          : (imports[id] ?? placeholders),
    },
  );
  return exports;
}
const { emptyValues } = load('lib/exploration/fields.ts');
const model = load('lib/list-model.ts');
const { ExplorationTableRows } = load('components/ExplorationTable.tsx', {
  '../lib/list-model': model,
  '@/lib/exploration/list-query': { EXPLORATION_PAGE_SIZE: 10 },
});
const activity = (id, extras = {}) => ({
  clientKey: id,
  ownerId: 'me',
  status: 'confirmed',
  revision: 1,
  updatedAt: '2026-10-13',
  values: { ...emptyValues(), topic: id, recordArea: '물리학' },
  ...extras,
});
const confirmed = activity('original');
const draft = activity('original', {
  status: 'draft',
  values: { ...emptyValues(), topic: '수정 내용' },
});
const other = activity('other', { ownerId: 'other', ownerName: '홍길동' });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const draw = (extras = {}) =>
  nodes(
    ExplorationTableRows({
      rows: [],
      loading: false,
      error: null,
      userId: 'me',
      showOthers: false,
      busy: false,
      filtered: false,
      drafts: false,
      onOpen() {},
      onDelete() {},
      onRetry() {},
      ...extras,
    }),
  );
test('loading reserves the same viewport as empty/data and renders ten skeleton rows', () => {
  const tree = draw({ loading: true });
  assert.equal(tree.filter((node) => node.type === 'Skeleton').length, 50);
  assert.equal(tree[0].props.className, draw()[0].props.className);
  assert.equal(
    tree[0].props.className,
    draw({ rows: [confirmed] })[0].props.className,
  );
});
test('row click opens visible object; action buttons do not bubble into open; others have no delete', () => {
  let opened = null;
  const tree = draw({
    rows: [confirmed],
    onOpen: (row) => {
      opened = row;
    },
  });
  const row = tree.find(
    (node) => node.type === 'TableRow' && node.props.onClick,
  );
  row.props.onClick({ target: { closest: () => true }, currentTarget: {} });
  assert.equal(opened, null);
  row.props.onClick({ target: { closest: () => null }, currentTarget: {} });
  assert.equal(opened, confirmed);
  const buttons = draw({ rows: [other], showOthers: true }).filter(
    (node) => node.type === 'Button',
  );
  assert.equal(buttons.length, 1);
  assert.match(buttons[0].props['aria-label'], /상세 보기/);
});
