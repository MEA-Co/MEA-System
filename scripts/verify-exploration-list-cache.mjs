import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const root = 'app/(private)/dashboard/_views/';
function compile(path, require, extra = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require, ...extra },
  );
  return exports;
}
function fixture(payload) {
  const cache = new Map([['/api/exploration?scope=own', []]]);
  const calls = [];
  const pending = [];
  const hook = compile(
    `${root}exploration/hooks/useExplorationList.ts`,
    () => ({
      default: (key, fetcher) => {
        calls.push(key);
        if (!key) return {};
        const serialized = JSON.stringify(key);
        if (!cache.has(serialized))
          pending.push(
            fetcher(key).then((data) => cache.set(serialized, data)),
          );
        return {
          data: cache.get(serialized),
          mutate: () =>
            fetcher(key).then((data) => cache.set(serialized, data)),
        };
      },
    }),
    { fetch: async () => ({ ok: true, json: async () => payload }) },
  );
  const require = (name) => {
    if (name.includes('useExplorationList')) return hook;
    if (name === 'react') return { useState: () => [false, () => {}] };
    if (name === 'react/jsx-runtime')
      return {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      };
    return { Menu: {} };
  };
  return {
    hook,
    cache,
    calls,
    pending,
    input: compile(
      `${root}questions/components/question/QuestionExplorationInput.tsx`,
      require,
    ).QuestionExplorationInput,
    picker: compile(
      `${root}questions/components/question/ExplorationCommands.tsx`,
      require,
    ).ExplorationPicker,
  };
}

test('empty list shares an object cache across legacy input and @ picker, including revalidation', async () => {
  const f = fixture({ userId: 'test-user', activities: [] });
  f.input({});
  f.picker({ onSelect() {} });
  await Promise.all(f.pending);
  assert.doesNotThrow(() => f.input({}));
  assert.doesNotThrow(() => f.picker({ onSelect() {} }));
  assert.equal(JSON.stringify(f.calls[0]), JSON.stringify(f.calls[1]));
  assert.notEqual(
    JSON.stringify(f.calls[0]),
    JSON.stringify('/api/exploration?scope=own'),
  );
  await f.hook.useExplorationList('own').mutate();
  assert.doesNotThrow(() => f.input({}));
  assert.deepEqual(f.cache.get('/api/exploration?scope=own'), []);
});

test('populated list works in either consumer order and scopes remain separate', async () => {
  const f = fixture({
    userId: 'test-user',
    activities: [
      {
        id: 'activity-1',
        values: {
          topic: '활동',
          grade: '1',
          semester: '1',
          recordArea: '물리',
        },
      },
    ],
  });
  f.picker({ onSelect() {} });
  await Promise.all(f.pending);
  assert.doesNotThrow(() => f.input({}));
  assert.doesNotThrow(() => f.picker({ onSelect() {} }));
  f.hook.useExplorationList('accessible');
  assert.notEqual(JSON.stringify(f.calls.at(-1)), JSON.stringify(f.calls[0]));
  f.hook.useExplorationList('own', false);
  assert.equal(f.calls.at(-1), null);
  await Promise.all(f.pending);
});

test('malformed list responses are rejected instead of reaching array methods', async () => {
  for (const payload of [
    [],
    null,
    { userId: 'user', activities: {} },
    { activities: [] },
  ]) {
    await assert.rejects(
      fixture(payload).hook.fetchExplorationList('/api/exploration'),
      /목록을 확인하지 못했어요/,
    );
  }
});
