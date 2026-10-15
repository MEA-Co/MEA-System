import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
const root = 'app/(private)/dashboard/_views/questions/';
function server({ role = 'consultant_lead', rpcError = null } = {}) {
  const calls = [];
  const loaded = loadQuestionModule(
    root + 'lib/reviews/server.ts',
    { Response, URL },
    (name) =>
      ({
        zod: { z },
        'next/headers': { cookies: async () => ({}) },
        '@/lib/auth': {
          getUserAccess: async () => ({
            user: { id: 'owner' },
            role,
            isOnboarded: true,
          }),
        },
        '@/lib/admin': { getViewRole: async () => role },
        '@/lib/supabase/server': {
          createClient: () => ({
            rpc: async (name, args) => {
              calls.push({ name, args });
              return {
                data: { reviews: [], completedCount: 0 },
                error: rpcError,
              };
            },
          }),
        },
      })[name],
  );
  const qid = randomUUID();
  return {
    calls,
    run: (method, body, query = '') =>
      loaded.handleQuestionReview(
        new Request('http://localhost/api/question-reviews/' + qid + query, {
          method,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
        { params: Promise.resolve({ questionId: qid }) },
      ),
  };
}
test('successful mutations return only their acknowledgement without fallible follow-up reads', async () => {
  for (const [method, body, rpc] of [
    [
      'POST',
      { id: randomUUID(), description: '검토 내용' },
      'request_question_review',
    ],
    ['PATCH', { id: randomUUID() }, 'resolve_question_review'],
    ['PUT', { ids: [randomUUID()] }, 'mark_question_reviews_read'],
  ]) {
    const app = server();
    const response = await app.run(method, body);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(
      app.calls.map((c) => c.name),
      [rpc],
    );
  }
});
test('GET uses one paged read and validates history page', async () => {
  const app = server();
  const origin = randomUUID();
  assert.equal(
    (
      await app.run(
        'GET',
        undefined,
        `?completed=true&page=2&originQuestionnaireId=${origin}`,
      )
    ).status,
    200,
  );
  assert.equal(app.calls[0].name, 'read_question_review_page');
  assert.equal(app.calls[0].args.page, 2);
  assert.equal(app.calls[0].args.completed, true);
  assert.equal(app.calls[0].args.origin_id, null);
  assert.equal((await app.run('GET', undefined, '?page=0')).status, 400);
  assert.equal(app.calls.length, 1);
});
test('legacy questionnaire context is ignored on question-owned reviews', async () => {
  const app = server();
  const body = {
    id: randomUUID(),
    description: '검토',
    originQuestionnaireId: randomUUID(),
  };
  assert.equal(
    (await app.run('POST', body, `?originQuestionnaireId=${randomUUID()}`))
      .status,
    200,
  );
  assert.equal(app.calls[0].args.p_origin_questionnaire_id, null);
});
test('review writes keep authorization and database conflict errors', async () => {
  assert.equal((await server({ role: 'consultant' }).run('GET')).status, 403);
  assert.equal(
    (
      await server({ rpcError: { code: '40001' } }).run('PATCH', {
        id: randomUUID(),
      })
    ).status,
    409,
  );
});
const client = loadQuestionModule(
  root + 'lib/reviews/client.ts',
  { crypto: { randomUUID } },
  () => undefined,
);
test('retry identity depends only on question and unchanged text', () => {
  const q = randomUUID();
  const first = client.prepareReviewSubmission(null, q, '내용');
  assert.equal(client.prepareReviewSubmission(first, q, '내용').id, first.id);
  assert.notEqual(
    client.prepareReviewSubmission(first, randomUUID(), '내용').id,
    first.id,
  );
  assert.notEqual(
    client.prepareReviewSubmission(first, q, '변경').id,
    first.id,
  );
  assert.equal(client.questionReviewUrl(q), `/api/questions/${q}/reviews`);
});
test('visible receipts batch, deduplicate, exclude hidden IDs, and cap each write at 100', async () => {
  const calls = [];
  const batch = client.createReviewReadBatch(async (ids) => calls.push(ids));
  for (let i = 0; i < 205; i++) {
    batch.setVisible(String(i), true);
    batch.setVisible(String(i), true);
  }
  batch.setVisible('204', false);
  assert.equal(await batch.flush(), true);
  assert.deepEqual(
    calls.map((ids) => ids.length),
    [100, 100, 4],
  );
  assert.equal(await batch.flush(), false);
});
test('failed receipt writes remain retryable without re-sending successful chunks', async () => {
  const calls = [];
  let fail = true;
  const batch = client.createReviewReadBatch(async (ids) => {
    calls.push(ids);
    if (fail && ids.includes('100')) throw new Error('offline');
  });
  for (let i = 0; i < 101; i++) batch.setVisible(String(i), true);
  await assert.rejects(batch.flush());
  fail = false;
  await batch.flush();
  assert.deepEqual(
    calls.map((ids) => ids.length),
    [100, 1, 1],
  );
});

function hook({ refreshFails = false, writeFails = false } = {}) {
  const slots = [];
  let index = 0;
  let keyFactory;
  const toasts = [];
  const writes = [];
  const page = {
    reviews: [],
    pendingCount: 0,
    completedCount: 21,
    canRequest: true,
    canResolve: true,
    unreadIds: [],
  };
  const update = async () => {
    if (refreshFails) throw new Error('refresh failed');
    return page;
  };
  const loaded = loadQuestionModule(
    root + 'hooks/useQuestionReviews.ts',
    {
      crypto: { randomUUID },
      fetch: async (url, options) => {
        writes.push({ url, body: JSON.parse(options.body) });
        return {
          ok: !writeFails,
          json: async () => (writeFails ? { error: 'offline' } : { ok: true }),
        };
      },
    },
    (name) =>
      ({
        react: {
          useState(initial) {
            const i = index++;
            if (!(i in slots)) slots[i] = initial;
            return [
              slots[i],
              (value) => {
                slots[i] =
                  typeof value === 'function' ? value(slots[i]) : value;
              },
            ];
          },
          useRef(value) {
            return (slots[index++] ??= { current: value });
          },
          useCallback: (fn) => fn,
          useEffectEvent: (fn) => fn,
          useEffect() {},
        },
        swr: {
          default: () => ({ data: page, mutate: update }),
          useSWRConfig: () => ({ mutate: update }),
        },
        'swr/infinite': {
          default: (getKey) => {
            keyFactory = getKey;
            return { data: [], mutate: update, setSize() {} };
          },
        },
        '@/components/ui/toast': {
          toast: {
            add: (v) => {
              toasts.push(v);
              return 'toast';
            },
            update: (_id, v) => toasts.push(v),
          },
        },
        '../lib/questionnaire/api-client': { questionnaireFetcher() {} },
      })[name],
  );
  const qid = randomUUID();
  return {
    writes,
    toasts,
    render() {
      index = 0;
      return loaded.useQuestionReviews(qid, false);
    },
    key: (...args) => keyFactory(...args),
  };
}
test('history has no request key until expanded and stops at the last page', () => {
  const app = hook();
  let state = app.render();
  assert.equal(app.key(0, null), null);
  state.setHistoryOpen(true);
  state = app.render();
  assert.match(app.key(0, null), /completed=true&page=1/);
  assert.equal(app.key(1, { hasMore: false }), null);
  state.setHistoryOpen(false);
  app.render();
  assert.equal(app.key(0, null), null);
});
test('successful write survives refresh failure, clears the form, and reports refresh separately', async () => {
  const app = hook({ refreshFails: true });
  let state = app.render();
  state.setDescription('검토');
  state.setEditing(true);
  state = app.render();
  await state.submit();
  state = app.render();
  assert.equal(state.description, '');
  assert.equal(state.editing, false);
  assert.equal(app.writes.length, 1);
  assert.ok(app.toasts.some((t) => t.type === 'success'));
  assert.ok(app.toasts.some((t) => t.title.includes('저장은 완료했지만')));
});
test('uncertain write preserves input and uses the same request ID on retry', async () => {
  const app = hook({ writeFails: true });
  let state = app.render();
  state.setDescription('검토');
  state = app.render();
  await state.submit();
  state = app.render();
  assert.equal(state.description, '검토');
  await state.submit();
  assert.equal(app.writes[0].body.id, app.writes[1].body.id);
});
