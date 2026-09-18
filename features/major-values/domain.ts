import { z } from 'zod';

const text = z.string().max(3_000);
const id = z.string().min(1).max(100);
const ids = z.array(id).max(60);
export const interestInputSchema = z.object({
  id,
  majorId: z.string().uuid().nullable(),
  majorName: z.string().min(1).max(200),
  rank: z.number().int().min(1).max(3),
  keyword: z.string().min(1).max(500),
  keywordId: z.string().uuid().nullable(),
  priorReason: text.nullable(),
});
export const valuesContextSchema = z
  .object({
    interests: z.array(interestInputSchema).min(1).max(60),
  })
  .refine(
    ({ interests }) =>
      new Set(interests.map((i) => i.id)).size === interests.length,
  );
export type ValuesContext = z.infer<typeof valuesContextSchema>;
export type InterestInput = z.infer<typeof interestInputSchema>;

export function createValuesContext(
  majors: {
    first: string;
    second?: string;
    third?: string;
    ids?: Record<string, string>;
  },
  keywords: string,
): ValuesContext {
  const names = [majors.first, majors.second, majors.third];
  const interests: InterestInput[] = [];
  names.forEach((name, index) => {
    if (!name) return;
    const marker = `[${name}]\n`;
    const start = keywords.indexOf(marker);
    let content = '';
    if (start >= 0) {
      const from = start + marker.length;
      const ends = names
        .filter(Boolean)
        .map((n) => keywords.indexOf(`\n\n[${n}]\n`, from))
        .filter((n) => n >= 0);
      content = keywords.slice(
        from,
        ends.length ? Math.min(...ends) : undefined,
      );
    } else if (
      index === 0 &&
      !names.some((n) => n && keywords.includes(`[${n}]\n`))
    )
      content = keywords;
    content
      .split('\n')
      .filter((keyword) => keyword.trim())
      .forEach((keyword, position) => {
        interests.push({
          id: `interest-${index + 1}-${position + 1}`,
          majorId: majors.ids?.[name] ?? null,
          majorName: name,
          rank: index + 1,
          keyword,
          keywordId: null,
          priorReason: null,
        });
      });
  });
  return { interests };
}

export const evidenceSchema = z.object({
  turnId: id,
  quote: z.string().min(1).max(3_000),
});
const evidenceList = z.array(evidenceSchema).max(60);
export const turnSchema = z.object({
  id,
  role: z.enum(['student', 'coach']),
  content: z.string().min(1).max(6_000),
  interestIds: ids,
  kind: z.enum([
    'answer',
    'question',
    'prior-reason',
    'skip',
    'resume',
    'connection',
    'separate',
    'correction',
    'confirmation',
    'exclusion',
    'early-end',
    'topic',
  ]),
});
export type ValuesTurn = z.infer<typeof turnSchema>;
export const observationSchema = z.object({
  interestId: id,
  focus: text,
  direction: text,
  reason: text,
  conditions: z.array(text).max(12),
  evidence: evidenceList,
  openQuestions: z.array(text).max(8),
});
export type Observation = z.infer<typeof observationSchema>;
export const hypothesisSchema = z.object({
  id,
  statement: z.string().min(1).max(1_000),
  interestIds: ids.min(1),
  coreValueIds: z.array(z.string().uuid()).max(6),
  basis: z.enum(['student-explicit', 'ai-interpretation']),
  pattern: z.enum(['specific', 'common', 'conditional']),
  evidence: evidenceList.min(1),
  conditions: z.array(text).max(12),
  revisionEvidence: evidenceList,
});
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export const connectionSchema = z.object({
  id,
  interestIds: ids.min(2),
  rationale: z.string().min(1).max(1_000),
  evidence: evidenceList,
});
export type Connection = z.infer<typeof connectionSchema>;
export const nextQuestionSchema = z.object({
  stage: z.enum([
    'focus',
    'reason',
    'condition',
    'connection',
    'next-interest',
    'review',
  ]),
  interestIds: ids,
  message: z.string().min(1).max(3_000),
  metadataIds: ids,
});
export const valuesReplySchema = z.object({
  observations: z.array(observationSchema).max(60),
  hypotheses: z.array(hypothesisSchema).max(100),
  connections: z.array(connectionSchema).max(60),
  next: nextQuestionSchema,
});
export type ValuesReply = z.infer<typeof valuesReplySchema>;
export const valuesStateSchema = z.object({
  version: z.literal(2),
  source: z.string(),
  context: valuesContextSchema,
  conversation: z.array(turnSchema).max(500),
  observations: z.array(observationSchema).max(60),
  hypotheses: z.array(hypothesisSchema).max(100),
  connections: z.array(connectionSchema).max(60),
  connectionDecisions: z.record(z.string(), z.enum(['confirmed', 'rejected'])),
  hypothesisDecisions: z.record(
    z.string(),
    z.enum(['confirmed', 'edited', 'excluded']),
  ),
  resultDrafts: z
    .record(
      z.string(),
      z.object({
        statement: z.string().max(1_000),
        conditions: z.string().max(3_000),
      }),
    )
    .default({}),
  skipped: ids,
  activeInterestIds: ids,
  input: z.string().max(3_000),
  phase: z.enum(['conversation', 'review']),
  earlyEnd: z.boolean(),
  pendingTurnId: id.nullable(),
  metadataVersion: z.string().nullable(),
});
export type ValuesState = z.infer<typeof valuesStateSchema>;
export const valuesRequestSchema = z.object({ state: valuesStateSchema });

function nextTurnId(state: ValuesState) {
  return `turn-${state.conversation.length + 1}`;
}
export function initialValuesState(context: ValuesContext): ValuesState {
  const first = context.interests[0];
  const starting = context.interests.filter((i) => i.rank === first?.rank);
  const prior: ValuesTurn[] = context.interests
    .filter((i) => i.priorReason)
    .map((i, index) => ({
      id: `prior-${index + 1}`,
      role: 'student',
      content: i.priorReason!,
      interestIds: [i.id],
      kind: 'prior-reason',
    }));
  return {
    version: 2,
    source: JSON.stringify(context),
    context,
    conversation: [
      ...prior,
      {
        id: 'opening',
        role: 'coach',
        kind: 'question',
        interestIds: starting.map((i) => i.id),
        content: first
          ? `${first.rank}순위 ${first.majorName}에 적어준 ${starting.map((i) => `‘${i.keyword}’`).join(', ')}부터 이야기해볼까요? ${starting.every((i) => i.priorReason) ? '앞서 적어준 관심 이유에서 특히 중요하게 느끼는 점을 조금 더 이야기해줄 수 있나요?' : '이 키워드에 왜 관심이 있나요? 관심을 갖게 된 계기나 마음이 끌리는 이유를 편하게 들려주세요.'} 키워드마다 이유가 달라도 괜찮고, 다른 관심사부터 이야기해도 좋아요.`
          : '관심 키워드를 먼저 확인해주세요.',
      },
    ],
    observations: context.interests.map((i) => ({
      interestId: i.id,
      focus: '',
      direction: '',
      reason: '',
      conditions: [],
      evidence: [],
      openQuestions: [],
    })),
    hypotheses: [],
    connections: [],
    connectionDecisions: {},
    hypothesisDecisions: {},
    resultDrafts: {},
    skipped: [],
    activeInterestIds: starting.map((i) => i.id),
    input: '',
    phase: 'conversation',
    earlyEnd: false,
    pendingTurnId: null,
    metadataVersion: null,
  };
}
export function restoreValuesState(
  context: ValuesContext,
  serialized: string,
): ValuesState {
  try {
    const parsed = valuesStateSchema.parse(JSON.parse(serialized));
    if (parsed.source === JSON.stringify(context)) {
      validateStateReferences(parsed);
      return parsed;
    }
  } catch {
    /* Preserve the caller's saved copy; do not reuse incompatible state. */
  }
  // Upgrade the previous single-summary draft without treating its AI summary as evidence.
  try {
    const legacy = z
      .object({
        source: z.string(),
        conversation: z.array(
          z.object({
            role: z.enum(['student', 'coach']),
            content: z.string().min(1).max(3_000),
          }),
        ),
        input: z.string().max(3_000),
        summary: z.string().max(1_000),
      })
      .parse(JSON.parse(serialized));
    const oldContext = z
      .object({
        majors: z.array(z.string()).min(1).max(3),
        keywords: z.string(),
      })
      .parse(JSON.parse(legacy.source));
    const oldInputs = createValuesContext(
      {
        first: oldContext.majors[0],
        second: oldContext.majors[1],
        third: oldContext.majors[2],
      },
      oldContext.keywords,
    );
    const identity = (c: ValuesContext) =>
      c.interests.map((i) => [i.rank, i.majorName, i.keyword]);
    if (
      JSON.stringify(identity(oldInputs)) === JSON.stringify(identity(context))
    ) {
      const next = initialValuesState(context);
      const interestIds = context.interests.map((i) => i.id);
      next.conversation = legacy.conversation.map((turn, index) => ({
        ...turn,
        id: `legacy-${index}`,
        interestIds,
        kind: turn.role === 'student' ? 'answer' : 'question',
      }));
      if (legacy.summary)
        next.conversation.push({
          id: 'legacy-summary',
          role: 'coach',
          kind: 'question',
          interestIds,
          content: `이전 대화의 잠정 초안: ${legacy.summary}\n관심사별 근거를 다시 확인하며 이어갈게요.`,
        });
      next.input = legacy.input;
      return next;
    }
  } catch {
    /* Not a compatible earlier draft. */
  }
  return initialValuesState(context);
}
export function appendStudentTurn(
  state: ValuesState,
  content: string,
  interestIds: string[],
  kind: ValuesTurn['kind'] = 'answer',
): ValuesState {
  if (!content.trim() || state.pendingTurnId)
    throw new Error('아직 처리되지 않은 답변이 있습니다.');
  const turn: ValuesTurn = {
    id: nextTurnId(state),
    role: 'student',
    content: content.trim(),
    interestIds,
    kind,
  };
  return {
    ...state,
    conversation: [...state.conversation, turn],
    hypothesisDecisions:
      kind === 'topic'
        ? state.hypothesisDecisions
        : Object.fromEntries(
            Object.entries(state.hypothesisDecisions).filter(
              ([id, decision]) =>
                decision === 'excluded' ||
                !state.hypotheses
                  .find((h) => h.id === id)
                  ?.interestIds.some((i) => interestIds.includes(i)),
            ),
          ),
    input: '',
    pendingTurnId: turn.id,
    phase: 'conversation',
    earlyEnd: false,
  };
}

export function uniqueEvidence(evidence: z.infer<typeof evidenceSchema>[]) {
  return [
    ...new Map(evidence.map((e) => [`${e.turnId}:${e.quote}`, e])).values(),
  ];
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function checkIds(values: string[], valid: Set<string>) {
  check(
    new Set(values).size === values.length &&
      values.every((value) => valid.has(value)),
    `존재하지 않거나 중복된 참조입니다: ${values.filter((value, index) => !valid.has(value) || values.indexOf(value) !== index).join(', ')}`,
  );
}
function checkEvidence(
  evidence: z.infer<typeof evidenceSchema>[],
  state: ValuesState,
) {
  for (const ref of evidence) {
    const turn = state.conversation.find((t) => t.id === ref.turnId);
    check(
      turn &&
        turn.role === 'student' &&
        !['skip', 'resume', 'topic', 'early-end', 'exclusion'].includes(
          turn.kind,
        ) &&
        turn.content.includes(ref.quote),
      '학생 발언에서 확인할 수 없는 근거입니다.',
    );
  }
}
function hasCoverage(
  interestId: string,
  evidence: z.infer<typeof evidenceSchema>[],
  state: ValuesState,
) {
  const interest = state.context.interests.find((i) => i.id === interestId);
  return evidence.some((ref) => {
    const turn = state.conversation.find((t) => t.id === ref.turnId);
    if (
      !turn ||
      !['answer', 'prior-reason', 'correction', 'confirmation'].includes(
        turn.kind,
      )
    )
      return false;
    if (turn.interestIds.includes(interestId)) return true;
    // A student can spontaneously address another named interest in the same turn.
    // Ambiguous identical keywords still require its major to be named explicitly.
    return (
      !!interest &&
      ref.quote.includes(interest.keyword) &&
      (state.context.interests.filter((i) => i.keyword === interest.keyword)
        .length === 1 ||
        ref.quote.includes(interest.majorName))
    );
  });
}
function fingerprint(value: Hypothesis | Connection) {
  return JSON.stringify(value);
}
export function explorationStatus(state: ValuesState, interestId: string) {
  if (state.skipped.includes(interestId)) return 'skipped';
  const observation = state.observations.find(
    (o) => o.interestId === interestId,
  );
  if (!observation?.focus) return 'unexplored';
  if (
    !observation.direction ||
    !observation.reason ||
    !observation.evidence.length
  )
    return 'needs-more';
  if (observation.openQuestions.length) return 'needs-confirmation';
  const joint = state.connections.some(
    (c) =>
      c.interestIds.includes(interestId) &&
      state.connectionDecisions[c.id] === 'confirmed',
  );
  return joint ? 'jointly-explored' : 'explored';
}
export function canReview(state: ValuesState) {
  return (
    state.earlyEnd ||
    state.context.interests.every((i) =>
      [
        'skipped',
        'explored',
        'jointly-explored',
        'needs-confirmation',
      ].includes(explorationStatus(state, i.id)),
    )
  );
}
export function validateStateReferences(state: ValuesState) {
  check(
    state.source === JSON.stringify(state.context),
    '입력 원문과 세션이 일치하지 않습니다.',
  );
  const valid = new Set(state.context.interests.map((i) => i.id));
  checkIds(state.skipped, valid);
  checkIds(state.activeInterestIds, valid);
  check(
    new Set(state.conversation.map((t) => t.id)).size ===
      state.conversation.length,
    '발언 ID가 중복됩니다.',
  );
  state.conversation.forEach((t) => checkIds(t.interestIds, valid));
  check(
    state.pendingTurnId === null ||
      (state.conversation.at(-1)?.id === state.pendingTurnId &&
        state.conversation.at(-1)?.role === 'student'),
    '재시도할 발언이 올바르지 않습니다.',
  );
  checkIds(
    state.observations.map((o) => o.interestId),
    valid,
  );
  check(state.observations.length === valid.size, '관심사가 누락되었습니다.');
  state.observations.forEach((o) => checkEvidence(o.evidence, state));
  state.hypotheses.forEach((h) => {
    checkIds(h.interestIds, valid);
    checkEvidence(h.evidence, state);
    checkEvidence(h.revisionEvidence, state);
  });
  state.connections.forEach((c) => {
    checkIds(c.interestIds, valid);
    checkEvidence(c.evidence, state);
  });
}
export function validateReply(
  reply: ValuesReply,
  state: ValuesState,
  allowed: { coreValueIds: string[]; metadataIds: string[] },
) {
  validateStateReferences(state);
  const valid = new Set(state.context.interests.map((i) => i.id));
  checkIds(
    reply.observations.map((o) => o.interestId),
    valid,
  );
  check(reply.observations.length === valid.size, '관심사가 누락되었습니다.');
  check(
    new Set(reply.hypotheses.map((h) => h.id)).size === reply.hypotheses.length,
    '가설 ID가 중복됩니다.',
  );
  check(
    new Set(reply.connections.map((c) => c.id)).size ===
      reply.connections.length,
    '연결 ID가 중복됩니다.',
  );
  for (const o of reply.observations) {
    checkEvidence(o.evidence, state);
    if (o.focus || o.direction || o.reason || o.conditions.length)
      check(
        o.evidence.length && hasCoverage(o.interestId, o.evidence, state),
        '관심사 설명의 근거가 없습니다.',
      );
  }
  for (const h of reply.hypotheses) {
    checkIds(h.interestIds, valid);
    checkIds(h.coreValueIds, new Set(allowed.coreValueIds));
    checkEvidence(h.evidence, state);
    checkEvidence(h.revisionEvidence, state);
    const excluded = state.hypotheses.find(
      (old) =>
        state.hypothesisDecisions[old.id] === 'excluded' &&
        old.id !== h.id &&
        old.interestIds.length === h.interestIds.length &&
        old.interestIds.every((i) => h.interestIds.includes(i)),
    );
    if (excluded) {
      const excludedAt = state.conversation.findLastIndex(
        (t) => t.kind === 'exclusion' && t.content.includes(excluded.statement),
      );
      check(
        [...h.evidence, ...h.revisionEvidence].some(
          (e) =>
            state.conversation.findIndex((t) => t.id === e.turnId) > excludedAt,
        ),
        '제외된 해석을 새로운 학생 근거 없이 다시 만들 수 없습니다.',
      );
    }
    check(
      h.interestIds.every((i) => hasCoverage(i, h.evidence, state)),
      '다른 관심사의 발언을 자동 복제할 수 없습니다.',
    );
    check(
      h.interestIds.every((i) => {
        const o = reply.observations.find((o) => o.interestId === i);
        return o?.direction && o.reason && o.evidence.length;
      }),
      '이유가 부족한 관심사에 가치관을 부여할 수 없습니다.',
    );
    if (h.interestIds.length > 1)
      check(
        state.connections.some(
          (c) =>
            state.connectionDecisions[c.id] === 'confirmed' &&
            h.interestIds.every((i) => c.interestIds.includes(i)),
        ),
        '학생이 확인하지 않은 관심사 묶음입니다.',
      );
    if (h.pattern === 'common')
      check(
        h.interestIds.length > 1 &&
          new Set(
            h.evidence
              .filter((e) =>
                ['answer', 'prior-reason', 'correction'].includes(
                  state.conversation.find((t) => t.id === e.turnId)?.kind ?? '',
                ),
              )
              .map((e) => e.turnId),
          ).size > 1,
        '하나의 발언을 반복된 공통 근거로 계산할 수 없습니다.',
      );
    if (h.pattern === 'conditional')
      check(h.conditions.length > 0, '조건부 판단의 조건이 없습니다.');
  }
  for (const c of reply.connections) {
    checkIds(c.interestIds, valid);
    checkEvidence(c.evidence, state);
    check(
      !state.connections.some(
        (old) =>
          state.connectionDecisions[old.id] === 'rejected' &&
          old.id !== c.id &&
          old.interestIds.length === c.interestIds.length &&
          old.interestIds.every((i) => c.interestIds.includes(i)),
      ),
      '학생이 분리한 관심사를 새 연결로 다시 합칠 수 없습니다.',
    );
  }
  checkIds(reply.next.interestIds, valid);
  checkIds(reply.next.metadataIds, new Set(allowed.metadataIds));
  check(
    reply.next.stage === 'review' || reply.next.interestIds.length > 0,
    '다음 관심사가 없습니다.',
  );
  const candidate = { ...state, observations: reply.observations };
  if (reply.next.stage === 'review')
    check(canReview(candidate), '아직 다루지 않은 관심사가 있습니다.');
}
export function applyValuesReply(
  state: ValuesState,
  reply: ValuesReply,
  allowed: { coreValueIds: string[]; metadataIds: string[]; version: string },
): ValuesState {
  validateReply(reply, state, allowed);
  const decisions: ValuesState['hypothesisDecisions'] = {};
  const hypotheses = reply.hypotheses.map((h) => ({
    ...h,
    evidence: uniqueEvidence(h.evidence),
    revisionEvidence: uniqueEvidence(h.revisionEvidence),
  }));
  for (const h of hypotheses) {
    const previous = state.hypotheses.find((p) => p.id === h.id);
    if (
      previous &&
      fingerprint(previous) === fingerprint(h) &&
      state.hypothesisDecisions[h.id]
    )
      decisions[h.id] = state.hypothesisDecisions[h.id];
  }
  // Explicit exclusions remain visible and cannot be resurrected by the model.
  for (const h of state.hypotheses.filter(
    (h) => state.hypothesisDecisions[h.id] === 'excluded',
  )) {
    const index = hypotheses.findIndex((n) => n.id === h.id);
    if (index >= 0) hypotheses[index] = h;
    else hypotheses.push(h);
    decisions[h.id] = 'excluded';
  }
  const connectionDecisions: ValuesState['connectionDecisions'] = {};
  const connections = [...reply.connections];
  for (const c of state.connections) {
    if (!state.connectionDecisions[c.id]) continue;
    const newConnection = connections.find((n) => n.id === c.id);
    if (!newConnection && state.connectionDecisions[c.id] === 'rejected')
      connections.push(c);
    if (
      (!newConnection && state.connectionDecisions[c.id] === 'rejected') ||
      (newConnection && fingerprint(c) === fingerprint(newConnection))
    )
      connectionDecisions[c.id] = state.connectionDecisions[c.id];
  }
  return {
    ...state,
    observations: reply.observations,
    hypotheses,
    hypothesisDecisions: decisions,
    connections,
    connectionDecisions,
    conversation: [
      ...state.conversation,
      {
        id: nextTurnId(state),
        role: 'coach',
        kind: 'question',
        content: reply.next.message,
        interestIds: reply.next.interestIds,
      },
    ],
    pendingTurnId: null,
    activeInterestIds: reply.next.interestIds,
    phase: reply.next.stage === 'review' ? 'review' : 'conversation',
    metadataVersion: allowed.version,
  };
}

function localEvent(
  state: ValuesState,
  content: string,
  interestIds: string[],
  kind: ValuesTurn['kind'],
): ValuesState {
  return {
    ...state,
    conversation: [
      ...state.conversation,
      { id: nextTurnId(state), role: 'student', content, interestIds, kind },
    ],
  };
}
export function decideConnection(
  state: ValuesState,
  connectionId: string,
  confirmed: boolean,
): ValuesState {
  const connection = state.connections.find((c) => c.id === connectionId);
  if (!connection) return state;
  const next = localEvent(
    state,
    confirmed
      ? `이 관심사들은 다음 이유로 연결돼요: ${connection.rationale}`
      : '이 관심사들은 서로 다른 관심으로 따로 탐색할게요.',
    connection.interestIds,
    confirmed ? 'connection' : 'separate',
  );
  return {
    ...next,
    observations: confirmed
      ? next.observations
      : next.observations.map((o) =>
          connection.interestIds.includes(o.interestId)
            ? {
                ...o,
                direction: '',
                reason: '',
                conditions: [],
                openQuestions: [
                  '분리한 관심사의 기준과 이유를 다시 확인해주세요.',
                ],
              }
            : o,
        ),
    connectionDecisions: {
      ...state.connectionDecisions,
      [connectionId]: confirmed ? 'confirmed' : 'rejected',
    },
    // A rejected grouping invalidates every result that depended on that grouping.
    hypotheses: confirmed
      ? next.hypotheses
      : next.hypotheses.filter(
          (h) =>
            !(
              h.interestIds.length > 1 &&
              h.interestIds.some((i) => connection.interestIds.includes(i))
            ),
        ),
  };
}
export function skipInterest(
  state: ValuesState,
  interestId: string,
  skip: boolean,
): ValuesState {
  const interest = state.context.interests.find((i) => i.id === interestId);
  if (!interest) return state;
  const next = localEvent(
    state,
    `‘${interest.keyword}’ 관심사는 ${skip ? '지금 건너뛸게요.' : '다시 탐색할게요.'}`,
    [interestId],
    skip ? 'skip' : 'resume',
  );
  return {
    ...next,
    skipped: skip
      ? [...new Set([...state.skipped, interestId])]
      : state.skipped.filter((i) => i !== interestId),
  };
}
export function reviewHypothesis(
  state: ValuesState,
  hypothesisId: string,
  decision: 'confirmed' | 'excluded' | 'edited',
  statement?: string,
  conditions?: string[],
): ValuesState {
  const h = state.hypotheses.find((h) => h.id === hypothesisId);
  if (!h) return state;
  const content = statement?.trim() || h.statement;
  const nextConditions = conditions ?? h.conditions;
  const correction = `${content}${nextConditions.length ? `\n조건과 예외: ${nextConditions.join(' / ')}` : '\n추가 조건과 예외는 없어요.'}`;
  const next = localEvent(
    state,
    decision === 'excluded'
      ? `이 해석은 제외할게요: ${h.statement}`
      : correction,
    h.interestIds,
    decision === 'edited'
      ? 'correction'
      : decision === 'excluded'
        ? 'exclusion'
        : 'confirmation',
  );
  const resultDrafts = { ...state.resultDrafts };
  delete resultDrafts[h.id];
  return {
    ...next,
    resultDrafts,
    hypotheses: next.hypotheses.map((item) =>
      item.id !== h.id
        ? item
        : decision === 'edited'
          ? {
              ...item,
              statement: content,
              basis: 'student-explicit',
              coreValueIds: [],
              conditions: nextConditions,
              pattern:
                item.pattern === 'conditional' && !nextConditions.length
                  ? 'specific'
                  : item.pattern,
              revisionEvidence: [
                ...item.revisionEvidence,
                { turnId: next.conversation.at(-1)!.id, quote: correction },
              ],
            }
          : item,
    ),
    hypothesisDecisions: { ...state.hypothesisDecisions, [h.id]: decision },
  };
}
export function finishEarly(state: ValuesState): ValuesState {
  const next = localEvent(
    state,
    '지금까지 이야기한 내용만 정리할게요. 나머지는 미탐색으로 남겨주세요.',
    [],
    'early-end',
  );
  return { ...next, phase: 'review', earlyEnd: true };
}
export function canConfirmResults(state: ValuesState) {
  return (
    state.phase === 'review' &&
    !state.pendingTurnId &&
    Object.keys(state.resultDrafts).length === 0 &&
    state.hypotheses.every(
      (h) =>
        state.hypothesisDecisions[h.id] === 'confirmed' ||
        state.hypothesisDecisions[h.id] === 'excluded',
    )
  );
}
export function resultText(state: ValuesState) {
  const accepted = state.hypotheses.filter(
    (h) => state.hypothesisDecisions[h.id] === 'confirmed',
  );
  const lines = accepted.map((h) => {
    const names = h.interestIds.map((id) => {
      const i = state.context.interests.find((i) => i.id === id)!;
      return `${i.majorName} · ${i.keyword}`;
    });
    return `[${names.join(' / ')}]\n${h.statement}${h.conditions.length ? `\n조건: ${h.conditions.join(' / ')}` : ''}`;
  });
  if (!accepted.length)
    lines.push('현재 대화에서는 전공 가치관을 더 확인할 필요가 있습니다.');
  const outstanding = state.context.interests.filter(
    (i) => !accepted.some((h) => h.interestIds.includes(i.id)),
  );
  if (outstanding.length)
    lines.push(
      `추가 탐색 또는 확인이 필요한 관심사: ${outstanding.map((i) => `${i.majorName} · ${i.keyword}${state.skipped.includes(i.id) ? ' (건너뜀)' : ''}`).join(', ')}`,
    );
  const openQuestions = state.observations
    .filter((o) => o.openQuestions.length)
    .map((o) => {
      const interest = state.context.interests.find(
        (i) => i.id === o.interestId,
      )!;
      return `${interest.majorName} · ${interest.keyword}: ${o.openQuestions.join(' / ')}`;
    });
  if (openQuestions.length)
    lines.push(`남은 확인 사항:\n${openQuestions.join('\n')}`);
  return lines.join('\n\n');
}
