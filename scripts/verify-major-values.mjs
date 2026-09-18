import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import {
  appendStudentTurn,
  applyValuesReply,
  canConfirmResults,
  canReview,
  createValuesContext,
  decideConnection,
  explorationStatus,
  finishEarly,
  initialValuesState,
  restoreValuesState,
  resultText,
  reviewHypothesis,
  skipInterest,
  uniqueEvidence,
  validateReply,
  valuesReplySchema,
} from '../features/major-values/domain.ts';
registerHooks({
  resolve(specifier, context, next) {
    if (
      context.parentURL?.includes('/features/major-values/') &&
      specifier === './domain'
    )
      return next('./domain.ts', context);
    return next(specifier, context);
  },
});
const { loadValuesSession, saveValuesSession, lastValuesSession } =
  await import('../features/major-values/session.ts');
const allowed = { coreValueIds: [], metadataIds: [], version: 'test-metadata' };
const context = createValuesContext(
  { first: '컴퓨터·소프트웨어공학', second: '심리학' },
  '[컴퓨터·소프트웨어공학]\nHCI\n그래픽\n\n[심리학]\n인지 과정\n의사결정',
);
const [hci, graphics, cognition] = context.interests.map((i) => i.id);
function replyFor(state, nextId = hci) {
  return {
    observations: structuredClone(state.observations),
    hypotheses: [],
    connections: [],
    next: {
      stage: 'focus',
      interestIds: [nextId],
      message: '어떤 부분이 궁금한가요?',
      metadataIds: [],
    },
  };
}
function observation(
  interestId,
  turnId,
  quote,
  direction = '원리를 이해하기',
  reason = '이유를 알아가는 과정이 즐거워서',
) {
  return {
    interestId,
    focus: quote,
    direction,
    reason,
    conditions: [],
    evidence: [{ turnId, quote }],
    openQuestions: [],
  };
}
function hypothesis(id, interestIds, evidence, extra = {}) {
  return {
    id,
    interestIds,
    statement: '원리를 알아가는 과정 자체에 의미를 둔다.',
    coreValueIds: [],
    basis: 'student-explicit',
    pattern: 'specific',
    evidence,
    conditions: [],
    revisionEvidence: [],
    ...extra,
  };
}
function answered(
  ctx = context,
  target = hci,
  answer = '앱에서 사람들이 왜 헷갈리는지 이해하는 과정이 좋아요.',
) {
  const state = appendStudentTurn(initialValuesState(ctx), answer, [target]);
  const reply = replyFor(state, target);
  const obs = observation(target, state.pendingTurnId, answer);
  reply.observations = reply.observations.map((o) =>
    o.interestId === target ? obs : o,
  );
  reply.hypotheses = [hypothesis('h1', [target], obs.evidence)];
  return { state, reply };
}

test('부분적으로 연결되는 복수 전공: 그래픽 누락·억지 통합·조기 자동 종료를 거절한다', () => {
  const { state, reply } = answered();
  assert.throws(
    () =>
      validateReply(
        {
          ...reply,
          observations: reply.observations.filter(
            (o) => o.interestId !== graphics,
          ),
        },
        state,
        allowed,
      ),
    /누락/,
  );
  assert.throws(
    () =>
      validateReply(
        { ...reply, next: { ...reply.next, stage: 'review' } },
        state,
        allowed,
      ),
    /다루지 않은/,
  );
  const merged = {
    ...reply,
    hypotheses: [
      hypothesis('h1', [hci, graphics], reply.hypotheses[0].evidence),
    ],
  };
  assert.throws(() => validateReply(merged, state, allowed));
  const next = applyValuesReply(state, reply, allowed);
  assert.equal(explorationStatus(next, graphics), 'unexplored');
  assert.equal(next.context.interests.length, 4);
});

test('관련 없는 기계공학 F1과 역사학 중세 생활사는 독립 결과로 유지한다', () => {
  const ctx = createValuesContext(
    { first: '기계공학', second: '역사학' },
    '[기계공학]\nF1\n\n[역사학]\n중세 생활사',
  );
  let state = initialValuesState(ctx);
  state = {
    ...appendStudentTurn(
      state,
      'F1에서 힘과 속도의 관계를 이해하는 과정이 좋아요.',
      [ctx.interests[0].id],
    ),
    pendingTurnId: null,
  };
  state = appendStudentTurn(
    state,
    '중세 생활사는 당시 사람들 관점으로 삶을 해석하고 싶어서요.',
    [ctx.interests[1].id],
  );
  const turns = state.conversation.filter((t) => t.role === 'student');
  const reply = replyFor(state);
  reply.observations = ctx.interests.map((i, index) =>
    observation(i.id, turns[index].id, turns[index].content),
  );
  reply.hypotheses = reply.observations.map((o, index) =>
    hypothesis(`h${index}`, [o.interestId], o.evidence),
  );
  reply.next = { ...reply.next, stage: 'review', interestIds: [] };
  const next = applyValuesReply(state, reply, allowed);
  assert.equal(next.phase, 'review');
  assert.equal(next.hypotheses.length, 2);
  assert.equal(next.connections.length, 0);
});

test('동일한 블랙홀 키워드의 다른 이유를 각각의 학생 발언으로 유지한다', () => {
  const ctx = createValuesContext({ first: '물리학' }, '블랙홀');
  const reasons = [
    '블랙홀을 이론으로 설명할 때 모순 없는 원리를 이해하는 것이 좋아요.',
    '블랙홀을 어떻게 관측할 수 있는지, 측정의 근거를 확인하는 것이 좋아요.',
  ];
  const outputs = reasons.map((reason) => {
    const { state, reply } = answered(ctx, ctx.interests[0].id, reason);
    reply.observations[0].reason = reason;
    return applyValuesReply(state, reply, allowed);
  });
  assert.notEqual(
    outputs[0].observations[0].reason,
    outputs[1].observations[0].reason,
  );
  assert.equal(outputs[0].context.interests[0].keyword, '블랙홀');
});

test('동일 문자열도 전공·순위별 원문과 관심사 ID를 분리한다', () => {
  const ctx = createValuesContext(
    { first: '컴퓨터공학', second: '심리학' },
    '[컴퓨터공학]\n인지\n그래픽\n\n[심리학]\n인지',
  );
  assert.equal(ctx.interests.length, 3);
  assert.notEqual(ctx.interests[0].id, ctx.interests[2].id);
  assert.equal(ctx.interests[2].rank, 2);
  assert.equal(ctx.interests[0].keywordId, null);
});

test('순수 탐구·사전에 없는 개인 표현도 문제 해결과 core value 태그 없이 허용한다', () => {
  const ctx = createValuesContext({ first: '수학' }, '낯선 풀이');
  const { state, reply } = answered(
    ctx,
    ctx.interests[0].id,
    '낯선 풀이가 익숙한 공식으로 이어질 때의 뜻밖의 느낌 자체가 좋아요.',
  );
  reply.hypotheses[0].statement =
    '낯선 풀이가 익숙한 공식과 이어질 때의 뜻밖의 느낌을 소중하게 여긴다.';
  const next = applyValuesReply(state, reply, allowed);
  assert.deepEqual(next.hypotheses[0].coreValueIds, []);
  assert.match(next.hypotheses[0].statement, /뜻밖의 느낌/);
});

test('하나의 발언을 여러 관심의 독립 근거로 중복 계산하지 않는다', () => {
  let state = appendStudentTurn(
    initialValuesState(context),
    'HCI와 인지 과정 모두 사용자의 생각을 이해하고 싶어요.',
    [hci, cognition],
  );
  const evidence = [
    { turnId: state.pendingTurnId, quote: state.conversation.at(-1).content },
  ];
  state = {
    ...state,
    pendingTurnId: null,
    connections: [
      {
        id: 'c1',
        interestIds: [hci, cognition],
        rationale: '사용자 이해',
        evidence,
      },
    ],
  };
  state = decideConnection(state, 'c1', true);
  const reply = replyFor(state);
  reply.observations = reply.observations.map((o) =>
    [hci, cognition].includes(o.interestId)
      ? observation(o.interestId, evidence[0].turnId, evidence[0].quote)
      : o,
  );
  reply.hypotheses = [
    hypothesis('h1', [hci, cognition], [...evidence, ...evidence], {
      pattern: 'common',
    }),
  ];
  assert.throws(() => validateReply(reply, state, allowed), /하나의 발언/);
  assert.equal(uniqueEvidence([...evidence, ...evidence]).length, 1);
});

test('HCI의 답을 심리학에 복제하거나 AI 질문을 학생 근거로 쓰지 못한다', () => {
  const { state, reply } = answered();
  const copy = structuredClone(reply);
  copy.observations = copy.observations.map((o) =>
    o.interestId === cognition
      ? { ...copy.observations[0], interestId: cognition }
      : o,
  );
  assert.throws(() => validateReply(copy, state, allowed), /근거/);
  const invented = structuredClone(reply);
  invented.hypotheses[0].evidence = [
    { turnId: 'opening', quote: state.conversation[0].content },
  ];
  assert.throws(() => validateReply(invented, state, allowed), /학생 발언/);
  invented.hypotheses[0].evidence = [
    { turnId: state.pendingTurnId, quote: '학생이 말하지 않은 환경 보호' },
  ];
  assert.throws(() => validateReply(invented, state, allowed), /학생 발언/);
});

test('조건과 예외, 학생 수정·제외가 최종 결과에 반영된다', () => {
  const { state, reply } = answered();
  reply.hypotheses[0].pattern = 'conditional';
  reply.hypotheses[0].conditions = ['시간이 충분할 때'];
  let next = finishEarly(applyValuesReply(state, reply, allowed));
  next = reviewHypothesis(
    next,
    'h1',
    'edited',
    '빠른 결론보다 근거를 확인하고 싶다.',
    ['시간이 부족하더라도'],
  );
  assert.equal(canConfirmResults(next), false);
  next = reviewHypothesis(next, 'h1', 'confirmed');
  assert.equal(canConfirmResults(next), true);
  assert.match(resultText(next), /시간이 부족하더라도/);
  assert.doesNotMatch(resultText(next), /시간이 충분할 때/);
  next = reviewHypothesis(next, 'h1', 'excluded');
  assert.doesNotMatch(resultText(next), /빠른 결론/);
});

test('잘못 묶인 관심사를 분리하면 공동 가설을 제거하고 재확인 상태로 전환한다', () => {
  let state = initialValuesState(context);
  state.connections = [
    {
      id: 'c1',
      interestIds: [hci, cognition],
      rationale: '공통 관심',
      evidence: [],
    },
  ];
  state.connectionDecisions.c1 = 'confirmed';
  state.hypotheses = [
    hypothesis('merged', [hci, cognition], [{ turnId: 'fake', quote: 'fake' }]),
  ];
  state = decideConnection(state, 'c1', false);
  assert.equal(state.hypotheses.length, 0);
  assert.equal(state.connectionDecisions.c1, 'rejected');
  const reply = replyFor(state);
  reply.connections = [{ ...state.connections[0], id: 'new-id' }];
  assert.throws(() => validateReply(reply, state, allowed), /다시 합칠/);
});

test('이유 부족·건너뛰기·조기 종료는 근거 없는 가설 없이 표시한다', () => {
  let state = initialValuesState(context);
  state = skipInterest(state, graphics, true);
  assert.equal(explorationStatus(state, graphics), 'skipped');
  assert.equal(canReview(state), false);
  state = finishEarly(state);
  assert.equal(canConfirmResults(state), true);
  assert.match(resultText(state), /더 확인/);
  assert.match(resultText(state), /그래픽 \(건너뜀\)/);
  assert.equal(state.hypotheses.length, 0);
});

test('없는 관심사·메타데이터·core value ID와 형식 오류를 거절한다', () => {
  const { state, reply } = answered();
  assert.equal(valuesReplySchema.safeParse({ summary: '완료' }).success, false);
  assert.throws(() =>
    validateReply(
      { ...reply, next: { ...reply.next, interestIds: ['absent'] } },
      state,
      allowed,
    ),
  );
  assert.throws(() =>
    validateReply(
      { ...reply, next: { ...reply.next, metadataIds: ['absent'] } },
      state,
      allowed,
    ),
  );
  reply.hypotheses[0].coreValueIds = ['00000000-0000-4000-8000-000000000001'];
  assert.throws(() => validateReply(reply, state, allowed));
});

test('저장·재개·AI 오류 재시도에서 발언, 초안, 수정 상태를 잃지 않는다', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const { state, reply } = answered();
  assert.equal(saveValuesSession(storage, 'owner-a', state), true);
  const restored = loadValuesSession(storage, 'owner-a', context, '');
  assert.deepEqual(restored, state);
  assert.equal(restored.pendingTurnId, state.pendingTurnId);
  assert.equal(
    loadValuesSession(storage, 'owner-b', context, '').pendingTurnId,
    null,
  );
  assert.throws(() =>
    applyValuesReply(restored, { ...reply, observations: [] }, allowed),
  );
  assert.deepEqual(loadValuesSession(storage, 'owner-a', context, ''), state);
  let next = finishEarly(applyValuesReply(restored, reply, allowed));
  next = reviewHypothesis(next, 'h1', 'edited', '내가 고친 표현');
  saveValuesSession(storage, 'owner-a', next);
  assert.equal(
    loadValuesSession(storage, 'owner-a', context, '').hypothesisDecisions.h1,
    'edited',
  );
  const changed = createValuesContext({ first: '물리학' }, '블랙홀');
  assert.equal(
    restoreValuesState(changed, JSON.stringify(next)).hypotheses.length,
    0,
  );
});

test('이전 단일 초안의 실제 대화를 보존하되 AI 초안을 학생 근거로 승격하지 않는다', () => {
  const ctx = createValuesContext({ first: '물리학' }, '블랙홀');
  const legacy = {
    source: JSON.stringify({ majors: ['물리학'], keywords: '블랙홀' }),
    conversation: [
      { role: 'coach', content: '왜 궁금한가요?' },
      { role: 'student', content: '이론의 일관성이 좋아요.' },
    ],
    input: '추가로',
    summary: 'AI가 쓴 예전 초안',
  };
  const restored = restoreValuesState(ctx, JSON.stringify(legacy));
  assert.equal(restored.conversation[1].content, '이론의 일관성이 좋아요.');
  assert.equal(restored.conversation.at(-1).role, 'coach');
  assert.equal(restored.hypotheses.length, 0);
  assert.equal(restored.input, '추가로');
});

test('계정별 최근 저장 상태를 통해 기존 관심사를 재선택하지 않고 복원한다', () => {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const { state } = answered();
  saveValuesSession(storage, 'a', state);
  assert.deepEqual(lastValuesSession(storage, 'a').context, context);
  assert.equal(lastValuesSession(storage, 'b'), null);
});

test('제외한 해석의 ID만 바꿔 다시 제안하는 것은 차단한다', () => {
  const { state, reply } = answered();
  const excluded = reviewHypothesis(
    applyValuesReply(state, reply, allowed),
    'h1',
    'excluded',
  );
  const recreated = {
    ...reply,
    hypotheses: [{ ...reply.hypotheses[0], id: 'new-id' }],
  };
  assert.throws(
    () => validateReply(recreated, excluded, allowed),
    /제외된 해석/,
  );
});

test('대표 흐름: HCI에서 시작해 연결 확인·그래픽 건너뛰기·공통 결과 학생 확인까지', () => {
  let { state, reply } = answered();
  state = applyValuesReply(state, reply, allowed);
  const firstEvidence = state.observations[0].evidence;
  state = appendStudentTurn(
    state,
    '인지 과정과 의사결정도 실제 사용자가 생각하는 이유를 이해하고 싶어서예요. HCI와 같은 이유로 이어져요.',
    [cognition, context.interests[3].id],
  );
  const secondEvidence = [
    { turnId: state.pendingTurnId, quote: state.conversation.at(-1).content },
  ];
  reply = replyFor(state, cognition);
  reply.observations = reply.observations.map((o) =>
    [cognition, context.interests[3].id].includes(o.interestId)
      ? observation(
          o.interestId,
          secondEvidence[0].turnId,
          secondEvidence[0].quote,
          '사용자 이해',
          '사용자 생각의 이유를 알아가고 싶어서',
        )
      : o,
  );
  reply.hypotheses = state.hypotheses;
  reply.connections = [
    {
      id: 'shared',
      interestIds: [hci, cognition, context.interests[3].id],
      rationale: '실제 사용자의 생각을 이해하려는 관심',
      evidence: secondEvidence,
    },
  ];
  state = applyValuesReply(state, reply, allowed);
  assert.equal(state.connectionDecisions.shared, undefined);
  state = decideConnection(state, 'shared', true);
  state = skipInterest(state, graphics, true);
  state = appendStudentTurn(state, '확인한 연결을 바탕으로 정리해주세요.', [
    hci,
    cognition,
    context.interests[3].id,
  ]);
  reply = replyFor(state);
  reply.connections = state.connections;
  reply.hypotheses = [
    hypothesis(
      'common',
      [hci, cognition, context.interests[3].id],
      [...firstEvidence, ...secondEvidence],
      {
        pattern: 'common',
        statement:
          '실제 사용자의 생각과 경험이 생기는 이유를 이해하는 데 의미를 둔다.',
      },
    ),
  ];
  reply.next = {
    stage: 'review',
    interestIds: [],
    message: '학생 발언을 바탕으로 정리했어요. 내 생각과 맞는지 확인해주세요.',
    metadataIds: [],
  };
  state = applyValuesReply(state, reply, allowed);
  assert.equal(canConfirmResults(state), false);
  state = reviewHypothesis(state, 'common', 'confirmed');
  assert.equal(canConfirmResults(state), true);
  assert.match(resultText(state), /실제 사용자의 생각/);
  assert.match(resultText(state), /그래픽 \(건너뜀\)/);
  assert.equal(
    new Set(state.hypotheses[0].evidence.map((e) => e.turnId)).size,
    2,
  );
});

test('결과 문장과 조건을 수정하는 중에도 저장·재개하고 확정을 막는다', () => {
  const { state, reply } = answered();
  let next = finishEarly(applyValuesReply(state, reply, allowed));
  next = reviewHypothesis(next, 'h1', 'confirmed');
  next.resultDrafts.h1 = {
    statement: '아직 다 쓰지 않은 내 생각',
    conditions: '특정 상황에서는',
  };
  assert.equal(canConfirmResults(next), false);
  const restored = restoreValuesState(context, JSON.stringify(next));
  assert.deepEqual(restored.resultDrafts, next.resultDrafts);
  const committed = reviewHypothesis(restored, 'h1', 'edited', '새 생각', [
    '특정 상황',
  ]);
  assert.deepEqual(committed.resultDrafts, {});
  assert.equal(canConfirmResults(committed), false);
});
