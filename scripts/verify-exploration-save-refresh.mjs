import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
test('saving a local edit reads only its confirmed row for removed files and refreshes page/reference caches', async () => {
  const edited = {
    clientKey: 'one',
    ownerId: 'me',
    revision: 1,
    status: 'draft',
    values: {},
    reports: [],
  };
  const states = [[], '', true, edited, edited, false];
  let index = 0;
  const requests = [],
    deleted = [],
    mutations = [];
  let complete;
  const done = new Promise((resolve) => {
    complete = resolve;
  });
  const imports = {
    react: {
      useCallback: (f) => f,
      useEffect() {},
      useRef: (value) => ({ current: value }),
      useState: () => [states[index++], () => {}],
    },
    swr: {
      useSWRConfig: () => ({
        mutate: (filter) => {
          mutations.push(filter);
          return Promise.resolve();
        },
      }),
    },
    '@/components/ui/toast': {
      toast: {
        add: (message) => {
          if (message.type === 'success') complete();
          else throw new Error(message.title);
        },
      },
    },
    '@/lib/supabase/client': {
      createClient: () => ({
        storage: {
          from: () => ({
            remove: async (paths) => {
              deleted.push(...paths);
            },
          }),
        },
      }),
    },
    '../lib/api-client': {
      request: async (url) => {
        requests.push(url);
        return { activities: [{ reports: [{ path: 'old/report.pdf' }] }] };
      },
      confirmExploration: async () => ({
        ...edited,
        revision: 2,
        status: 'confirmed',
      }),
    },
    '@/lib/exploration/fields': {},
    '../lib/local-drafts': {
      removeDraft: async () => {},
      readDrafts: () => [],
    },
    '@/lib/exploration/storage-model': {
      explorationFingerprint: () => 'same',
      hasInput: () => true,
      missingFields: () => [],
      REPORT_BUCKET: 'exploration-reports',
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/exploration/hooks/useExplorationStorage.ts',
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (id) => imports[id] ?? require(id),
      crypto: { randomUUID: () => 'save-id' },
    },
  );
  exports.useExplorationStorage('me').confirm();
  await done;
  assert.deepEqual(requests, ['/api/exploration?scope=own&reference=one']);
  assert.deepEqual(deleted, ['old/report.pdf']);
  for (const key of [
    'exploration-page',
    'exploration-summary',
    'exploration-list-v1',
  ])
    assert.equal(mutations[0]([key]), true);
  assert.equal(mutations[0](['study-page']), false);
});
