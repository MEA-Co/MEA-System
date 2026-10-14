import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const base = 'app/(private)/dashboard/_views/exploration/';
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      TextEncoder,
      crypto: { randomUUID },
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'local' } },
      ...globals,
      require: (name) => imports[name] ?? require(name),
    },
  );
  return exports;
}
const payload = load('lib/exploration/payload-size.ts');
const model = load('lib/exploration/storage-model.ts', {
  './payload-size': payload,
});
const fields = load('lib/exploration/fields.ts');
const draft = () => ({
  clientKey: randomUUID(),
  revision: 0,
  status: 'draft',
  updatedAt: new Date().toISOString(),
  values: fields.emptyValues(),
  reports: [],
});
function harness() {
  const sessions = new Map(),
    files = new Map();
  let quota = false,
    fileFailure = false;
  const sessionStorage = {
    getItem: (key) => sessions.get(key) ?? null,
    setItem: (key, value) => {
      if (quota) throw Error('quota');
      sessions.set(key, value);
    },
    removeItem: (key) => sessions.delete(key),
  };
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        if (fileFailure) {
          request.onerror();
          return;
        }
        request.result = {
          close() {},
          transaction() {
            const tx = {
              objectStore: () => ({
                get(key) {
                  const r = { result: files.get(key) };
                  queueMicrotask(() => tx.oncomplete());
                  return r;
                },
                put(value, key) {
                  const r = { result: key };
                  queueMicrotask(() => {
                    files.set(key, value);
                    tx.oncomplete();
                  });
                  return r;
                },
                delete(key) {
                  const r = {};
                  queueMicrotask(() => {
                    files.delete(key);
                    tx.oncomplete();
                  });
                  return r;
                },
              }),
            };
            return tx;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
  const fresh = (env = 'local') =>
    load(
      base + 'lib/editor-session.ts',
      { '@/lib/exploration/storage-model': model },
      {
        sessionStorage,
        indexedDB,
        process: { env: { NEXT_PUBLIC_SUPABASE_URL: env } },
      },
    );
  return {
    fresh,
    sessions,
    files,
    setQuota: (v) => (quota = v),
    setFileFailure: (v) => (fileFailure = v),
  };
}
test('reload restores unsaved text, references, baseline and original file without creating a saved draft', async () => {
  const h = harness(),
    api = h.fresh(),
    baseline = draft();
  const file = new File(['report'], 'report.pdf', {
    type: 'application/pdf',
    lastModified: 10,
  });
  const current = {
    ...baseline,
    values: {
      ...baseline.values,
      topic: '탐구 주제',
      references: [
        {
          clientKey: randomUUID(),
          title: '자료',
          selection: '선정',
          usage: '활용',
        },
      ],
    },
    reports: [
      {
        clientKey: randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        file,
      },
    ],
  };
  await api.writeEditor('me', current, baseline);
  const restored = await h.fresh().readEditor('me');
  assert.equal(restored.draft.values.topic, '탐구 주제');
  assert.equal(restored.draft.values.references[0].usage, '활용');
  assert.equal(restored.baseline.values.topic, '');
  assert.equal(await restored.draft.reports[0].file.text(), 'report');
  assert.notEqual(
    model.explorationFingerprint(restored.draft),
    model.explorationFingerprint(restored.baseline),
  );
});
test('users and environments cannot restore each other’s editor', async () => {
  const h = harness(),
    current = draft();
  await h.fresh().writeEditor('me', current, current);
  assert.equal(await h.fresh().readEditor('other'), null);
  assert.equal(await h.fresh('production').readEditor('me'), null);
});
test('closing deletes the session and files after a pending file write', async () => {
  const h = harness(),
    api = h.fresh(),
    current = draft();
  current.reports = [
    {
      clientKey: randomUUID(),
      name: 'a.pdf',
      size: 1,
      type: '',
      lastModified: 0,
      file: new File(['a'], 'a.pdf'),
    },
  ];
  const writing = api.writeEditor('me', current, current);
  await api.clearEditor('me');
  await writing;
  assert.equal(await api.readEditor('me'), null);
  assert.equal(h.files.size, 0);
});
test('session quota failure preserves previous recoverable text', async () => {
  const h = harness(),
    api = h.fresh(),
    current = draft();
  await api.writeEditor('me', current, current);
  h.setQuota(true);
  assert.throws(
    () =>
      api.writeEditor(
        'me',
        { ...current, values: { ...current.values, topic: 'new' } },
        current,
      ),
    /quota/,
  );
  assert.equal((await api.readEditor('me')).draft.values.topic, '');
});
test('failed attachment persistence keeps text and missing metadata available for reattachment', async () => {
  const h = harness(),
    api = h.fresh(),
    current = draft();
  current.values.topic = '본문 유지';
  current.reports = [
    {
      clientKey: randomUUID(),
      name: 'a.pdf',
      size: 1,
      type: '',
      lastModified: 0,
      file: new File(['a'], 'a.pdf'),
    },
  ];
  h.setFileFailure(true);
  await assert.rejects(api.writeEditor('me', current, current));
  const restored = await h.fresh().readEditor('me');
  assert.equal(restored.draft.values.topic, '본문 유지');
  assert.equal(restored.draft.reports[0].name, 'a.pdf');
  assert.equal(restored.draft.reports[0].file, undefined);
});
test('corrupt session is reported without deleting evidence', async () => {
  const h = harness(),
    api = h.fresh(),
    current = draft();
  await api.writeEditor('me', current, current);
  const key = [...h.sessions.keys()][0];
  h.sessions.set(key, '{bad');
  await assert.rejects(api.readEditor('me'));
  assert.equal(h.sessions.get(key), '{bad');
});

function hookHarness({ persist = true, query = '', saved = null } = {}) {
  const states = [],
    refs = [],
    effects = [],
    writes = [],
    notices = [];
  let stateIndex,
    refIndex,
    effectIndex,
    cleared = 0;
  let href = `http://localhost/dashboard?view=exploration${query}`;
  const imports = {
    react: {
      useState(value) {
        const i = stateIndex++;
        if (!(i in states)) states[i] = value;
        return [states[i], (next) => (states[i] = next)];
      },
      useRef(value) {
        const i = refIndex++;
        return (refs[i] ??= { current: value });
      },
      useCallback: (fn) => fn,
      useEffect: (fn) => (effects[effectIndex++] = fn),
    },
    swr: { useSWRConfig: () => ({ mutate() {} }) },
    '@/components/ui/toast': {
      toast: { add: (notice) => notices.push(notice) },
    },
    '@/lib/exploration/fields': fields,
    '@/lib/exploration/storage-model': model,
    '@/lib/supabase/client': {},
    '../lib/api-client': {},
    '../lib/local-drafts': {
      readDrafts: () => [],
      restoreFiles: async (_, value) => value,
    },
    '../lib/editor-session': {
      readEditor: async () => saved,
      writeEditor: async (_, draft, baseline) =>
        writes.push({ draft, baseline }),
      clearEditor: async () => cleared++,
    },
  };
  const api = load(base + 'hooks/useExplorationStorage.ts', imports, {
    URL,
    window: {
      location: {
        get href() {
          return href;
        },
      },
      history: { replaceState: (_, __, url) => (href = String(url)) },
      addEventListener() {},
      removeEventListener() {},
    },
  });
  const render = () => {
    stateIndex = refIndex = effectIndex = 0;
    return api.useExplorationStorage('me', persist);
  };
  return {
    render,
    effects,
    writes,
    notices,
    href: () => href,
    cleared: () => cleared,
  };
}
test('creation writes the URL, preserves unrelated params and clears recovery on discard', async () => {
  const h = hookHarness({ query: '&extra=keep' });
  h.render();
  h.effects[0]();
  await new Promise(setImmediate);
  h.render().create();
  h.render();
  h.effects[1]();
  assert.equal(new URL(h.href()).searchParams.get('explorationEditor'), 'new');
  assert.equal(new URL(h.href()).searchParams.get('extra'), 'keep');
  assert.equal(h.writes.length, 1);
  h.render().setDraft(null);
  h.render();
  h.effects[1]();
  assert.equal(new URL(h.href()).searchParams.has('explorationEditor'), false);
  assert.equal(h.cleared(), 1);
});
test('reload opens the recovered creation and preserves dirty status; confirmation clears the URL', async () => {
  const baseline = draft(),
    current = {
      ...baseline,
      values: { ...baseline.values, topic: '계속 작성' },
    };
  const h = hookHarness({
    query: '&explorationEditor=new',
    saved: { draft: current, baseline },
  });
  h.render();
  h.effects[0]();
  await new Promise(setImmediate);
  const view = h.render();
  assert.equal(view.draft.values.topic, '계속 작성');
  assert.equal(view.dirty, true);
  view.setDraft({ ...current, revision: 1, status: 'confirmed' });
  h.render();
  h.effects[1]();
  assert.equal(new URL(h.href()).searchParams.has('explorationEditor'), false);
  assert.equal(h.cleared(), 1);
});
test('embedded reference picker ignores creation URL and does not persist its drawer', async () => {
  const h = hookHarness({ persist: false, query: '&explorationEditor=new' });
  h.render();
  h.effects[0]();
  await new Promise(setImmediate);
  assert.equal(h.render().draft, null);
  h.render().create();
  h.render();
  h.effects[1]();
  assert.equal(h.writes.length, 0);
});
