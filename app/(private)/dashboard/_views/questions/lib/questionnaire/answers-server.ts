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
  const { client } = await answerClient();
  const { data, error } = await client.rpc('distributed_response_statuses');
  if (error)
    throw new QuestionnaireHttpError(503, '답변 상태를 불러오지 못했어요.');
  return data ?? [];
}
export async function loadAnswers(versionId: string) {
  const { client } = await answerClient();
  const { data, error } = await client.rpc('read_distributed_response', {
    p_version_id: versionId,
  });
  if (error)
    throw new QuestionnaireHttpError(
      error.code === '42501' ? 403 : error.code === '55000' ? 409 : 503,
      error.code === '55000'
        ? '이전 답변 데이터의 전환이 필요해요. 관리자에게 문의해 주세요.'
        : '답변을 불러오지 못했어요.',
    );
  return data;
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
  const result = await client.rpc('save_distributed_response', {
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
      result.error.message.includes('Legacy response migration required')
        ? '이전 답변 데이터의 전환이 필요해요. 관리자에게 문의해 주세요.'
        : code === '40001'
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
