import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { z } from 'zod';

import { loadQuestionModule } from './helpers/load-question-module.mjs';

function setup({ role = 'consultant_lead', error = null } = {}) {
  const calls = [];
  const mocks = {
    zod: { z },
    'next/headers': { cookies: async () => ({}) },
    '@/lib/auth': {
      getUserAccess: async () => ({
        user: { id: 'actor' },
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
            error,
            data: {
              counts: { [args.p_question_ids[0]]: 1005 },
              unreadCounts: { [args.p_question_ids[0]]: 1004 },
            },
          };
        },
      }),
    },
  };
  const api = loadQuestionModule(
    'app/api/question-reviews/route.ts',
    { Response, URL },
    (name) => mocks[name],
  );
  return {
    calls,
    get: (ids) =>
      api.GET(
        new Request(
          'https://example.test/api/question-reviews?questions=' +
            ids.join(','),
        ),
      ),
  };
}
test('review totals and unread totals come from a single aggregate RPC', async () => {
  const app = setup(),
    id = randomUUID();
  const response = await app.get([id, id]);
  const result = await response.json();
  assert.equal(result.counts[id], 1005);
  assert.equal(result.unreadCounts[id], 1004);
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].name, 'question_review_counts');
  assert.deepEqual(Array.from(app.calls[0].args.p_question_ids), [id]);
});
test('bad input and consultants never reach review aggregates', async () => {
  for (const ids of [[], ['invalid'], Array.from({ length: 11 }, randomUUID)]) {
    const app = setup();
    assert.equal((await app.get(ids)).status, 400);
    assert.equal(app.calls.length, 0);
  }
  const app = setup({ role: 'consultant' });
  assert.equal((await app.get([randomUUID()])).status, 403);
  assert.equal(app.calls.length, 0);
});
test('aggregate failure stays an error instead of a false zero', async () => {
  const app = setup({ error: { message: 'offline' } });
  assert.equal((await app.get([randomUUID()])).status, 503);
});
