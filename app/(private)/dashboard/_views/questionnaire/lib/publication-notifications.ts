import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import 'server-only';

export async function loadUnreadQuestionnairePublications(): Promise<string[]> {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('unread_questionnaire_publications');
  if (error)
    throw new Error('새 질문지 알림을 불러오지 못했어요.', { cause: error });
  return (data ?? []).map((row: { version_id: string }) => row.version_id);
}
