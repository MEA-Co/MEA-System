'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function readQuestionnairePublication(versionId: string) {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead') ||
    !z.uuid().safeParse(versionId).success
  )
    return false;
  const role = await getViewRole(access.role);
  if (role !== 'admin' && role !== 'consultant_lead') return false;
  const client = createClient(await cookies());
  const { error } = await client.rpc('mark_questionnaire_publication_read', {
    p_version_id: versionId,
  });
  return !error;
}
