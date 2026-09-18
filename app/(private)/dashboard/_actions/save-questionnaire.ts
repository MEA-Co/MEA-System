'use server';

import { saveQuestionnaireDraft } from '@/features/questionnaires/server';

export async function saveQuestionnaire(input: unknown) {
  return saveQuestionnaireDraft(input);
}
