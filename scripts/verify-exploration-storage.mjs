import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const studyMode = process.env.MEA_TEST_BLOCK === 'study';
const block = studyMode ? 'study' : 'exploration';
const base = `app/(private)/dashboard/_views/${block}/lib/`;
const schoolValues = studyMode
  ? { category: '내신', subject: '수학', problemSource: 'self' }
  : { grade: '1', semester: '1', recordType: '세특', recordArea: '영어' };
const topicKey = studyMode ? 'strategy' : 'topic';
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
const domain = `lib/${block}/`;
const payload = load(domain + 'payload-size.ts');
const model = load(domain + 'storage-model.ts', { './payload-size': payload });
const { emptyValues } = load(domain + 'fields.ts');
const make = () => ({
  clientKey: randomUUID(),
  status: 'draft',
  revision: 0,
  updatedAt: new Date().toISOString(),
  values: emptyValues(),
  reports: [],
});
function storageHarness({
  locks = true,
  environment = 'http://local.test',
} = {}) {
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
            let scanning = false;
            const tx = {
              objectStore: () => ({
                openKeyCursor(range) {
                  scanning = true;
                  const request = {};
                  const keys = [...files.keys()]
                    .filter((key) => key >= range.lower && key <= range.upper)
                    .sort();
                  let index = 0;
                  function step() {
                    queueMicrotask(() => {
                      request.result =
                        index < keys.length
                          ? { key: keys[index++], continue: step }
                          : null;
                      request.onsuccess();
                      if (!request.result)
                        queueMicrotask(() => tx.oncomplete());
                    });
                  }
                  step();
                  return request;
                },
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
                    if (!scanning) tx.oncomplete();
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
  const lockTails = new Map();
  const navigator = locks
    ? {
        locks: {
          request: (name, run) => {
            const next = (lockTails.get(name) ?? Promise.resolve())
              .catch(() => {})
              .then(run);
            lockTails.set(name, next);
            return next;
          },
        },
      }
    : {};
  return {
    api: load(
      base + 'local-drafts.ts',
      { [`@/lib/${block}/storage-model`]: model },
      {
        localStorage: storage,
        navigator,
        indexedDB,
        IDBKeyRange: { bound: (lower, upper) => ({ lower, upper }) },
        process: { env: { NEXT_PUBLIC_SUPABASE_URL: environment } },
      },
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
test('확정은 필수 항목을 검사하고 선택 항목은 비어 있어도 저장', () => {
  const values = emptyValues();
  for (const key of Object.keys(model.requiredFields)) values[key] = '작성';
  Object.assign(values, schoolValues);
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
      values: {
        ...values,
        ...(studyMode
          ? { problemSource: 'unknown' }
          : { recordType: '창체', recordArea: '영어' }),
      },
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
    values: { ...saved.values, [topicKey]: '새 주제' },
  });
  await assert.rejects(api.saveDraft('A', saved), /다른 탭/);
  await api.removeDraft('A', changed);
  assert.equal(api.readDrafts('A').length, 0);
});
test('저장 공간 부족 시 기존 임시저장을 보존', async () => {
  const h = storageHarness();
  const d = make();
  d.values[topicKey] = '기존';
  const saved = await h.api.saveDraft('A', d);
  h.fail();
  await assert.rejects(
    h.api.saveDraft('A', {
      ...saved,
      values: { ...saved.values, [topicKey]: '변경' },
    }),
    /공간/,
  );
  assert.equal(h.api.readDrafts('A')[0].values[topicKey], '기존');
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
  d.values[studyMode ? 'practiceGuide' : 'story'] = '수정 중';
  const saved = await api.saveDraft('A', d);
  assert.equal(saved.revision, 4);
  assert.equal(saved.status, 'draft');
  assert.equal(d.status, 'confirmed');
});
test('손상된 임시저장은 조용히 버리거나 덮어쓰지 않음', async () => {
  const h = storageHarness();
  const d = make();
  d.values[topicKey] = '주제';
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
      [`@/lib/${block}/storage-model`]: model,
      [`@/lib/${block}/payload-size`]: payload,
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
  await assert.rejects(
    api[studyMode ? 'confirmStudy' : 'confirmExploration']('A', d, saveId),
    /offline/,
  );
  await api[studyMode ? 'confirmStudy' : 'confirmExploration']('A', d, saveId);
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
  let lastQuery;
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
    rpc: async (name, params) => {
      rpcCalls++;
      if (name === `read_${block}_page`) {
        lastQuery = params;
        if (params.p_scope === 'own') filters.push(['owner_id', userId]);
        return {
          data: {
            activities: rows.slice(0, 10),
            total: rows.length,
            page: 1,
            pageSize: 10,
          },
          error: rpcError,
        };
      }
      return { data: {}, error: rpcError };
    },
  };
  const api = load(
    `app/api/${block}/[[...path]]/route.ts`,
    {
      '../list-page': load(`app/api/${block}/list-page.ts`, {
        [`@/lib/${block}/list-query`]: load(`lib/${block}/list-query.ts`),
      }),
      'next/headers': { cookies: async () => ({}) },
      zod: require('zod'),
      [`@/lib/${block}/storage-model`]: model,
      [`@/lib/${block}/payload-size`]: payload,
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
    get lastQuery() {
      return lastQuery;
    },
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
      new Request(`http://localhost/api/${block}/` + randomUUID(), {
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
    new Request(`http://localhost/api/${block}/` + randomUUID(), {
      method: 'PUT',
      headers: { origin: 'https://evil.test' },
      body: '{}',
    }),
    { params: Promise.resolve({ path: [randomUUID()] }) },
  );
  assert.equal(r.status, 403);
});
test('API 목록은 도메인별 조회 계약과 본인 필터를 유지', async () => {
  const rows = Array.from({ length: 501 }, () => ({ id: randomUUID() }));
  const userId = randomUUID();
  const h = apiHarness({ role: 'consultant', userId, rows });
  const r = await h.api.GET(new Request(`http://localhost/api/${block}`), {
    params: Promise.resolve({}),
  });
  assert.equal((await r.json()).activities.length, 10);
  assert.equal(
    h.filters.filter(([key, value]) => key === 'owner_id' && value === userId)
      .length,
    1,
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
      new Request(`http://localhost/api/${block}/` + id, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: [id] }) },
    );
  assert.equal((await put()).status, 400);
  assert.equal(h.rpcCalls, 0);
  for (const key of Object.keys(model.requiredFields))
    body.values[key] = '작성';
  Object.assign(body.values, schoolValues);
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
      new Request(`http://localhost/api/${block}`),
      { params: Promise.resolve({}) },
    );
    assert.equal(response.status, 200);
    assert.equal(h.lastQuery.p_own_only, ownOnly);
  }
});

test('질문 첨부용 own scope는 리드·관리자도 본인만 조회', async () => {
  for (const role of ['consultant', 'consultant_lead', 'admin']) {
    const userId = randomUUID();
    const h = apiHarness({ role, userId });
    const response = await h.api.GET(
      new Request(`http://localhost/api/${block}?scope=own`),
      { params: Promise.resolve({}) },
    );
    assert.equal(response.status, 200);
    assert.equal(
      h.filters.some(([key, value]) => key === 'owner_id' && value === userId),
      true,
    );
  }
});

if (studyMode) {
  test('학습법의 과목명은 모든 과목에 선택 입력하고 문제 출처는 필수', () => {
    const values = emptyValues();
    for (const key of Object.keys(model.requiredFields)) values[key] = '작성';
    Object.assign(values, {
      category: '내신',
      subject: '수학',
      customSubject: '확률과 통계',
      problemSource: 'self',
    });
    const payload = {
      id: randomUUID(),
      saveId: randomUUID(),
      expectedRevision: 0,
      values,
      reports: [],
    };
    assert.equal(model.confirmRequestSchema.safeParse(payload).success, true);
    for (const subject of ['국어', '영어', '수학', '사회', '과학', '기타']) {
      assert.equal(
        model.confirmRequestSchema.safeParse({
          ...payload,
          values: { ...values, subject, customSubject: '' },
        }).success,
        true,
      );
    }
    for (const source of ['self', 'student', 'template'])
      assert.equal(
        model.confirmRequestSchema.safeParse({
          ...payload,
          values: { ...values, problemSource: source },
        }).success,
        true,
      );
    for (const source of ['', 'unknown'])
      assert.equal(
        model.confirmRequestSchema.safeParse({
          ...payload,
          values: { ...values, problemSource: source },
        }).success,
        false,
      );
  });
  test('기존 확정본과 임시저장의 내용은 보존하고 과목만 새 분류로 읽는다', () => {
    const legacy = {
      ...emptyValues(),
      subject: '직접 입력',
      customSubject: '확률과 통계',
      problem: '기존 내용',
    };
    delete legacy.problemSource;
    const restored = model.valuesSchema.parse(legacy);
    assert.equal(restored.subject, '기타');
    assert.equal(restored.customSubject, '확률과 통계');
    assert.equal(restored.problem, '기존 내용');
    assert.equal(restored.problemSource, '');
    assert.equal(
      model.missingFields(restored).some(([key]) => key === 'problemSource'),
      true,
    );
  });
}

if (studyMode) {
  test('선택 제목은 임시저장 후 복원하고 제목 없는 기존 데이터도 읽는다', async () => {
    const { api } = storageHarness();
    const draft = make();
    draft.values.title = '나만의 학습법';
    assert.equal(model.hasInput(draft), true);
    await api.saveDraft('A', draft);
    assert.equal(api.readDrafts('A')[0].values.title, draft.values.title);
    const { title: _title, ...legacy } = draft.values;
    assert.equal(model.valuesSchema.parse(legacy).title, '');
    assert.equal(
      model.valuesSchema.safeParse({ ...legacy, title: 123 }).success,
      false,
    );
    assert.equal(
      model.valuesSchema.safeParse({ ...legacy, title: '가'.repeat(101) })
        .success,
      false,
    );
    const { studyTitle } = load(domain + 'fields.ts');
    assert.equal(
      studyTitle({ ...draft.values, strategy: '기존 전략' }),
      '나만의 학습법',
    );
    assert.equal(
      studyTitle({ ...draft.values, title: '  ', strategy: '기존 전략' }),
      '기존 전략',
    );
    assert.equal(studyTitle({ ...legacy, strategy: '기존 전략' }), '기존 전략');
  });
}

if (studyMode) {
  test('학습법 전체 UTF-8 크기는 JSONB 공백과 한글·이스케이프를 포함한다', () => {
    assert.equal(
      payload.studyValuesBytes({ a: '가\n"\\', b: ['나', true] }),
      Buffer.byteLength('{"a": "가\\n\\"\\\\", "b": ["나", true]}'),
    );
  });
  test('필드별 길이가 유효해도 전체 크기를 넘으면 API가 RPC 전에 구체적 안내로 거절한다', async () => {
    const h = apiHarness();
    const id = randomUUID();
    const values = emptyValues();
    for (const key of Object.keys(model.requiredFields)) values[key] = '작성';
    Object.assign(values, schoolValues);
    values.references = Array.from({ length: 18 }, () => ({
      clientKey: randomUUID(),
      title: 'a'.repeat(50000),
      selection: 'a'.repeat(50000),
      usage: 'a'.repeat(50000),
    }));
    assert.ok(
      payload.studyValuesBytes(values) > payload.MAX_STUDY_VALUES_BYTES,
    );
    const response = await h.api.PUT(
      new Request('http://localhost/api/study/' + id, {
        method: 'PUT',
        body: JSON.stringify({
          id,
          saveId: randomUUID(),
          expectedRevision: 0,
          values,
          reports: [],
        }),
      }),
      { params: Promise.resolve({ path: [id] }) },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, payload.STUDY_SIZE_ERROR);
    assert.equal(h.rpcCalls, 0);
  });
}

test('context lookup does not fetch bodies; reference lookup remains one scoped row', async () => {
  const id = randomUUID();
  const h = apiHarness({ role: 'consultant' });
  const read = (params) =>
    h.api.GET(new Request(`http://localhost/api/${block}?${params}`), {
      params: Promise.resolve({}),
    });
  assert.equal((await read('mode=context')).status, 200);
  assert.equal(h.rpcCalls, 0);
  assert.equal(h.filters.length, 0);
  assert.equal((await read(`reference=${id}`)).status, 200);
  assert.ok(h.filters.some(([key, value]) => key === 'id' && value === id));
  assert.ok(!h.filters.some(([key]) => key === 'owner_id'));
  assert.equal((await read(`reference=${id}&scope=own`)).status, 200);
  assert.ok(h.filters.some(([key]) => key === 'owner_id'));
  assert.equal(h.rpcCalls, 0);
});
test('table POST rejects cross-origin requests before calling the query RPC', async () => {
  const h = apiHarness();
  const response = await h.api.POST(
    new Request(`http://localhost/api/${block}?mode=table`, {
      method: 'POST',
      headers: { origin: 'https://other.test' },
      body: '{}',
    }),
    { params: Promise.resolve({}) },
  );
  assert.equal(response.status, 403);
  assert.equal(h.rpcCalls, 0);
});

if (!studyMode) {
  const validValues = () => {
    const values = emptyValues();
    for (const key of Object.keys(model.requiredFields)) values[key] = '작성';
    return Object.assign(values, schoolValues);
  };
  const oversizedValues = () => ({
    ...validValues(),
    references: Array.from({ length: 6 }, () => ({
      clientKey: randomUUID(),
      title: '가'.repeat(50000),
      selection: '나'.repeat(50000),
      usage: '다'.repeat(50000),
    })),
  });
  const report = () => ({
    clientKey: randomUUID(),
    name: '첨부.pdf',
    size: 10,
    type: 'application/pdf',
    lastModified: 1,
    file: { name: '첨부.pdf', size: 10 },
  });
  const prefix = (id, user = 'A', env = 'http://local.test') =>
    `mea:exploration:v1:${env}:${user}:${id}:`;

  test('탐구 본문 JSONB UTF-8 크기와 정확한 제한 경계를 검사한다', () => {
    assert.equal(
      payload.explorationValuesBytes({ a: '가\n"\\', b: ['나', true] }),
      Buffer.byteLength('{"a": "가\\n\\"\\\\", "b": ["나", true]}'),
    );
    const values = validValues();
    values.references = Array.from({ length: 20 }, () => ({
      clientKey: randomUUID(),
      title: '',
      selection: '',
      usage: '',
    }));
    let remaining =
      payload.MAX_EXPLORATION_VALUES_BYTES -
      payload.explorationValuesBytes(values);
    for (const reference of values.references)
      for (const key of ['title', 'selection', 'usage']) {
        const count = Math.min(remaining, 50000);
        reference[key] = 'a'.repeat(count);
        remaining -= count;
      }
    const request = {
      id: randomUUID(),
      saveId: randomUUID(),
      expectedRevision: 0,
      values,
      reports: [],
    };
    assert.equal(remaining, 0);
    assert.equal(
      payload.explorationValuesBytes(values),
      payload.MAX_EXPLORATION_VALUES_BYTES,
    );
    assert.equal(model.confirmRequestSchema.safeParse(request).success, true);
    values.references.at(-1).usage += 'a';
    assert.equal(model.confirmRequestSchema.safeParse(request).success, false);
  });
  test('초과 본문은 API에서 RPC 전에 구체적인 크기 오류로 거절한다', async () => {
    const h = apiHarness();
    const id = randomUUID();
    const values = oversizedValues();
    assert.equal(model.valuesSchema.safeParse(values).success, true);
    const response = await h.api.PUT(
      new Request(`http://localhost/api/exploration/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          id,
          saveId: randomUUID(),
          expectedRevision: 0,
          values,
          reports: [],
        }),
      }),
      { params: Promise.resolve({ path: [id] }) },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, payload.EXPLORATION_SIZE_ERROR);
    assert.equal(h.rpcCalls, 0);
  });
  test('초과 본문은 파일 업로드와 HTTP 요청 전에 거절하고 입력을 보존한다', async () => {
    let connections = 0,
      requests = 0;
    const api = load(
      base + 'api-client.ts',
      {
        '@/lib/exploration/storage-model': model,
        '@/lib/exploration/payload-size': payload,
        '@/lib/supabase/client': {
          createClient: () => {
            connections++;
            throw new Error('unexpected upload');
          },
        },
      },
      {
        fetch: () => {
          requests++;
          throw new Error('unexpected request');
        },
      },
    );
    const activity = {
      ...make(),
      values: oversizedValues(),
      reports: [report()],
    };
    const before = JSON.stringify(activity);
    await assert.rejects(api.confirmExploration('A', activity, randomUUID()), {
      message: payload.EXPLORATION_SIZE_ERROR,
    });
    assert.equal(connections, 0);
    assert.equal(requests, 0);
    assert.equal(JSON.stringify(activity), before);
  });
  test('제거된 첨부와 과거 고아 파일을 정리하되 계정·환경·활동 범위를 보존한다', async () => {
    const h = storageHarness();
    const a = { ...make(), reports: [report(), report()] };
    a.values.topic = '첨부 검사';
    const saved = await h.api.saveDraft('A', a);
    const p = prefix(a.clientKey);
    const keptKey = p + a.reports[1].clientKey;
    h.files.set(p + 'orphan', {});
    const protectedKeys = [
      prefix(a.clientKey, 'B') + 'other',
      prefix(a.clientKey, 'A', 'http://other.test') + 'other',
      prefix(randomUUID()) + 'other',
    ];
    for (const key of protectedKeys) h.files.set(key, {});
    const next = await h.api.saveDraft('A', {
      ...saved,
      reports: [a.reports[1]],
    });
    assert.equal(h.files.has(p + a.reports[0].clientKey), false);
    assert.equal(h.files.has(p + 'orphan'), false);
    assert.equal(h.files.has(keptKey), true);
    h.files.set(p + 'old-unlisted', {});
    await h.api.removeDraft('A', next);
    assert.equal(h.data.size, 0);
    assert.deepEqual([...h.files.keys()].sort(), protectedKeys.sort());
  });
  test('본문 저장 실패 시 이전 첨부와 초안은 유지하고 실패한 신규 파일만 정리한다', async () => {
    const h = storageHarness();
    const original = { ...make(), reports: [report()] };
    const saved = await h.api.saveDraft('A', original);
    const before = [...h.data];
    h.fail();
    await assert.rejects(
      h.api.saveDraft('A', { ...saved, reports: [report()] }),
      /저장 공간/,
    );
    assert.deepEqual([...h.data], before);
    assert.deepEqual(
      [...h.files.keys()],
      [prefix(original.clientKey) + original.reports[0].clientKey],
    );
    assert.equal(
      (await h.api.restoreFiles('A', saved)).reports[0].file,
      original.reports[0].file,
    );
  });
  test('다른 탭의 저장이 먼저 끝나면 오래된 수정/삭제가 최신 파일을 지우지 않는다', async () => {
    const h = storageHarness();
    const a = { ...make(), reports: [report()] };
    const saved = await h.api.saveDraft('A', a);
    const replacement = report();
    const outcomes = await Promise.allSettled([
      h.api.saveDraft('A', { ...saved, reports: [replacement] }),
      h.api.removeDraft('A', saved),
    ]);
    assert.equal(outcomes[0].status, 'fulfilled');
    assert.equal(outcomes[1].status, 'rejected');
    await assert.rejects(h.api.saveDraft('A', saved), /다른 탭/);
    assert.deepEqual(
      [...h.files.keys()],
      [prefix(a.clientKey) + replacement.clientKey],
    );
  });
  test('Web Locks 없는 환경은 경쟁 중인 파일을 추측해 삭제하지 않는다', async () => {
    const h = storageHarness({ locks: false });
    const a = { ...make(), reports: [report()] };
    const saved = await h.api.saveDraft('A', a);
    h.files.set(prefix(a.clientKey) + 'in-flight', {});
    await h.api.removeDraft('A', saved);
    assert.equal(h.files.size, 2);
  });
}
