import { cookies } from 'next/headers';

import { getViewRole } from '@/lib/admin';
import { type AuthorizedUserAccess, requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { QuestionnaireHttpError } from './questionnaire/http-error';
import { CAREER_FLOW_REQUIREMENTS_MESSAGE } from './responses/requirements';
import { questionResponseSaveSchema } from './responses/schema';

import 'server-only';

export async function questionResponseCommand(
  questionnaireId: string,
  mode: 'read' | 'open' | 'save' | 'version',
  input?: unknown,
  published = false,
  requestAccess?: AuthorizedUserAccess,
) {
  const access =
    requestAccess ??
    (await requireUserAccess({
      allowedRoles: published
        ? ['admin', 'consultant_lead', 'consultant']
        : ['admin', 'consultant_lead'],
    }));
  if (
    ![
      'admin',
      'consultant_lead',
      ...(published ? ['consultant'] : []),
    ].includes(access.role)
  )
    throw new QuestionnaireHttpError(403, '답변 접근 권한이 없어요.');
  const role = await getViewRole(access.role);
  if (
    role !== 'admin' &&
    role !== 'consultant_lead' &&
    !(published && role === 'consultant')
  )
    throw new QuestionnaireHttpError(403, '검토본 답변 권한이 없어요.');
  const client = createClient(await cookies());
  const args: Record<string, unknown> = { p_questionnaire_id: questionnaireId };
  if (mode === 'save') {
    const parsed = questionResponseSaveSchema.safeParse(input);
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
    mode === 'version'
      ? `read_${published ? 'published_question' : 'review'}_response_version`
      : published
        ? `${mode}_published_question_response_session`
        : `${mode}_review_response_session`,
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
            ? error.message === 'Missing career flow required periods'
              ? CAREER_FLOW_REQUIREMENTS_MESSAGE
              : error.message === 'Name every answered inserted flow period'
                ? '답변을 작성한 추가 시기의 이름을 입력해 주세요.'
                : '열려 있는 질문의 답변과 행 수를 확인해 주세요.'
            : '답변을 저장하거나 불러오지 못했어요. 다시 시도해 주세요.',
    );
  }
  return data;
}

export async function listMyReviewResponses() {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead'],
  });
  const role = await getViewRole(access.role);
  if (role !== 'admin' && role !== 'consultant_lead')
    throw new QuestionnaireHttpError(403, '응답 조회 권한이 없어요.');
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('list_my_review_responses');
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

export { loadSubmittedResponses } from './responses/submissions-server';
