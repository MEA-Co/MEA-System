import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { getUserAccess, requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { savedDraftSchema, saveQuestionnaireSchema } from './schema';
import type { QuestionnaireDraft, SaveQuestionnaireResult } from './types';

import 'server-only';

export async function loadQuestionnaireWorkspace(requestedId?: string) {
  await requireUserAccess({ allowedRoles: ['admin', 'consultant_lead'] });
  const client = createClient(await cookies());
  const { data, error } = await client
    .from('questionnaire_versions')
    .select('id, title, updated_at, questionnaires!inner(archived_at)')
    .eq('status', 'draft')
    .is('questionnaires.archived_at', null)
    .order('updated_at', { ascending: false });
  if (error)
    throw new Error('질문지 목록을 불러오지 못했어요.', { cause: error });
  const drafts = (data ?? []).map((item) => ({
    id: item.id as string,
    title: item.title as string,
  }));
  const versionId =
    requestedId === 'new' ? undefined : (requestedId ?? drafts[0]?.id);
  if (versionId) {
    if (
      !z.uuid().safeParse(versionId).success ||
      !drafts.some((draft) => draft.id === versionId)
    ) {
      throw new Error(
        '선택한 질문지를 찾을 수 없어요. 질문지 제작으로 다시 이동해 주세요.',
      );
    }
    const result = await client.rpc('read_questionnaire_draft', {
      p_version_id: versionId,
    });
    if (result.error || !result.data)
      throw new Error('질문지를 불러오지 못했어요.', { cause: result.error });
    return {
      drafts,
      initialDraft: savedDraftSchema.parse(result.data) as QuestionnaireDraft,
    };
  }
  const initialDraft: QuestionnaireDraft = {
    questionnaireId: randomUUID(),
    versionId: randomUUID(),
    title: '',
    revision: 0,
    savedAt: null,
    sections: [
      {
        id: randomUUID(),
        title: '',
        questions: [
          { id: randomUUID(), logicalKey: randomUUID(), text: '', details: [] },
        ],
      },
    ],
  };
  return { drafts, initialDraft };
}

export async function saveQuestionnaireDraft(
  input: unknown,
): Promise<SaveQuestionnaireResult> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  ) {
    return {
      ok: false,
      code: 'forbidden',
      error:
        '질문지를 저장할 권한이 없어요. 로그인 상태와 직책을 확인해 주세요.',
    };
  }
  const parsed = saveQuestionnaireSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: 'invalid',
      error:
        '질문지 입력을 확인해 주세요. 제목은 500자, 본문은 20,000자까지 저장할 수 있어요.',
    };
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('save_questionnaire_draft', {
    p_document: parsed.data.document,
    p_expected_revision: parsed.data.expectedRevision,
    p_save_id: parsed.data.saveId,
  });
  if (error) {
    if (error.code === '40001' || error.code === '55000')
      return {
        ok: false,
        code: 'conflict',
        error:
          '다른 창에서 변경되었거나 편집할 수 없는 질문지예요. 작성 내용을 복사해 둔 뒤 새로고침해 주세요.',
      };
    if (error.code === '42501')
      return {
        ok: false,
        code: 'forbidden',
        error: '질문지를 저장할 권한이 없어요.',
      };
    if (
      ['22023', '22P02', '23502', '23503', '23505', '23514'].includes(
        error.code,
      )
    )
      return {
        ok: false,
        code: 'invalid',
        error: '질문지 항목이나 입력 길이를 확인해 주세요.',
      };
    return {
      ok: false,
      code: 'unavailable',
      error:
        '저장 결과를 확인하지 못했어요. 연결을 확인한 뒤 다시 저장해 주세요.',
    };
  }
  const result = z
    .object({ revision: z.number().int().positive(), savedAt: z.string() })
    .safeParse(data);
  if (!result.success)
    return {
      ok: false,
      code: 'unavailable',
      error: '저장 결과를 확인하지 못했어요. 다시 저장해 주세요.',
    };
  return { ok: true, ...result.data };
}
