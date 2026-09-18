import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess, requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import { savedDraftSchema, saveQuestionnaireSchema } from './schema';
import type {
  QuestionnaireDraft,
  QuestionnaireListItem,
  QuestionnaireReview,
  SaveQuestionnaireResult,
} from './types';

import 'server-only';

export async function deleteQuestionnaireDraft(
  input: unknown,
): Promise<{ error?: string; mode?: 'deleted' | 'archived' }> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  ) {
    return { error: '질문지를 삭제할 권한이 없어요.' };
  }
  const parsed = z
    .object({ versionId: z.uuid(), revision: z.number().int().nonnegative() })
    .safeParse(input);
  if (!parsed.success) return { error: '삭제할 질문지를 확인해 주세요.' };
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('delete_questionnaire', {
    p_version_id: parsed.data.versionId,
    p_expected_revision: parsed.data.revision,
  });
  if (error?.code === '40001')
    return {
      error: '질문지가 수정되었어요. 목록을 새로고침한 뒤 다시 삭제해 주세요.',
    };
  if (error?.code === '42501')
    return { error: '질문지 작성자와 관리자만 삭제할 수 있어요.' };
  if (error)
    return {
      error:
        '질문지를 삭제하지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    };
  if (data !== 'deleted' && data !== 'archived')
    return {
      error: '삭제 결과를 확인하지 못했어요. 목록을 새로고침해 주세요.',
    };
  return { mode: data };
}

export async function loadQuestionnaireView(requestedId?: string) {
  const access = await requireUserAccess({
    allowedRoles: ['admin', 'consultant_lead', 'consultant'],
  });
  const viewRole = await getViewRole(access.role);
  const staff = viewRole === 'admin' || viewRole === 'consultant_lead';
  const client = createClient(await cookies());
  const { data, error } = await client
    .from('questionnaire_versions')
    .select(
      'id, questionnaire_id, title, status, published_at, distributed_at, revision, updated_at, questionnaires!inner(archived_at, created_by)',
    )
    .is('questionnaires.archived_at', null)
    .order('updated_at', { ascending: false });
  if (error)
    throw new Error('질문지 목록을 불러오지 못했어요.', { cause: error });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    questionnaire_id: string;
    title: string;
    status: QuestionnaireListItem['status'];
    published_at: string | null;
    distributed_at: string | null;
    revision: number;
    updated_at: string;
    questionnaires: { archived_at: string | null; created_by: string };
  }>;
  const distributedIds = new Set(
    rows
      .filter((item) => item.status === 'distributed')
      .map((item) => item.questionnaire_id),
  );
  const versions: QuestionnaireListItem[] = rows
    .filter((item) =>
      staff
        ? item.status !== 'draft' ||
          item.questionnaires.created_by === access.user.id
        : item.status === 'distributed',
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      publishedAt: item.published_at,
      distributedAt: item.distributed_at,
      updatedAt: item.updated_at,
      revision: item.revision,
      hasDistributed: distributedIds.has(item.questionnaire_id),
      isOwner: staff && item.questionnaires.created_by === access.user.id,
      canDelete:
        staff &&
        (viewRole === 'admin' ||
          item.questionnaires.created_by === access.user.id),
    }));
  const result = {
    drafts: versions.filter((item) => item.status === 'draft'),
    published: versions.filter((item) => item.status === 'published'),
    distributed: versions.filter((item) => item.status === 'distributed'),
    staff,
    selected: null as QuestionnaireListItem | null,
    reviews: [] as QuestionnaireReview[],
    initialDraft: null as QuestionnaireDraft | null,
    publishedDocument: null as QuestionnaireDraft | null,
  };
  if (!requestedId) return result;
  if (requestedId === 'new') {
    if (!staff) throw new Error('질문지를 작성할 권한이 없어요.');
    result.initialDraft = {
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
            {
              id: randomUUID(),
              logicalKey: randomUUID(),
              text: '',
              details: [],
            },
          ],
        },
      ],
    };
    return result;
  }
  const selected = versions.find((item) => item.id === requestedId);
  if (!z.uuid().safeParse(requestedId).success || !selected)
    throw new Error(
      '선택한 질문지를 찾을 수 없어요. 질문지 관리로 다시 이동해 주세요.',
    );
  const editable = selected.isOwner && selected.status !== 'distributed';
  const documentResult = await client.rpc(
    editable ? 'read_questionnaire_draft' : 'read_published_questionnaire',
    { p_version_id: requestedId },
  );
  if (documentResult.error || !documentResult.data)
    throw new Error('질문지를 불러오지 못했어요.', {
      cause: documentResult.error,
    });
  const document = savedDraftSchema.parse(
    documentResult.data,
  ) as QuestionnaireDraft;
  // The actual admin role retains RLS access; filter its consultant presentation on the server too.
  if (!staff)
    document.sections.forEach((section) =>
      section.questions.forEach((question) => {
        question.details = question.details.filter(
          (detail) => detail.visibleToConsultants,
        );
      }),
    );
  result.selected = selected;
  if (editable) result.initialDraft = document;
  else result.publishedDocument = document;
  if (staff && selected.status !== 'draft') {
    const reviews = await client
      .from('questionnaire_review_requests')
      .select('id, requester_name, description, created_at')
      .eq('version_id', requestedId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false });
    if (reviews.error)
      throw new Error('검토 요청을 불러오지 못했어요.', {
        cause: reviews.error,
      });
    result.reviews = reviews.data as QuestionnaireReview[];
  }
  return result;
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

export async function publishQuestionnaireDraft(
  input: unknown,
  mode: 'publish' | 'distribute' = 'publish',
): Promise<{ error?: string }> {
  const label = mode === 'publish' ? '게시' : '배포';
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  ) {
    return { error: `질문지를 ${label}할 권한이 없어요.` };
  }
  const parsed = z
    .object({ versionId: z.uuid(), revision: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success)
    return { error: `질문지를 확인한 뒤 ${label}해 주세요.` };
  const client = createClient(await cookies());
  const { error } = await client.rpc(
    mode === 'publish' ? 'publish_questionnaire' : 'distribute_questionnaire',
    {
      p_version_id: parsed.data.versionId,
      p_expected_revision: parsed.data.revision,
    },
  );
  if (error?.code === '40001')
    return {
      error: `질문지가 수정되었어요. 목록을 새로고침하고 내용을 확인한 뒤 다시 ${label}해 주세요.`,
    };
  if (error?.code === '42501')
    return { error: '질문지를 처음 만든 사람만 게시하거나 배포할 수 있어요.' };
  if (error?.code === '55000')
    return {
      error:
        '현재 질문지 상태에서는 처리할 수 없어요. 목록을 새로고침해 주세요.',
    };
  if (error?.code === '22023')
    return {
      error: `제목과 질문을 입력해 주세요. 빈 질문은 ${label}할 수 없어요.`,
    };
  if (error)
    return {
      error: `${label} 결과를 확인하지 못했어요. 목록을 새로고침한 뒤 다시 확인해 주세요.`,
    };
  return {};
}

export async function manageQuestionnaireReview(
  input: unknown,
  mode: 'request' | 'resolve',
): Promise<{ error?: string }> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  )
    return { error: '검토 요청을 처리할 권한이 없어요.' };
  const schema =
    mode === 'request'
      ? z.object({
          id: z.uuid(),
          versionId: z.uuid(),
          description: z.string().trim().min(1).max(5000),
        })
      : z.object({ id: z.uuid() });
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { error: '검토 요청 설명을 1~5,000자로 입력해 주세요.' };
  const client = createClient(await cookies());
  const data = parsed.data;
  const result =
    'description' in data && 'versionId' in data
      ? await client.rpc('request_questionnaire_review', {
          p_id: data.id,
          p_version_id: data.versionId,
          p_description: data.description,
        })
      : await client.rpc('resolve_questionnaire_review', { p_id: data.id });
  if (result.error)
    return {
      error:
        '검토 요청을 처리하지 못했어요. 권한과 질문지 상태를 확인해 주세요.',
    };
  return {};
}
