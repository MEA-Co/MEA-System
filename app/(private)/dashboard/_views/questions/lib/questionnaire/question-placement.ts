import type { QuestionBlockRow } from '../question-blocks';

import type { Question, QuestionnaireSection } from './types';

export function dependencies(question: QuestionBlockRow): string[] {
  return [
    ...new Set(
      [
        question.source_block_id,
        question.after_block_id,
        ...(question.condition?.clauses.map((clause) => clause.blockId) ?? []),
      ].filter((id): id is string => !!id),
    ),
  ];
}

export function placementError(
  sections: QuestionnaireSection[],
  library: QuestionBlockRow[],
): string | null {
  const seen = new Set<string>();
  const byId = new Map(library.map((question) => [question.id, question]));
  for (const placement of sections.flatMap((section) => section.questions)) {
    if (!placement.sourceQuestionId)
      return '원본 질문이 없는 배치예요. 원본 질문을 저장한 뒤 다시 배치해 주세요.';
    const question = byId.get(placement.sourceQuestionId);
    if (!question || question.archived_at)
      return '배치된 질문을 찾을 수 없어요. 질문 목록을 새로고침하거나 해당 배치를 제거해 주세요.';
    const name = question.title || '이 질문';
    if (seen.has(question.id)) return `‘${name}’ 질문이 두 번 배치되어 있어요.`;
    if (dependencies(question).some((id) => !seen.has(id))) {
      return `‘${name}’에서 참조하는 질문을 먼저 배치해 주세요.`;
    }
    seen.add(question.id);
  }
  return null;
}

// Include transitive prerequisites once, in dependency order.
export function questionsToPlace(
  id: string,
  sections: QuestionnaireSection[],
  library: QuestionBlockRow[],
): QuestionBlockRow[] {
  const placed = new Set(
    sections.flatMap((section) =>
      section.questions.map((q) => q.sourceQuestionId),
    ),
  );
  const byId = new Map(library.map((question) => [question.id, question]));
  const visiting = new Set<string>();
  const result: QuestionBlockRow[] = [];
  function visit(questionId: string) {
    if (placed.has(questionId)) return;
    if (visiting.has(questionId))
      throw new Error('질문 간 참조가 순환해요. 질문 관리에서 확인해 주세요.');
    const question = byId.get(questionId);
    if (!question || question.archived_at)
      throw new Error(
        '참조하는 질문을 찾을 수 없어요. 목록을 새로고침해 주세요.',
      );
    visiting.add(questionId);
    dependencies(question).forEach(visit);
    visiting.delete(questionId);
    placed.add(questionId);
    result.push(question);
  }
  visit(id);
  return result;
}

export function createPlacement(question: QuestionBlockRow): Question {
  return {
    id: crypto.randomUUID(),
    logicalKey: crypto.randomUUID(),
    sourceQuestionId: question.id,
    text: question.prompt,
    details: [],
  };
}
