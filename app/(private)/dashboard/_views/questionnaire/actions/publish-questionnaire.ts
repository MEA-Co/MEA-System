'use server';
import { revalidatePath } from 'next/cache';

import { publishQuestionnaireDraft } from '../lib/server';
export async function publishQuestionnaire(input: unknown) {
  const result = await publishQuestionnaireDraft(input);
  if (!result.error) revalidatePath('/dashboard');
  return result;
}

export async function distributeQuestionnaire(input: unknown) {
  const result = await publishQuestionnaireDraft(input, 'distribute');
  if (!result.error) revalidatePath('/dashboard');
  return result;
}
