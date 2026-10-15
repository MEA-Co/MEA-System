import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import 'server-only';

export async function loadUnreadQuestionnaireUpdates(
  published = false,
): Promise<string[]> {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc(
    published
      ? 'unread_published_questionnaires'
      : 'unread_questionnaire_reviews',
  );
  if (error)
    throw new Error('새 질문지 알림을 불러오지 못했어요.', { cause: error });
  return (data ?? []).map(
    (row: { questionnaire_id: string }) => row.questionnaire_id,
  );
}
