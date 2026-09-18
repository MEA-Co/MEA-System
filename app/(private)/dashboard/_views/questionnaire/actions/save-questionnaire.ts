'use server';

import { saveQuestionnaireDraft } from '@/app/(private)/dashboard/_views/questionnaire/lib/server';

export async function saveQuestionnaire(input: unknown) {
  return saveQuestionnaireDraft(input);
}
