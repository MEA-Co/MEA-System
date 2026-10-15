import { cookies } from 'next/headers';

import { getViewRole } from '@/lib/admin';
import { requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { QuestionnaireHttpError } from '../questionnaire/http-error';

import 'server-only';

export async function loadSubmittedResponses(
  questionnaireId: string,
  options?: {
    page?: number;
    sessionId?: string;
    revision?: number;
    manifest?: boolean;
  },
) {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (role !== 'admin' && role !== 'consultant_lead')
    throw new QuestionnaireHttpError(403, '제출된 답변 조회 권한이 없어요.');
  const client = createClient(await cookies());
  const { data, error } = await client.rpc(
    options?.sessionId
      ? 'read_submitted_response'
      : options?.manifest
        ? 'read_submitted_response_manifest'
        : options?.page
          ? 'read_submitted_response_page'
          : 'list_submitted_questionnaire_responses',
    {
      qid: questionnaireId,
      ...(options?.sessionId
        ? {
            sid: options.sessionId,
            expected_revision: options.revision ?? null,
          }
        : options?.page
          ? { page: options.page }
          : {}),
    },
  );
  if (error)
    throw new QuestionnaireHttpError(
      error.code === '42501'
        ? 403
        : error.code === 'P0002'
          ? 404
          : error.code === '40001'
            ? 409
            : error.code === '22023'
              ? 400
              : 503,
      '제출된 답변을 불러오지 못했어요.',
    );
  return data;
}
