'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { requireUserAccess } from '@/lib/auth';
import { STUDENT_PERIODS, type StudentPeriod } from '@/lib/profile';
import { isQuestAnswerType } from '@/lib/quest';
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
