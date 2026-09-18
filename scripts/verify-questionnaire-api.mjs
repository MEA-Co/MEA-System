import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = '@/app/(private)/dashboard/_views/questionnaire/lib/';
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function route({
  role = 'admin',
  visibleRole = role,
  authenticated = true,
  service = {},
  rpc = async () => ({ error: null }),
} = {}) {
  const calls = [];
  const functions = {};
  for (const name of [
    'loadAnswers',
    'loadAnswerStatuses',
    'saveAnswers',
    'manageQuestionnaireExplanation',
    'addQuestionnaireExplanation',
    'loadQuestionnaireView',
    'saveQuestionnaireDraft',
    'deleteQuestionnaireDraft',
    'publishQuestionnaireDraft',
    'manageQuestionnaireReview',
  ]) {
    functions[name] = async (...args) => {
      calls.push([name, ...args]);
      return service[name] ? service[name](...args) : {};
    };
  }
  const imports = {
    zod: require('zod'),
    'next/headers': { cookies: async () => ({}) },
    [`${root}http-error`]: { QuestionnaireHttpError: HttpError },
    [`${root}server`]: functions,
    [`${root}answers-server`]: functions,
    [`${root}publication-notifications`]: {
      loadUnreadQuestionnairePublications: async (distributed) => [
        distributed ? 'distributed-new' : 'unread',
      ],
    },
    '@/lib/admin': { getViewRole: async () => visibleRole },
    '@/lib/auth': {
      getUserAccess: async () => ({
        user: authenticated ? { id: 'user' } : null,
        role,
        isOnboarded: true,
      }),
    },
    '@/lib/supabase/server': {
      createClient: () => ({
        rpc,
        from: () => {
          const builder = {
            select: () => builder,
            eq: () => builder,
            maybeSingle: async () => ({ data: { id: 'review' }, error: null }),
          };
          return builder;
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync('app/api/questionnaires/[[...path]]/route.ts', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Response,
      TextEncoder,
      URL,
      require: (name) => {
        assert.ok(name in imports, `Unexpected ${name}`);
        return imports[name];
      },
    },
  );
  async function request(method, path = [], body, headers = {}) {
    const req = new Request(
      `https://example.test/api/questionnaires/${path.join('/')}`,
      {
        method,
        headers: {
          ...(body === undefined
            ? {}
            : {
                'Content-Type': 'application/json',
                origin: 'https://example.test',
              }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    return exports[method](req, { params: Promise.resolve({ path }) });
  }
  return { request, calls };
}

test('REST returns JSON auth failures and never invokes mutations for consultant/student or cross-origin callers', async () => {
  assert.equal(
    (await route({ authenticated: false }).request('GET')).status,
    401,
  );
  assert.equal((await route({ role: 'student' }).request('GET')).status, 403);
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const client = route({ role: 'consultant' });
    assert.equal(
      (await client.request(method, [randomUUID()], {})).status,
      403,
    );
    assert.equal(client.calls.length, 0);
  }
  const client = route();
  assert.equal(
    (await client.request('POST', [], {}, { origin: 'https://evil.test' }))
      .status,
    403,
  );
  assert.equal(client.calls.length, 0);
  const preview = route({ role: 'admin', visibleRole: 'consultant' });
  assert.deepEqual(await (await preview.request('GET', ['unread'])).json(), [
    'distributed-new',
  ]);
  assert.equal((await preview.request('GET', ['new'])).status, 403);
});

test('creation/update keep stable identities and report revision conflicts as HTTP 409', async () => {
  const id = randomUUID();
  const client = route({
    service: {
      saveQuestionnaireDraft: async () => ({
        ok: true,
        revision: 1,
        savedAt: 'now',
      }),
    },
  });
  assert.equal(
    (
      await client.request('POST', [], {
        document: { versionId: id },
        expectedRevision: 0,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await client.request('PUT', [id], {
        document: { versionId: randomUUID() },
        expectedRevision: 1,
      })
    ).status,
    400,
  );
  assert.equal(client.calls.length, 1);
  const conflict = route({
    service: {
      saveQuestionnaireDraft: async () => ({
        ok: false,
        code: 'conflict',
        error: 'changed',
      }),
    },
  });
  assert.equal(
    (
      await conflict.request('PUT', [id], {
        document: { versionId: id },
        expectedRevision: 1,
      })
    ).status,
    409,
  );
});

test('every workflow command uses its REST resource and deletion/errors are not cached', async () => {
  const id = randomUUID();
  const reviewId = randomUUID();
  const client = route({
    service: { deleteQuestionnaireDraft: async () => ({ mode: 'deleted' }) },
  });
  for (const resource of ['publication', 'distribution']) {
    assert.equal(
      (await client.request('POST', [id, resource], { revision: 3 })).status,
      200,
    );
  }
  assert.equal(client.calls[0][2], 'publish');
  assert.equal(client.calls[1][2], 'distribute');
  await client.request('POST', [id, 'reviews'], {
    id: reviewId,
    questionId: id,
    description: '설명',
  });
  await client.request('PATCH', [id, 'reviews', reviewId], { resolved: true });
  assert.equal(client.calls[2][2], 'request');
  assert.equal(client.calls[2][1].questionId, id);
  assert.equal(client.calls[2][1].title, undefined);
  assert.equal(client.calls[3][2], 'resolve');
  assert.equal((await client.request('PUT', [id, 'read'], {})).status, 200);
  const removed = await client.request('DELETE', [id], { revision: 3 });
  assert.equal(removed.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await removed.json(), { mode: 'deleted' });
  const missing = route({
    service: {
      loadQuestionnaireView: async () => {
        throw new HttpError(404, 'deleted');
      },
    },
  });
  const response = await missing.request('GET', [id]);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'deleted' });
});

test('explanations use their own resource and remain restricted to staff', async () => {
  const id = randomUUID();
  const payload = {
    id: randomUUID(),
    questionId: randomUUID(),
    title: '추가 설명',
    description: '내용',
    visibleToConsultants: false,
  };
  const client = route();
  assert.equal(
    (await client.request('POST', [id, 'explanations'], payload)).status,
    200,
  );
  assert.equal(client.calls[0][0], 'addQuestionnaireExplanation');
  assert.equal(client.calls[0][1].title, payload.title);
  assert.equal(client.calls[0][1].versionId, id);
  const consultant = route({ role: 'consultant' });
  assert.equal(
    (await consultant.request('POST', [id, 'explanations'], payload)).status,
    403,
  );
  assert.equal(consultant.calls.length, 0);
});

test('explanation updates and deletes bind the path IDs and preserve revision', async () => {
  const version = randomUUID(),
    explanation = randomUUID();
  const client = route();
  assert.equal(
    (
      await client.request('PATCH', [version, 'explanations', explanation], {
        id: randomUUID(),
        versionId: randomUUID(),
        revision: 4,
        title: '수정',
        description: '본문',
        visibleToConsultants: false,
      })
    ).status,
    200,
  );
  assert.equal(client.calls[0][0], 'manageQuestionnaireExplanation');
  assert.equal(client.calls[0][1].id, explanation);
  assert.equal(client.calls[0][1].versionId, version);
  assert.equal(client.calls[0][2], 'update');
  assert.equal(
    (
      await client.request('DELETE', [version, 'explanations', explanation], {
        revision: 4,
      })
    ).status,
    200,
  );
  assert.equal(client.calls[1][2], 'delete');
});

test('consultants can save their response and read distribution notifications without gaining staff mutations', async () => {
  const id = randomUUID();
  const client = route({ role: 'consultant' });
  assert.equal((await client.request('GET', [id, 'answers'])).status, 200);
  assert.equal((await client.request('GET', ['responses'])).status, 200);
  assert.equal(
    (
      await client.request('PUT', [id, 'answers'], {
        revision: 0,
        answers: {},
        saveId: randomUUID(),
        complete: false,
      })
    ).status,
    200,
  );
  assert.equal(
    client.calls.filter((call) => call[0] === 'saveAnswers').length,
    1,
  );
  assert.equal(
    (
      await client.request(
        'PUT',
        [id, 'answers'],
        {},
        { origin: 'https://evil.test' },
      )
    ).status,
    403,
  );
  assert.equal((await client.request('POST', [id, 'reviews'], {})).status, 403);
  assert.equal(
    (await client.request('POST', [id, 'distribution'], {})).status,
    403,
  );
  assert.equal((await client.request('PUT', [id, 'read'], {})).status, 200);
});
