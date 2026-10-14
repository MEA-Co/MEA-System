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
test('reference picker uses page metadata and confirmed rows without loading drafts', () => {
  let options, page;
  const { ExplorationSelectList } = load(
    'app/(private)/dashboard/_views/exploration/components/ExplorationSelectList.tsx',
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
      '../hooks/useExplorationList': {
        useExplorationList: (_scope, _enabled, _reference, input) => {
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
      '../lib/list-model': {
        explorationTitle: (v) => v.values.title,
        explorationSummary: () => '',
      },
      '@/lib/exploration/storage-model': { fromRow: (v) => v },
    },
  );
  let selected;
  const tree = nodes(
    ExplorationSelectList({
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
