import { cookies } from 'next/headers';
import { z } from 'zod';

import { requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { QuestionnaireHttpError } from './http-error';
import { normalizeRichTextValue, richTextPlainText } from './rich-text';

import 'server-only';

async function answerClient() {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead', 'consultant'],
  });
  return { client: createClient(await cookies()), userId: access.user.id };
}
export async function loadAnswerStatuses() {
  const { client, userId } = await answerClient();
  const { data, error } = await client
    .from('questionnaire_responses')
    .select('version_id,status')
    .eq('respondent_id', userId);
  if (error)
    throw new QuestionnaireHttpError(503, '답변 상태를 불러오지 못했어요.');
  return data ?? [];
}
export async function loadAnswers(versionId: string) {
  const { client, userId } = await answerClient();
  const version = await client
    .from('questionnaire_versions')
    .select('id,questionnaires!inner(archived_at)')
    .eq('id', versionId)
    .eq('status', 'distributed')
    .is('questionnaires.archived_at', null)
    .maybeSingle();
  if (version.error)
    throw new QuestionnaireHttpError(503, '질문지를 확인하지 못했어요.');
  if (!version.data)
    throw new QuestionnaireHttpError(404, '답변할 질문지를 찾을 수 없어요.');
  const { data, error } = await client
    .from('questionnaire_responses')
    .select(
      'id,revision,status,updated_at,free_response,questionnaire_answers(id,question_id,body,selection)',
    )
    .eq('version_id', versionId)
    .eq('respondent_id', userId)
    .maybeSingle();
  if (error) throw new QuestionnaireHttpError(503, '답변을 불러오지 못했어요.');
  return {
    revision: data?.revision ?? 0,
    status: data?.status ?? 'assigned',
    savedAt: data?.updated_at ?? null,
    freeResponse: data?.free_response ?? '',
    answers: Object.fromEntries(
      (data?.questionnaire_answers ?? []).map((a) => [
        a.question_id,
        a.selection == null
          ? a.body
          : Array.isArray(a.selection)
            ? JSON.stringify(a.selection)
            : String(a.selection),
      ]),
    ),
  };
}
export async function saveAnswers(versionId: string, input: unknown) {
  const schema = z.object({
    answers: z.record(
      z.uuid(),
      z.string().max(20000).transform(normalizeRichTextValue),
    ),
    freeResponse: z
      .string()
      .max(20000)
      .transform(normalizeRichTextValue)
      .optional(),
    revision: z.number().int().nonnegative(),
    saveId: z.uuid(),
    complete: z.boolean(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new QuestionnaireHttpError(400, '답변 내용을 확인해 주세요.');
  const data = parsed.data;
  if (
    data.complete &&
    Object.values(data.answers).some((text) => !richTextPlainText(text).trim())
  )
    throw new QuestionnaireHttpError(400, '모든 질문에 답변을 입력해 주세요.');
  const { client } = await answerClient();
  const result = await client.rpc('save_questionnaire_response', {
    p_version_id: versionId,
    p_answers: data.answers,
    p_revision: data.revision,
    p_save_id: data.saveId,
    p_complete: data.complete,
    p_free_response: data.freeResponse ?? null,
  });
  if (result.error) {
    const code = result.error.code;
    throw new QuestionnaireHttpError(
      code === '42501'
        ? 403
        : ['40001', '55000'].includes(code)
          ? 409
          : code === '22023'
            ? 400
            : 503,
      code === '40001'
        ? '다른 창에서 답변이 변경됐어요. 작성 내용을 복사한 뒤 다시 열어 주세요.'
        : code === '55000'
          ? '이미 답변 완료한 질문지예요. 수정할 수 없어요.'
          : code === '22023'
            ? '모든 질문의 답변을 확인해 주세요.'
            : '답변을 저장하지 못했어요. 다시 시도해 주세요.',
    );
  }
  return result.data;
}
