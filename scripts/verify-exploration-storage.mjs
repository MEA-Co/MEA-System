import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const base = 'app/(private)/dashboard/_views/exploration/lib/';
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
      console,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://local.test' } },
      crypto: { randomUUID },
      ...globals,
      require: (id) =>
        id === 'zod'
          ? require('zod')
          : (imports[id] ??
            (() => {
              throw new Error(`Unexpected import ${id}`);
            })()),
    },
  );
  return exports;
}
const model = load(base + 'storage-model.ts');
const { emptyValues } = load(base + 'fields.ts');
const make = () => ({
  clientKey: randomUUID(),
  status: 'draft',
  revision: 0,
  updatedAt: new Date().toISOString(),
  values: emptyValues(),
  reports: [],
});
function storageHarness() {
  const data = new Map();
  let fail = false;
  const storage = {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (fail) throw new Error('quota');
      data.set(key, value);
    },
    removeItem: (key) => data.delete(key),
  };
  const files = new Map();
  // Minimal transactional IndexedDB adapter; tests exercise our commit/restore ordering, not a browser UI.
  const indexedDB = {
    open: () => {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction: () => {
            const tx = {
              objectStore: () => ({
                put(value, key) {
                  const r = { result: key };
                  queueMicrotask(() => {
                    files.set(key, value);
                    tx.oncomplete();
                  });
                  return r;
                },
                get(key) {
                  const r = { result: files.get(key) };
                  queueMicrotask(() => tx.oncomplete());
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
  return {
    api: load(
      base + 'local-drafts.ts',
      { './storage-model': model },
      { localStorage: storage, navigator: {}, indexedDB },
    ),
    data,
    files,
    fail: () => {
      fail = true;
    },
  };
}
test('임시저장은 주제가 없어도 어느 항목 하나 또는 참고자료/파일만 있으면 가능', () => {
  const activity = make();
  assert.equal(model.hasInput(activity), false);
  for (const key of Object.keys(activity.values).filter(
    (k) => k !== 'references',
  )) {
    const d = make();
    d.values[key] = '값';
    assert.equal(model.hasInput(d), true, key);
  }
  activity.values.references.push({
    clientKey: randomUUID(),
    title: '',
    selection: '선정 이유',
    usage: '',
  });
  assert.equal(model.hasInput(activity), true);
  activity.values.references = [];
  activity.reports = [{ clientKey: randomUUID() }];
  assert.equal(model.hasInput(activity), true);
});
test('확정은 모든 필수 항목을 검사하고 성장·참고자료·파일은 선택', () => {
  const values = emptyValues();
  for (const key of Object.keys(model.requiredFields)) values[key] = '작성';
  Object.assign(values, {
    grade: '1',
    semester: '1',
    recordType: '세특',
    recordArea: '영어',
  });
  const payload = {
    id: randomUUID(),
    saveId: randomUUID(),
    expectedRevision: 0,
    values,
    reports: [],
  };
  assert.equal(model.confirmRequestSchema.safeParse(payload).success, true);
  for (const key of Object.keys(model.requiredFields)) {
    assert.equal(
      model.confirmRequestSchema.safeParse({
        ...payload,
        values: { ...values, [key]: ' \n\t ' },
      }).success,
      false,
      key,
    );
  }
  assert.equal(
    model.confirmRequestSchema.safeParse({
      ...payload,
      values: { ...values, recordType: '창체', recordArea: '영어' },
    }).success,
    false,
  );
});
test('임시저장을 계정별로 분리하고 새 호출에서 복원, 타 탭의 변경 보호', async () => {
  const { api } = storageHarness();
  const d = make();
  d.values.followup = '성장만 입력';
  const saved = await api.saveDraft('A', d);
  assert.equal(api.readDrafts('A')[0].values.followup, '성장만 입력');
  assert.equal(api.readDrafts('B').length, 0);
  await assert.rejects(api.saveDraft('A', d), /다른 탭/);
  await assert.rejects(api.removeDraft('A', d), /다른 탭/);
  const changed = await api.saveDraft('A', {
    ...saved,
    values: { ...saved.values, topic: '새 주제' },
  });
  await assert.rejects(api.saveDraft('A', saved), /다른 탭/);
  await api.removeDraft('A', changed);
  assert.equal(api.readDrafts('A').length, 0);
});
test('저장 공간 부족 시 기존 임시저장을 보존', async () => {
  const h = storageHarness();
  const d = make();
  d.values.topic = '기존';
  const saved = await h.api.saveDraft('A', d);
  h.fail();
  await assert.rejects(
    h.api.saveDraft('A', {
      ...saved,
      values: { ...saved.values, topic: '변경' },
    }),
    /공간/,
  );
  assert.equal(h.api.readDrafts('A')[0].values.topic, '기존');
});
test('첨부만 있는 임시저장: 파일 원문은 브라우저에 복원, JSON에는 메타데이터만 저장', async () => {
  const h = storageHarness();
  const d = make();
  const file = {
    name: '보고서.pdf',
    size: 10,
    type: 'application/pdf',
    lastModified: 1,
    content: 'file bytes',
  };
  d.reports = [
    {
      clientKey: randomUUID(),
      name: file.name,
      size: 10,
      type: file.type,
      lastModified: 1,
      file,
    },
  ];
  const saved = await h.api.saveDraft('A', d);
  const reread = h.api.readDrafts('A')[0];
  assert.equal(reread.reports[0].file, undefined);
  assert.equal((await h.api.restoreFiles('A', reread)).reports[0].file, file);
  assert.equal(h.files.size, 1);
  await h.api.removeDraft('A', saved);
  assert.equal(h.files.size, 0);
});
test('확정본의 수정 임시저장은 원본 revision을 유지', async () => {
  const { api } = storageHarness();
  const d = { ...make(), revision: 4, status: 'confirmed' };
  d.values.story = '수정 중';
  const saved = await api.saveDraft('A', d);
  assert.equal(saved.revision, 4);
  assert.equal(saved.status, 'draft');
  assert.equal(d.status, 'confirmed');
});
test('손상된 임시저장은 조용히 버리거나 덮어쓰지 않음', async () => {
  const h = storageHarness();
  const d = make();
  d.values.topic = '주제';
  await h.api.saveDraft('A', d);
  h.data.set([...h.data.keys()][0], '{broken');
  assert.throws(() => h.api.readDrafts('A'));
  assert.equal(h.data.size, 1);
});
test('첨부 파일 업로드 후 확정 실패 시 파일을 삭제하지 않고 동일 요청으로 재시도', async () => {
  const d = make();
  const report = {
    clientKey: randomUUID(),
    name: '보고서.pdf',
    size: 10,
    type: 'application/pdf',
    lastModified: 1,
    file: {},
  };
  d.reports = [report];
  let uploads = 0,
    requests = 0;
  const paths = [];
  const client = {
    storage: {
      from: () => ({
        upload: async (path) => {
          paths.push(path);
          uploads++;
          return { error: uploads > 1 ? new Error('exists') : null };
        },
        info: async () => ({ data: { size: 10 }, error: null }),
      }),
    },
  };
  const savedRow = {
    id: d.clientKey,
    values: d.values,
    reports: [],
    revision: 1,
    updated_at: new Date().toISOString(),
  };
  const bodies = [];
  const api = load(
    base + 'api-client.ts',
    {
      './storage-model': model,
      '@/lib/supabase/client': { createClient: () => client },
    },
    {
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        requests++;
        if (requests === 1) throw new Error('offline');
        return { ok: true, json: async () => ({ activity: savedRow }) };
      },
    },
  );
  const saveId = randomUUID();
  await assert.rejects(api.confirmActivity('A', d, saveId), /offline/);
  await api.confirmActivity('A', d, saveId);
  assert.equal(paths[0], paths[1]);
  assert.equal(bodies[0].saveId, bodies[1].saveId);
});

function apiHarness({
  role = 'consultant',
  viewRole = role,
  userId = randomUUID(),
  rpcError = null,
  rows = [],
} = {}) {
  const filters = [];
  let rpcCalls = 0;
  let page = [];
  const query = {
    select() {
      return this;
    },
    eq(key, value) {
      filters.push([key, value]);
      return this;
    },
    is() {
      return this;
    },
    order() {
      return this;
    },
    range(start, end) {
      page = rows.slice(start, end + 1);
      return this;
    },
    then(resolve) {
      return Promise.resolve({ data: page, error: null }).then(resolve);
    },
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const client = {
    from: () => query,
    rpc: async () => {
      rpcCalls++;
      return { data: {}, error: rpcError };
    },
  };
  const api = load(
    'app/api/exploration/[[...path]]/route.ts',
    {
      'next/headers': { cookies: async () => ({}) },
      zod: require('zod'),
      '@/app/(private)/dashboard/_views/exploration/lib/storage-model': model,
      '@/lib/admin': { getViewRole: async () => viewRole },
      '@/lib/auth': {
        getUserAccess: async () => ({
          user: userId ? { id: userId } : null,
          isOnboarded: true,
          role,
        }),
      },
      '@/lib/supabase/server': { createClient: () => client },
    },
    { Response, Request, URL },
  );
  return {
    api,
    filters,
    get rpcCalls() {
      return rpcCalls;
    },
  };
}
test('API 인증·역할·교차 출처 검사로 권한 없는 저장 차단', async () => {
  for (const [options, status] of [
    [{ userId: null }, 401],
    [{ role: 'student' }, 403],
  ]) {
    const h = apiHarness(options);
    const r = await h.api.PUT(
      new Request('http://localhost/api/exploration/' + randomUUID(), {
        method: 'PUT',
        body: '{}',
      }),
      { params: Promise.resolve({ path: [randomUUID()] }) },
    );
    assert.equal(r.status, status);
    assert.equal(h.rpcCalls, 0);
  }
  const h = apiHarness();
  const r = await h.api.PUT(
    new Request('http://localhost/api/exploration/' + randomUUID(), {
      method: 'PUT',
      headers: { origin: 'https://evil.test' },
      body: '{}',
    }),
    { params: Promise.resolve({ path: [randomUUID()] }) },
  );
  assert.equal(r.status, 403);
});
test('API 목록은 컨설턴트 본인 필터로 500개씩 끝까지 조회', async () => {
  const rows = Array.from({ length: 501 }, () => ({ id: randomUUID() }));
  const userId = randomUUID();
  const h = apiHarness({ role: 'consultant', userId, rows });
  const r = await h.api.GET(new Request('http://localhost/api/exploration'), {
    params: Promise.resolve({}),
  });
  assert.equal((await r.json()).activities.length, 501);
  assert.equal(
    h.filters.filter(([key, value]) => key === 'owner_id' && value === userId)
      .length,
    2,
  );
});
test('API 필수 입력 누락은 RPC 호출 전에 거절하고 DB 충돌은 409로 반환', async () => {
  const id = randomUUID();
  const body = {
    id,
    saveId: randomUUID(),
    expectedRevision: 0,
    values: emptyValues(),
    reports: [],
  };
  const h = apiHarness({ rpcError: { code: '40001' } });
  const put = () =>
    h.api.PUT(
      new Request('http://localhost/api/exploration/' + id, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: [id] }) },
    );
  assert.equal((await put()).status, 400);
  assert.equal(h.rpcCalls, 0);
  for (const key of Object.keys(model.requiredFields))
    body.values[key] = '작성';
  Object.assign(body.values, { grade: '1', semester: '1', recordType: '세특' });
  assert.equal((await put()).status, 409);
  assert.equal(h.rpcCalls, 1);
});

test('리드·관리자는 전체 조회, 관리자 컨설턴트 미리보기는 본인 조회', async () => {
  for (const [role, viewRole, ownOnly] of [
    ['consultant', 'consultant', true],
    ['consultant_lead', 'consultant_lead', false],
    ['admin', 'admin', false],
    ['admin', 'consultant', true],
  ]) {
    const h = apiHarness({ role, viewRole });
    const response = await h.api.GET(
      new Request('http://localhost/api/exploration'),
      { params: Promise.resolve({}) },
    );
    assert.equal(response.status, 200);
    assert.equal(
      h.filters.some(([key]) => key === 'owner_id'),
      ownOnly,
    );
  }
});
