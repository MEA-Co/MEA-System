'use server';

import { revalidatePath } from 'next/cache';

import { deleteQuestionnaireDraft } from '@/features/questionnaires/server';

export async function deleteQuestionnaire(input: unknown) {
  const result = await deleteQuestionnaireDraft(input);
  if (!result.error) revalidatePath('/dashboard');
  return result;
}
