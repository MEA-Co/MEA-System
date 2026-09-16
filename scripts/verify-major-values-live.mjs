/* eslint-disable no-console -- Standalone verification reports its results. */
// Synthetic conversation smoke test. Uses the real metadata and configured model;
// this is not a study of outcomes with real students.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

import { createClient } from '@supabase/supabase-js';

import {
  appendStudentTurn,
  initialValuesState,
} from '../features/major-values/domain.ts';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return next('next/dist/compiled/server-only/empty.js', context);
    if (
      context.parentURL?.includes('/features/major-values/') &&
      specifier.startsWith('./') &&
      !specifier.endsWith('.ts')
    )
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});
const { generateValuesTurn } =
  await import('../features/major-values/coach.ts');
const { loadValuesMetadata } =
  await import('../features/major-values/metadata-server.ts');
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: majors, error } = await db
  .from('majors')
  .select('id,name')
  .in('name', ['컴퓨터·소프트웨어공학', '심리학', '물리학']);
assert.ifError(error);
assert.equal(majors.length, 3);
function interest(id, majorName, rank, keyword) {
  return {
    id,
    majorId: majors.find((m) => m.name === majorName).id,
    majorName,
    rank,
    keyword,
    keywordId: null,
    priorReason: null,
  };
}
const multi = {
  interests: [
    interest('hci', '컴퓨터·소프트웨어공학', 1, 'HCI'),
    interest('graphics', '컴퓨터·소프트웨어공학', 1, '그래픽'),
    interest('cognition', '심리학', 2, '인지 과정'),
    interest('decisions', '심리학', 2, '의사결정'),
  ],
};
const physics = { interests: [interest('blackhole', '물리학', 1, '블랙홀')] };
const cases = [
  {
    name: '부분 연결과 독립 그래픽',
    context: multi,
    answer:
      'HCI는 사람들이 앱에서 왜 헷갈리는지 이해하고 싶어서요. 사용자 입장에서 이유를 알아가는 게 중요해요. 그래픽은 별개로 그림이 만들어지는 수학 원리 자체가 궁금해요. 심리학 키워드는 아직 잘 모르겠어요.',
    scope: ['hci', 'graphics'],
  },
  {
    name: '블랙홀 이론 설명',
    context: physics,
    answer:
      '블랙홀을 설명하는 이론이 서로 모순 없이 이어지는지 이해하고 싶어요. 원리가 일관되게 설명되는 순간 자체에 의미를 느껴요. 쓸모나 문제 해결 때문은 아니에요.',
    scope: ['blackhole'],
  },
  {
    name: '블랙홀 관측 방법',
    context: physics,
    answer:
      '보이지 않는 블랙홀을 어떻게 관측했다고 판단하는지 궁금해요. 측정 장비의 한계와 관측 근거를 확인해야 주장을 믿을 수 있다고 생각해서요.',
    scope: ['blackhole'],
  },
];
const results = await Promise.all(
  cases
    .filter((item) => !process.argv[2] || item.name.includes(process.argv[2]))
    .map(async (item) => {
      try {
        const metadata = await loadValuesMetadata(db, item.context);
        const before = appendStudentTurn(
          initialValuesState(item.context),
          item.answer,
          item.scope,
        );
        const after = await generateValuesTurn(before, metadata);
        assert.equal(after.observations.length, item.context.interests.length);
        assert.equal(after.pendingTurnId, null);
        if (item.context === multi) {
          assert.equal(after.phase, 'conversation');
          assert.ok(
            !after.hypotheses.some((h) => h.interestIds.includes('graphics')),
            'Curiosity alone must remain a focus, not an assigned value',
          );
        }
        return {
          case: item.name,
          status: 'passed',
          question: after.conversation.at(-1).content,
          observations: after.observations,
          hypotheses: after.hypotheses,
          phase: after.phase,
        };
      } catch (error) {
        return { case: item.name, status: 'failed', error: error.message };
      }
    }),
);
await writeFile(
  '/tmp/major-values-live-results.json',
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
assert.ok(results.every((r) => r.status === 'passed'));
