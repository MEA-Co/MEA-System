import { randomUUID } from 'node:crypto';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import {
  type AuthorizedUserAccess,
  getUserAccess,
  requireUserAccess,
} from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import type { QuestionBlockRow } from '../question-blocks';

import { QuestionnaireHttpError } from './http-error';
import { savedDraftSchema, saveQuestionnaireSchema } from './schema';
import type {
  QuestionnaireDraft,
  QuestionnaireListItem,
  QuestionnaireReview,
  SaveQuestionnaireResult,
} from './types';

import 'server-only';

function mutationStatus(code?: string) {
  if (code === '42501') return 403;
  if (code === 'P0002') return 404;
  if (code === '40001' || code === '55000') return 409;
  if (
    code &&
    ['22023', '22P02', '23502', '23503', '23505', '23514'].includes(code)
  )
    return 400;
  return 503;
}

export async function deleteQuestionnaireDraft(
  input: unknown,
): Promise<{ error?: string; status?: number; mode?: 'deleted' | 'archived' }> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  ) {
    return { status: 403, error: '질문지를 삭제할 권한이 없어요.' };
  }
  const parsed = z
    .object({
      questionnaireId: z.uuid(),
      revision: z.number().int().nonnegative(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: '삭제할 질문지를 확인해 주세요.' };
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('delete_questionnaire', {
    p_questionnaire_id: parsed.data.questionnaireId,
    p_expected_revision: parsed.data.revision,
  });
  if (error?.code === '40001')
    return {
      status: 409,
      error: '질문지가 수정되었어요. 목록을 새로고침한 뒤 다시 삭제해 주세요.',
    };
  if (error?.code === '42501')
    return { status: 403, error: '질문지 작성자와 관리자만 삭제할 수 있어요.' };
  if (error)
    return {
      status: mutationStatus(error.code),
      error:
        '질문지를 삭제하지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요.',
    };
  if (data !== 'deleted' && data !== 'archived')
    return {
      status: 503,
      error: '삭제 결과를 확인하지 못했어요. 목록을 새로고침해 주세요.',
    };
  return { mode: data };
}

export async function loadQuestionnaireView(
  requestedId?: string,
  authorizedAccess?: AuthorizedUserAccess,
) {
  const access =
    authorizedAccess ??
    (await requireUserAccess({
      allowedRoles: ['admin', 'consultant_lead', 'consultant'],
    }));
  const viewRole = await getViewRole(access.role);
  const staff = viewRole === 'admin' || viewRole === 'consultant_lead';
  const client = createClient(await cookies());
  const { data, error } = await client
    .from('questionnaires')
    .select(
      'id, title, status, published_at, distributed_at, revision, updated_at, archived_at, created_by',
    )
    .order('updated_at', { ascending: false });
  if (error)
    throw new Error('질문지 목록을 불러오지 못했어요.', { cause: error });
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: QuestionnaireListItem['status'];
    published_at: string | null;
    distributed_at: string | null;
    revision: number;
    updated_at: string;
    archived_at: string | null;
    created_by: string;
  }>;
  const reviewCounts = new Map<string, number>();
  const unreadReviewCounts = new Map<string, number>();
  if (staff) {
    const counts = await client.rpc('question_review_counts');
    if (counts.error)
      throw new Error('검토 요청 개수를 불러오지 못했어요.', {
        cause: counts.error,
      });
    for (const item of (counts.data ?? []) as {
      questionnaire_id: string;
      count: number;
      unread_count: number;
    }[]) {
      reviewCounts.set(item.questionnaire_id, item.count);
      unreadReviewCounts.set(item.questionnaire_id, item.unread_count);
    }
  }
  const submissionCounts = new Map<string, number>();
  if (
    staff &&
    rows.some((row) => row.status === 'distributed' && !row.archived_at)
  ) {
    const counts = await client.rpc('distributed_submission_counts');
    if (counts.error)
      throw new Error('제출 응답 개수를 불러오지 못했어요.', {
        cause: counts.error,
      });
    for (const item of (counts.data ?? []) as {
      questionnaire_id: string;
      count: number;
    }[])
      submissionCounts.set(item.questionnaire_id, Number(item.count));
  }
  const authors = new Map<string, string>();
  if (staff && rows.some((row) => row.status === 'published')) {
    const result = await client.rpc('published_questionnaire_authors');
    if (result.error)
      throw new Error('제작자 이름을 불러오지 못했어요.', {
        cause: result.error,
      });
    for (const author of (result.data ?? []) as {
      questionnaireId: string;
      name: string;
    }[])
      authors.set(author.questionnaireId, author.name);
  }
  const questionnaires: QuestionnaireListItem[] = rows
    .filter((item) =>
      staff
        ? item.status !== 'draft' || item.created_by === access.user.id
        : item.status === 'distributed' && !item.archived_at,
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      creatorName: authors.get(item.id) ?? null,
      submittedResponseCount: staff
        ? (submissionCounts.get(item.id) ?? 0)
        : undefined,
      status: item.status,
      archivedAt: item.archived_at,
      publishedAt: item.published_at,
      distributedAt: item.distributed_at,
      updatedAt: item.updated_at,
      revision: item.revision,
      hasDistributed: item.status === 'distributed',
      isOwner: staff && item.created_by === access.user.id,
      unreadReviewCount: staff ? (unreadReviewCounts.get(item.id) ?? 0) : 0,
      pendingReviewCount:
        staff && item.created_by === access.user.id
          ? (reviewCounts.get(item.id) ?? 0)
          : 0,
      canDelete:
        staff && (viewRole === 'admin' || item.created_by === access.user.id),
    }));
  const result = {
    publishedSources: [] as QuestionBlockRow[],
    drafts: questionnaires.filter(
      (item) => !item.archivedAt && item.status === 'draft',
    ),
    published: questionnaires.filter(
      (item) => !item.archivedAt && item.status === 'published',
    ),
    distributed: questionnaires.filter(
      (item) => !item.archivedAt && item.status === 'distributed',
    ),
    archived: questionnaires.filter((item) => !!item.archivedAt),
    staff,
    selected: null as QuestionnaireListItem | null,
    reviews: [] as QuestionnaireReview[],
    initialDraft: null as QuestionnaireDraft | null,
    publishedDocument: null as QuestionnaireDraft | null,
  };
  if (!requestedId) return result;
  if (requestedId === 'new') {
    if (!staff)
      throw new QuestionnaireHttpError(403, '질문지를 작성할 권한이 없어요.');
    result.initialDraft = {
      questionnaireId: randomUUID(),
      title: '',
      revision: 0,
      savedAt: null,
      sections: [
        {
          id: randomUUID(),
          title: '',
          questions: [],
        },
      ],
    };
    return result;
  }
  const selected = questionnaires.find((item) => item.id === requestedId);
  if (!z.uuid().safeParse(requestedId).success || !selected)
    throw new QuestionnaireHttpError(
      404,
      '선택한 질문지를 찾을 수 없어요. 질문지 관리로 다시 이동해 주세요.',
    );
  if (selected.archivedAt)
    throw new QuestionnaireHttpError(
      409,
      '보관된 질문지예요. 목록에서 상태를 복원한 뒤 열어 주세요.',
    );
  const editable = selected.isOwner && selected.status !== 'distributed';
  const documentResult = await client.rpc(
    editable ? 'read_questionnaire_draft' : 'read_published_questionnaire',
    { p_questionnaire_id: requestedId },
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
  if (
    (selected.status === 'distributed' ||
      (staff && selected.status === 'published')) &&
    document.sections.some((section) =>
      section.questions.some((question) => question.sourceQuestionId),
    )
  ) {
    const sources = await client.rpc('read_published_question_sources', {
      p_questionnaire_id: requestedId,
    });
    if (sources.error)
      throw new Error('게시된 질문지의 질문을 불러오지 못했어요.', {
        cause: sources.error,
      });
    result.publishedSources = (sources.data ?? []) as QuestionBlockRow[];
    if (!staff)
      result.publishedSources.forEach((source) => {
        source.details = source.details?.filter(
          (detail) => detail.visibleToConsultants,
        );
      });
  }
  result.selected = selected;
  if (editable) result.initialDraft = document;
  else result.publishedDocument = document;
  if (staff && selected.status !== 'draft') {
    const reviews = await client
      .from('question_review_requests')
      .select(
        'id, question_id, title, requester_name, description, created_at, resolved_at',
      )
      .in(
        'question_id',
        document.sections.flatMap((s) =>
          s.questions.flatMap((q) =>
            q.sourceQuestionId ? [q.sourceQuestionId] : [],
          ),
        ),
      )
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
  if (!parsed.data.document.title.trim())
    return {
      ok: false,
      code: 'invalid',
      error: '질문지 제목이 비어 있어 저장할 수 없어요. 제목을 입력해 주세요.',
    };
  const client = createClient(await cookies());
  if (
    parsed.data.document.sections.some((section) =>
      section.questions.some((question) => question.sourceQuestionId),
    )
  ) {
    const support = await client
      .from('questionnaire_questions')
      .select('source_question_id')
      .limit(0);
    if (support.error)
      return {
        ok: false,
        code: 'invalid',
        error:
          '현재 연결된 데이터베이스에 질문 배치 기능이 준비되지 않았어요. 데이터베이스 업데이트 후 다시 저장해 주세요.',
      };
  }
  const { data, error } = await client.rpc('save_questionnaire_draft', {
    p_document: {
      ...parsed.data.document,
      confirmedRemovedGuideQuestions:
        parsed.data.confirmedRemovedGuideQuestions ?? [],
    },
    p_expected_revision: parsed.data.expectedRevision,
    p_save_id: parsed.data.saveId,
  });
  if (error) {
    if (error.code === 'PGA02')
      return {
        ok: false,
        code: 'invalid',
        error:
          '제거할 질문에 가이드 응답이 있습니다. 질문을 다시 배치한 뒤 제거하여 삭제를 확인해 주세요.',
      };
    if (error.message?.includes('Question placement'))
      return {
        ok: false,
        code: 'invalid',
        error:
          '배치한 질문과 참조 순서를 확인해 주세요. 질문 관리에서 원본이 변경되었을 수 있어요.',
      };
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

// This stage checks readiness only. Never mutate status or create responses.
export async function checkQuestionnaireDistribution(input: unknown): Promise<{
  error?: string;
  status?: number;
  distributionChecked?: boolean;
}> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    !['admin', 'consultant_lead'].includes(access.role ?? '')
  )
    return { status: 403, error: '배포 조건을 확인할 권한이 없어요.' };
  const parsed = z
    .object({
      questionnaireId: z.uuid(),
      revision: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { status: 400, error: '확인할 질문지를 선택해 주세요.' };
  const client = createClient(await cookies());
  const questionnaire = await client
    .from('questionnaires')
    .select('revision, status, created_by, archived_at')
    .eq('id', parsed.data.questionnaireId)
    .maybeSingle();
  if (questionnaire.error)
    return {
      status: 503,
      error: '질문지 상태를 확인하지 못했어요. 다시 시도해 주세요.',
    };
  if (!questionnaire.data)
    return { status: 404, error: '질문지를 찾을 수 없어요.' };
  const row = questionnaire.data as unknown as {
    revision: number;
    status: string;
    created_by: string;
    archived_at: string | null;
  };
  if (row.created_by !== access.user.id)
    return {
      status: 403,
      error: '질문지 작성자만 배포 조건을 확인할 수 있어요.',
    };
  if (row.revision !== parsed.data.revision)
    return {
      status: 409,
      error: '질문지가 변경됐어요. 목록을 새로고침한 뒤 다시 확인해 주세요.',
    };
  if (row.status !== 'published' || row.archived_at !== null)
    return {
      status: 409,
      error: '게시 중인 질문지만 배포 조건을 확인할 수 있어요.',
    };
  // The existing RPC counts unresolved reviews by source question, across origins.
  const counts = await client.rpc('question_review_counts');
  const checked = z
    .array(
      z.object({
        questionnaire_id: z.uuid(),
        count: z.number().int().nonnegative(),
      }),
    )
    .safeParse(counts.data);
  if (counts.error || !checked.success)
    return {
      status: 503,
      error: '검토 요청을 확인하지 못했어요. 다시 시도해 주세요.',
    };
  const remaining =
    checked.data.find(
      (entry) => entry.questionnaire_id === parsed.data.questionnaireId,
    )?.count ?? 0;
  if (remaining > 0)
    return {
      status: 409,
      error: `미처리 검토 요청이 ${remaining}건 남아 있어 배포할 수 없어요. 모두 처리한 뒤 다시 확인해 주세요.`,
    };
  return { distributionChecked: true };
}

export async function publishQuestionnaireDraft(
  input: unknown,
  mode: 'publish' | 'distribute' = 'publish',
): Promise<{ error?: string; status?: number; distributionChecked?: boolean }> {
  if (mode === 'distribute') {
    const check = await checkQuestionnaireDistribution(input);
    if (check.error) return check;
  }
  const label = mode === 'publish' ? '게시' : '배포';
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    (access.role !== 'admin' && access.role !== 'consultant_lead')
  ) {
    return { status: 403, error: `질문지를 ${label}할 권한이 없어요.` };
  }
  const parsed = z
    .object({
      questionnaireId: z.uuid(),
      revision: z.number().int().positive(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: `질문지를 확인한 뒤 ${label}해 주세요.` };
  const client = createClient(await cookies());
  const { error } = await client.rpc(
    mode === 'publish' ? 'publish_questionnaire' : 'distribute_questionnaire',
    {
      p_questionnaire_id: parsed.data.questionnaireId,
      p_expected_revision: parsed.data.revision,
    },
  );
  if (error?.code === '40001')
    return {
      status: 409,
      error: `질문지가 수정되었어요. 목록을 새로고침하고 내용을 확인한 뒤 다시 ${label}해 주세요.`,
    };
  if (error?.code === '42501')
    return {
      status: 403,
      error: '질문지를 처음 만든 사람만 게시하거나 배포할 수 있어요.',
    };
  if (error?.message?.includes('Unresolved question reviews'))
    return {
      status: 409,
      error:
        '미처리 검토 요청이 남아 있어 배포할 수 없어요. 모두 처리한 뒤 다시 시도해 주세요.',
    };
  if (error?.message?.includes('Question placement responses'))
    return {
      status: 409,
      error:
        '저장된 질문을 배치한 질문지는 현재 제작·게시·미리보기까지 지원해요. 배포는 질문 버전 고정과 응답 저장 연결 후 사용할 수 있어요.',
    };
  if (error?.message?.includes('Question placement dependency'))
    return {
      status: 400,
      error: '참조하는 질문을 앞에 배치한 뒤 다시 저장해 주세요.',
    };
  if (error?.code === '55000')
    return {
      status: 409,
      error:
        '현재 질문지 상태에서는 처리할 수 없어요. 목록을 새로고침해 주세요.',
    };
  if (error?.code === '22023')
    return {
      error: `제목·질문·선택지를 확인해 주세요. 선택형은 이름이 다른 선택지 2개 이상이 필요해요.`,
    };
  if (error)
    return {
      status: mutationStatus(error.code),
      error: `${label} 결과를 확인하지 못했어요. 목록을 새로고침한 뒤 다시 확인해 주세요.`,
    };
  return {};
}

export async function changeQuestionnaireStatus(input: unknown): Promise<{
  error?: string;
  status?: number;
  questionnaireId?: string;
  distributionChecked?: boolean;
}> {
  const access = await getUserAccess();
  if (
    !access.user ||
    !access.isOnboarded ||
    !['admin', 'consultant_lead'].includes(access.role ?? '')
  )
    return { status: 403, error: '질문지 상태를 변경할 권한이 없어요.' };
  const parsed = z
    .object({
      questionnaireId: z.uuid(),
      revision: z.number().int().positive(),
      expectedStatus: z.enum(['draft', 'published', 'distributed']),
      archivedAt: z.string().nullable(),
      status: z.enum(['draft', 'published', 'distributed', 'archived']),
      requestId: z.uuid(),
    })
    .safeParse(input);
  if (!parsed.success)
    return { status: 400, error: '변경할 상태를 확인해 주세요.' };
  const data = parsed.data;
  // Existing request receipts make actual distribution retries idempotent.
  // The database validates pending reviews in the same transaction as locking.
  const client = createClient(await cookies());
  const result = await client.rpc('change_questionnaire_status', {
    p_questionnaire_id: data.questionnaireId,
    p_expected_revision: data.revision,
    p_expected_status: data.expectedStatus,
    p_expected_archived_at: data.archivedAt,
    p_status: data.status,
    p_request_id: data.requestId,
  });
  if (result.error) {
    const { code, message } = result.error;
    if (message?.includes('Saved responses prevent distribution withdrawal'))
      return {
        status: 409,
        error:
          '저장된 응답이 있어 되돌릴 수 없어요. 작성 중인 답변도 보호됩니다.',
      };
    if (message?.includes('Unresolved question reviews'))
      return {
        status: 409,
        error:
          '미처리 검토 요청이 남아 있어 배포할 수 없어요. 모두 처리한 뒤 다시 시도해 주세요.',
      };
    if (message?.includes('Question placement responses'))
      return {
        status: 409,
        error:
          '저장된 질문을 배치한 질문지는 아직 배포할 수 없어요. 질문 버전 고정과 응답 저장 연결이 필요합니다.',
      };
    if (code === '40001')
      return {
        status: 409,
        error:
          '질문지 상태가 변경됐어요. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      };
    if (code === '42501')
      return {
        status: 403,
        error:
          '작성자만 상태를 변경할 수 있어요. 관리자는 다른 작성자의 질문지를 보관할 수 있습니다.',
      };
    if (code === '22023')
      return {
        status: 400,
        error: '제목·질문·선택지와 질문의 참조 순서를 확인해 주세요.',
      };
    if (code === '55000')
      return {
        status: 409,
        error:
          '현재 상태에서 변경할 수 없어요. 저장된 응답이 없는 배포본만 게시나 수정 중으로 되돌릴 수 있어요.',
      };
    return {
      status: mutationStatus(code),
      error: '상태를 변경하지 못했어요. 목록을 새로고침한 뒤 확인해 주세요.',
    };
  }
  return result.data;
}
