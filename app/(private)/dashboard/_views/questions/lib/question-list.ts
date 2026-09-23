import type { QuestionBlockClause, QuestionBlockRow } from './question-blocks';

export function describeClause(
  clause: QuestionBlockClause,
  questions: QuestionBlockRow[],
) {
  const field = questions
    .find((q) => q.id === clause.blockId)
    ?.fields.find((f) => f.id === clause.fieldId);
  const fieldLabel = clause.fieldId
    ? (field?.label ?? '찾을 수 없는 열')
    : '모든 열';
  if (clause.op === 'answered')
    return {
      fieldLabel,
      particle: '에',
      valueLabel: null,
      suffix: '응답했을 때',
    };
  if (clause.op === 'gte' || clause.op === 'lte')
    return {
      fieldLabel,
      particle: '의 점수가',
      valueLabel: `${clause.value ?? ''}점`,
      suffix: clause.op === 'gte' ? '이상일 때' : '이하일 때',
    };
  if (field?.kind === 'single' || field?.kind === 'multiple')
    return {
      fieldLabel,
      particle: '에서',
      valueLabel:
        field.options?.find((o) => o.id === clause.value)?.label ??
        '찾을 수 없는 선택지',
      suffix: '항목을 선택했을 때',
    };
  return {
    fieldLabel,
    particle: '의 답변이',
    valueLabel: String(clause.value ?? ''),
    suffix: '일 때',
  };
}

export function rowLimitLabel(question: QuestionBlockRow) {
  return question.row_mode === 'reference'
    ? '앞선 응답 수만큼 반복'
    : `행 최대 ${question.row_mode === 'repeatable' ? (question.max_rows ?? 1) : 1}개`;
}

export type QuestionConnection = {
  source: string;
  target: string;
  labels: string[];
  notes: string[];
};
export function questionConnections(
  questions: QuestionBlockRow[],
): QuestionConnection[] {
  const connections = new Map<string, QuestionConnection>();
  const add = (source: string, target: string, label: string, note = false) => {
    const key = `${source}:${target}`;
    const connection = connections.get(key) ?? {
      source,
      target,
      labels: [],
      notes: [],
    };
    if (note) connection.notes.push(label);
    else connection.labels.push(label);
    connections.set(key, connection);
  };
  for (const q of questions) {
    for (const clause of q.condition?.clauses ?? []) {
      const text = describeClause(clause, questions);
      add(
        clause.blockId,
        q.id,
        `${text.fieldLabel}${text.particle} ${text.valueLabel ? `‘${text.valueLabel}’ ` : ''}${text.suffix}`,
      );
    }
    if (q.source_block_id) add(q.source_block_id, q.id, '응답 항목 참조', true);
    if (q.after_block_id) add(q.after_block_id, q.id, '응답 후 진행', true);
  }
  return [...connections.values()];
}

// Each incoming connection gets its own label lane beside the target node.
export function questionGraphLayout(
  questions: QuestionBlockRow[],
  matchedIds: string[],
) {
  const allEdges = questionConnections(questions);
  const available = new Set(questions.map((q) => q.id));
  const visible = new Set(matchedIds.filter((id) => available.has(id)));
  const pending = [...visible];
  while (pending.length) {
    const target = pending.pop();
    for (const edge of allEdges) {
      if (
        edge.target === target &&
        available.has(edge.source) &&
        !visible.has(edge.source)
      ) {
        visible.add(edge.source);
        pending.push(edge.source);
      }
    }
  }
  const edges = allEdges.filter(
    (e) => visible.has(e.source) && visible.has(e.target),
  );
  const remaining = new Set(visible);
  const levels = new Map<string, number>();
  // Topological layout. Invalid legacy cycles remain visible without looping.
  while (remaining.size) {
    const ready = [...remaining].filter((id) =>
      edges.every((e) => e.target !== id || !remaining.has(e.source)),
    );
    if (!ready.length) {
      for (const id of remaining) levels.set(id, 0);
      break;
    }
    for (const id of ready) {
      levels.set(
        id,
        Math.max(
          0,
          ...edges
            .filter((e) => e.target === id)
            .map((e) => (levels.get(e.source) ?? 0) + 1),
        ),
      );
      remaining.delete(id);
    }
  }
  const bottoms = new Map<number, number>();
  const nodes = questions
    .filter((q) => visible.has(q.id))
    .map((question) => {
      const level = levels.get(question.id) ?? 0;
      const height = Math.max(
        (question.condition?.clauses.length ?? 0) > 1 ? 148 : 128,
        edges.filter((e) => e.target === question.id).length * 52 + 32,
      );
      const y = bottoms.get(level) ?? 32;
      bottoms.set(level, y + height + 48);
      return { question, x: 32 + level * 640, y, width: 260, height };
    });
  return {
    nodes,
    edges,
    width: Math.max(600, ...nodes.map((n) => n.x + n.width + 32)),
    height: Math.max(360, ...nodes.map((n) => n.y + n.height + 32)),
  };
}
