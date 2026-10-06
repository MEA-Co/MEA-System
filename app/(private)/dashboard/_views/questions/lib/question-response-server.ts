import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { QuestionnaireHttpError } from './questionnaire/http-error';

import 'server-only';

export async function questionResponseCommand(
  questionnaireId: string,
  mode: 'read' | 'open' | 'save',
  input?: unknown,
  distributed = false,
) {
  const access = await requireUserAccess({
    allowedRoles: distributed
      ? ['admin', 'consultant_lead', 'consultant']
      : ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (
    role !== 'admin' &&
    role !== 'consultant_lead' &&
    !(distributed && role === 'consultant')
  )
    throw new QuestionnaireHttpError(403, '게시본 답변 권한이 없어요.');
  const client = createClient(await cookies());
  const args: Record<string, unknown> = { p_questionnaire_id: questionnaireId };
  if (mode === 'save') {
    const parsed = z
      .object({
        answers: z.record(
          z.uuid(),
          z
            .array(
              z
                .object({
                  id: z.number().int().safe(),
                  answers: z.record(z.uuid(), z.string().max(20000)),
                })
                .strict(),
            )
            .max(20),
        ),
        revision: z.number().int().nonnegative(),
        saveId: z.uuid(),
        complete: z.boolean(),
        definitionToken: z.string().length(32),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success)
      throw new QuestionnaireHttpError(400, '답변 내용을 확인해 주세요.');
    Object.assign(args, {
      p_answers: parsed.data.answers,
      p_revision: parsed.data.revision,
      p_save_id: parsed.data.saveId,
      p_complete: parsed.data.complete,
      p_definition_token: parsed.data.definitionToken,
    });
  }
  const { data, error } = await client.rpc(
    `${mode}_${distributed ? 'distributed_' : ''}question_response_session`,
    args,
  );
  if (error) {
    const status =
      error.code === '42501'
        ? 403
        : ['40001', '55000'].includes(error.code)
          ? 409
          : error.code === '22023'
            ? 400
            : 503;
    throw new QuestionnaireHttpError(
      status,
      status === 403
        ? '질문지가 공개되지 않았거나 답변 권한이 없어요.'
        : status === 409
          ? '질문 또는 답변이 변경됐어요. 최신 내용을 확인한 뒤 다시 저장해 주세요.'
          : status === 400
            ? '열려 있는 질문의 답변과 행 수를 확인해 주세요.'
            : '답변을 저장하거나 불러오지 못했어요. 다시 시도해 주세요.',
    );
  }
  return data;
}

export async function listMyPublishedResponses() {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (role !== 'admin' && role !== 'consultant_lead')
    throw new QuestionnaireHttpError(403, '응답 조회 권한이 없어요.');
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('list_my_published_responses');
  if (error)
    throw new QuestionnaireHttpError(503, '내 응답을 불러오지 못했어요.');
  return data;
}

export async function loadGuideAnswers(questionIds?: string[]) {
  const access = await requireUserAccess({
    allowedRoles: questionIds
      ? ['admin', 'consultant_lead', 'consultant']
      : ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (
    role !== 'admin' &&
    role !== 'consultant_lead' &&
    !(questionIds && role === 'consultant')
  )
    throw new QuestionnaireHttpError(403, '조회 권한이 없어요.');
  const client = createClient(await cookies());
  const { data, error } = questionIds
    ? await client.rpc('read_guide_answers', { p_question_ids: questionIds })
    : await client.rpc('can_write_guide_answers');
  if (error)
    throw new QuestionnaireHttpError(503, '가이드 답변을 확인하지 못했어요.');
  return questionIds ? data : { canWrite: data === true };
}

export async function loadSubmittedResponses(questionnaireId: string) {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (role !== 'admin' && role !== 'consultant_lead')
    throw new QuestionnaireHttpError(403, '제출된 답변 조회 권한이 없어요.');
  const client = createClient(await cookies());
  const { data, error } = await client.rpc(
    'list_submitted_questionnaire_responses',
    { qid: questionnaireId },
  );
  if (error)
    throw new QuestionnaireHttpError(
      error.code === '42501' ? 403 : 503,
      '제출된 답변을 불러오지 못했어요.',
    );
  return data;
}
