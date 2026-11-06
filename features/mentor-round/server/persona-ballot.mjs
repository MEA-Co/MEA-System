const kinds = { strategy: '전략', skill: '스킬', experience: '경험' };
const text = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const choiceId = (value, count) =>
  typeof value === 'string' &&
  /^(0|[1-4])$/.test(value) &&
  Number(value) < count;
const unique = (items) => new Set(items).size === items.length;

// A voice/format check, not a claim that the advice is semantically verified.
export function validateAdvice(reason) {
  if (
    !text(reason, 600) ||
    /(?:저는|제가|나는|내가|저도|나도)\s/.test(reason) ||
    /(?:AI|인공지능)(?:가|이|로서)\s*(?:이 선택|제안|작성|생성)|페르소나 구성요소|적합성.*미검증/.test(
      reason,
    )
  )
    throw new Error('Invalid advice voice');
  return reason.trim();
}

export function availableComponents(persona, passages) {
  const ids = new Set(passages.map((p) => p.id));
  return persona.components.filter(
    (c) => c.sourceRefs.length && c.sourceRefs.every((id) => ids.has(id)),
  );
}

export function ballotSchema(options, components) {
  const string = { type: 'string' };
  const refs = { type: 'array', items: string };
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      choice: {
        type: 'string',
        enum: ['-1', ...options.map((_, i) => String(i))],
      },
      reason: string,
      context: string,
      applied: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            componentId: components.length
              ? { type: 'string', enum: components.map((c) => c.id) }
              : string,
            evidence: string,
            sourceRefs: refs,
          },
          required: ['componentId', 'evidence', 'sourceRefs'],
        },
      },
      alternatives: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            choice: { type: 'string', enum: options.map((_, i) => String(i)) },
            tradeoff: string,
          },
          required: ['choice', 'tradeoff'],
        },
      },
      caveats: { type: 'array', items: string },
    },
    required: [
      'choice',
      'reason',
      'context',
      'applied',
      'alternatives',
      'caveats',
    ],
  };
}

/** Fail closed on unverifiable model-selected relationships; no silent relabeling. */
export function validateBallot(ballot, options, components) {
  if (
    !ballot ||
    (ballot.choice !== '-1' && !choiceId(ballot.choice, options.length)) ||
    !text(ballot.reason, 600) ||
    !text(ballot.context, 400) ||
    !Array.isArray(ballot.applied) ||
    ballot.applied.length > 3 ||
    !unique(ballot.applied.map((a) => a?.componentId)) ||
    !Array.isArray(ballot.alternatives) ||
    ballot.alternatives.length !==
      options.length - (ballot.choice === '-1' ? 0 : 1) ||
    !unique(ballot.alternatives.map((a) => a?.choice)) ||
    !Array.isArray(ballot.caveats) ||
    ballot.caveats.length > 4 ||
    ballot.caveats.some((s) => !text(s, 300))
  )
    throw new Error('Invalid structured ballot');
  for (const alternative of ballot.alternatives) {
    if (
      !choiceId(alternative?.choice, options.length) ||
      alternative.choice === ballot.choice ||
      !text(alternative.tradeoff, 300)
    )
      throw new Error('Invalid alternative');
  }
  return ballot.applied.map((entry) => {
    const component = components.find((c) => c.id === entry?.componentId);
    if (
      !component ||
      !text(entry.evidence, 300) ||
      !Array.isArray(entry.sourceRefs) ||
      !entry.sourceRefs.length ||
      !unique(entry.sourceRefs) ||
      entry.sourceRefs.some((id) => !component.sourceRefs.includes(id))
    )
      throw new Error('Invalid component evidence');
    return {
      id: component.id,
      kind: kinds[component.kind],
      label: component.label,
      evidence: entry.evidence,
      sourceRefs: entry.sourceRefs,
    };
  });
}

export function confidenceFor(persona, passages, applied, support) {
  const sourceIds = [
    ...new Set(persona.components.flatMap((c) => c.sourceRefs)),
  ];
  const verified = new Set(passages.map((p) => p.id));
  const appliedRefs = [...new Set(applied.flatMap((c) => c.sourceRefs))];
  const verifiedCount = sourceIds.filter((id) => verified.has(id)).length;
  return {
    status: support ? 'assessed' : 'unavailable',
    label: !verifiedCount
      ? '원문 확인 불가'
      : !support
        ? '원문 확인 · 조언 대조 미완료'
        : `AI 원문 대조 · ${support.level}`,
    sourceCoverage: { verified: verifiedCount, total: sourceIds.length },
    appliedCoverage: {
      verified: appliedRefs.filter((id) => verified.has(id)).length,
      total: appliedRefs.length,
    },
    limitations: [
      '원문 일치는 발췌문 무결성을 뜻하며, 요약의 정확성이나 조언의 적합성을 보증하지 않습니다.',
      'AI 대조 평가는 보조 지표이며 정답 확률·합격 가능성이 아닙니다.',
      ...(!applied.length
        ? ['직접 적용한 페르소나 구성요소가 없어 일반적인 상황 조언입니다.']
        : []),
      ...(verifiedCount < sourceIds.length
        ? [
            '일부 또는 모든 원문을 확인하지 못했습니다. 확인되지 않은 구성요소는 조언에 사용하지 않았습니다.',
          ]
        : []),
    ],
  };
}
