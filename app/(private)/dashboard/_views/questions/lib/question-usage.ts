import type { createClient } from '@/lib/supabase/server';

import type { QuestionBlockRow } from './question-blocks';

export type QuestionnaireUsage = {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'distributed' | 'archived';
};

type Placement = {
  source_question_id: string;
  questionnaire: {
    id: string;
    title: string;
    status: 'draft' | 'published' | 'distributed';
    updated_at: string;
    created_by: string;
    archived_at: string | null;
  };
};

// Only enrich the current page; use the authenticated client so RLS still applies.
export async function withQuestionnaireUsage(
  client: ReturnType<typeof createClient>,
  blocks: QuestionBlockRow[],
  userId: string,
  ownOnly: boolean,
): Promise<QuestionBlockRow[]> {
  if (!blocks.length) return blocks;
  try {
    const placements: Placement[] = [];
    for (let start = 0; ; start += 500) {
      const result = await client
        .from('questionnaire_questions')
        .select(
          'source_question_id, questionnaire:questionnaires!questionnaire_questions_questionnaire_id_fkey!inner(id,title,status,updated_at,created_by,archived_at)',
        )
        .in(
          'source_question_id',
          blocks.map((block) => block.id),
        )
        .order('id')
        .range(start, start + 499)
        .overrideTypes<Placement[], { merge: false }>();
      if (result.error) throw result.error;
      placements.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) break;
    }
    const usages = new Map<string, Map<string, QuestionnaireUsage>>();
    placements.sort((a, b) =>
      b.questionnaire.updated_at.localeCompare(a.questionnaire.updated_at),
    );
    for (const placement of placements) {
      const questionnaire = placement.questionnaire;
      if (
        ownOnly &&
        questionnaire.status === 'draft' &&
        questionnaire.created_by !== userId
      )
        continue;
      const byQuestionnaire =
        usages.get(placement.source_question_id) ??
        new Map<string, QuestionnaireUsage>();
      if (!byQuestionnaire.has(questionnaire.id)) {
        byQuestionnaire.set(questionnaire.id, {
          id: questionnaire.id,
          title: questionnaire.title || '제목 없는 질문지',
          status: questionnaire.archived_at ? 'archived' : questionnaire.status,
        });
      }
      usages.set(placement.source_question_id, byQuestionnaire);
    }
    const referencedIds = new Set<string>();
    const references = new Map<
      string,
      Map<string, { id: string; title: string }>
    >();
    const pageIds = new Set(blocks.map((block) => block.id));
    for (let start = 0; ; start += 500) {
      const result = await client
        .from('questions')
        .select('id,title,created_by,source_block_id,after_block_id,condition')
        .is('archived_at', null)
        .order('id')
        .range(start, start + 499)
        .overrideTypes<
          Pick<
            QuestionBlockRow,
            | 'id'
            | 'title'
            | 'created_by'
            | 'source_block_id'
            | 'after_block_id'
            | 'condition'
          >[],
          { merge: false }
        >();
      if (result.error) throw result.error;
      for (const question of result.data ?? []) {
        for (const id of [
          question.source_block_id,
          question.after_block_id,
          ...(question.condition?.clauses.map((clause) => clause.blockId) ??
            []),
        ]) {
          if (!id || !pageIds.has(id)) continue;
          referencedIds.add(id);
          if (ownOnly && question.created_by !== userId) continue;
          const incoming =
            references.get(id) ??
            new Map<string, { id: string; title: string }>();
          incoming.set(question.id, {
            id: question.id,
            title: question.title?.trim() || '제목 없는 질문',
          });
          references.set(id, incoming);
        }
      }
      if (!result.data || result.data.length < 500) break;
    }
    return blocks.map((block) => ({
      ...block,
      referenced_by_question: referencedIds.has(block.id),
      referencing_questions: [...(references.get(block.id)?.values() ?? [])],
      questionnaire_usage: [...(usages.get(block.id)?.values() ?? [])],
    }));
  } catch {
    // Unknown usage must never be displayed as unused.
    return blocks.map((block) => ({
      ...block,
      questionnaire_usage: null,
      referencing_questions: null,
    }));
  }
}
