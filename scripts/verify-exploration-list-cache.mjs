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
    {
      URLSearchParams,
      fetch: async () => ({ ok: true, json: async () => payload }),
    },
  );
  return { hook, cache, calls, pending };
}
test('page/query, identity context and reference reads use distinct object cache keys', async () => {
  const f = fixture({
    userId: 'test-user',
    activities: [],
    page: 1,
    total: 0,
    pageSize: 10,
  });
  const read = f.hook.useExplorationList('own');
  f.hook.useExplorationList('own', true, undefined, { page: 2, query: 'DNA' });
  f.hook.useExplorationList('own', true, undefined, { identityOnly: true });
  f.hook.useExplorationList('accessible', true, 'id');
  assert.equal(new Set(f.calls.map(JSON.stringify)).size, 4);
  assert.ok(f.calls[1][1].includes('page=2'));
  assert.ok(f.calls[1][1].includes('q=DNA'));
  assert.ok(f.calls[2][1].includes('mode=context'));
  assert.ok(!f.calls[3][1].includes('scope=own'));
  await Promise.all(f.pending);
  await read.mutate();
  assert.deepEqual(f.cache.get('/api/exploration?scope=own'), []);
  f.hook.useExplorationList('own', false);
  assert.equal(f.calls.at(-1), null);
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
