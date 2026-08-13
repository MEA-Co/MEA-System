'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireUserAccess } from '@/lib/auth';
import { STUDENT_PERIODS, type StudentPeriod } from '@/lib/profile';
import { isQuestAnswerType, type QuestAnswer } from '@/lib/quest';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect('/login');
}

export type CreateQuestResult = {
  error?: string;
  success?: true;
};

export async function createQuest(
  formData: FormData,
): Promise<CreateQuestResult> {
  const { user } = await requireUserAccess({ allowedRoles: ['admin'] });

  const periodValue = formData.get('student_period');
  const answerTypeValue = formData.get('answer_type');
  const questionValue = formData.get('question');

  const studentPeriod =
    typeof periodValue === 'string' ? periodValue.trim() : '';
  const answerType =
    typeof answerTypeValue === 'string' ? answerTypeValue.trim() : '';
  const question =
    typeof questionValue === 'string' ? questionValue.trim() : '';

  if (!STUDENT_PERIODS.includes(studentPeriod as StudentPeriod)) {
    return { error: '대상 시기를 선택해 주세요.' };
  }
  if (!question) return { error: '질문을 입력해 주세요.' };
  if (question.length > 500) {
    return { error: '질문은 500자 이내로 입력해 주세요.' };
  }
  if (!isQuestAnswerType(answerType)) {
    return { error: '답변 형식을 선택해 주세요.' };
  }

  const tableColumns =
    answerType === 'table'
      ? formData
          .getAll('table_column')
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  if (answerType === 'table' && tableColumns.length === 0) {
    return { error: '표에 사용할 열을 한 개 이상 입력해 주세요.' };
  }
  if (tableColumns.length > 8) {
    return { error: '표의 열은 최대 8개까지 추가할 수 있습니다.' };
  }
  if (tableColumns.some((column) => column.length > 40)) {
    return { error: '표의 열 이름은 40자 이내로 입력해 주세요.' };
  }
  if (new Set(tableColumns).size !== tableColumns.length) {
    return { error: '표의 열 이름은 서로 다르게 입력해 주세요.' };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('quests').insert({
    student_period: studentPeriod,
    question,
    answer_type: answerType,
    table_columns: tableColumns,
    created_by: user.id,
  });

  if (error) {
    return {
      error: 'Quest를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  revalidatePath('/');
  return { success: true };
}

export type SaveQuestResponseResult = {
  error?: string;
  success?: true;
};

type AnswerableQuest = {
  id: string;
  answer_type: 'text' | 'table';
  table_columns: string[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveQuestResponse(
  _state: SaveQuestResponseResult,
  formData: FormData,
): Promise<SaveQuestResponseResult> {
  const { user, profile } = await requireUserAccess({
    allowedRoles: ['student'],
  });

  const questId = String(formData.get('quest_id') ?? '').trim();
  const answerType = String(formData.get('answer_type') ?? '').trim();

  if (!UUID_PATTERN.test(questId) || !isQuestAnswerType(answerType)) {
    return { error: '올바르지 않은 Quest입니다.' };
  }

  const supabase = createClient(await cookies());
  const { data: quest, error: questError } = await supabase
    .from('quests')
    .select('id, answer_type, table_columns')
    .eq('id', questId)
    .eq('student_period', profile.student_period)
    .maybeSingle<AnswerableQuest>();

  if (questError || !quest || quest.answer_type !== answerType) {
    return { error: '이 Quest에 답변할 수 없습니다.' };
  }

  let answer: QuestAnswer;

  if (answerType === 'text') {
    const value = String(formData.get('text_answer') ?? '');

    if (!value.trim()) return { error: '답변을 입력해 주세요.' };
    if (value.length > 10000) {
      return { error: '답변은 10,000자 이내로 입력해 주세요.' };
    }

    answer = { type: 'text', value };
  } else {
    const rawRows = String(formData.get('table_rows') ?? '');
    let rows: unknown;

    try {
      rows = JSON.parse(rawRows);
    } catch {
      return { error: '표 답변을 확인해 주세요.' };
    }

    if (
      !Array.isArray(rows) ||
      rows.length === 0 ||
      rows.length > 50 ||
      rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== quest.table_columns.length ||
          row.some((cell) => typeof cell !== 'string' || cell.length > 1000),
      )
    ) {
      return { error: '표 답변의 행과 입력값을 확인해 주세요.' };
    }

    const tableRows = rows as string[][];
    if (!tableRows.some((row) => row.some((cell) => cell.trim()))) {
      return { error: '표에 답변을 입력해 주세요.' };
    }

    answer = { type: 'table', rows: tableRows };
  }

  const { error } = await supabase.from('quest_responses').upsert(
    {
      quest_id: quest.id,
      student_id: user.id,
      answer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'quest_id,student_id' },
  );

  if (error) {
    return {
      error: '답변을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  revalidatePath('/');
  return { success: true };
}
