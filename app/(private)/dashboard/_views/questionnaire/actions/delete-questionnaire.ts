'use server';

import { revalidatePath } from 'next/cache';

import { deleteQuestionnaireDraft } from '@/app/(private)/dashboard/_views/questionnaire/lib/server';

export async function deleteQuestionnaire(input: unknown) {
  const result = await deleteQuestionnaireDraft(input);
  if (!result.error) revalidatePath('/dashboard');
  return result;
}
