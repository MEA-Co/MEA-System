import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  listMyReviewResponses,
  loadGuideAnswers,
  loadSubmittedResponses,
  questionResponseCommand,
} from '@/app/(private)/dashboard/_views/questions/lib/question-response-server';
import {
  loadAnswers,
  loadAnswerStatuses,
  saveAnswers,
} from '@/app/(private)/dashboard/_views/questions/lib/questionnaire/answers-server';
import { QuestionnaireHttpError } from '@/app/(private)/dashboard/_views/questions/lib/questionnaire/http-error';
import {
  changeQuestionnaireStatus,
  deleteQuestionnaireDraft,
  loadQuestionnaireView,
  saveQuestionnaireDraft,
  transitionQuestionnaireDraft,
} from '@/app/(private)/dashboard/_views/questions/lib/questionnaire/server';
import { loadUnreadQuestionnaireUpdates } from '@/app/(private)/dashboard/_views/questions/lib/questionnaire/update-notifications';
import { getViewRole } from '@/lib/admin';
import { type AuthorizedUserAccess, getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
type Context = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, context: Context) {
  try {
    const access = await getUserAccess();
    if (!access.user) return json({ error: '로그인이 필요해요.' }, 401);
    if (
      !access.isOnboarded ||
      !access.role ||
      !['admin', 'consultant_lead', 'consultant'].includes(access.role)
    )
      return json({ error: '질문지 접근 권한이 없어요.' }, 403);
    const viewRole = await getViewRole(access.role);
    const staff = viewRole === 'admin' || viewRole === 'consultant_lead';
    if (viewRole === 'student')
      return json({ error: '질문지 접근 권한이 없어요.' }, 403);
    if (request.headers.get('X-Questionnaire-Workflow') !== '2')
      return json(
        {
          error:
            '질문지 관리가 업데이트되었어요. 새로고침 후 다시 이용해 주세요.',
        },
        426,
      );
    const path = (await context.params).path ?? [];
    const [id, resource] = path;
    const method = request.method;
    if (method === 'GET') {
      if (
        resource === 'submitted-responses' &&
        staff &&
        z.uuid().safeParse(id).success
      ) {
        const params = new URL(request.url).searchParams;
        if (path.length === 3 && path[2] === 'manifest')
          return json(await loadSubmittedResponses(id, { manifest: true }));
        if (path.length === 3 && z.uuid().safeParse(path[2]).success) {
          const revision = params.has('revision')
            ? Number(params.get('revision'))
            : undefined;
          if (
            revision !== undefined &&
            (!Number.isSafeInteger(revision) || revision < 0)
          )
            return json({ error: '제출 버전을 확인해 주세요.' }, 400);
          return json(
            await loadSubmittedResponses(id, { sessionId: path[2], revision }),
          );
        }
        if (path.length === 2) {
          const page = params.has('page')
            ? Number(params.get('page'))
            : undefined;
          if (
            page !== undefined &&
            (!Number.isInteger(page) || page < 1 || page > 100000)
          )
            return json({ error: '페이지를 확인해 주세요.' }, 400);
          return json(
            await (page
              ? loadSubmittedResponses(id, { page })
              : loadSubmittedResponses(id)),
          );
        }
      }
      if (
        path.length === 2 &&
        resource === 'guide-question-ids' &&
        staff &&
        z.uuid().safeParse(id).success
      ) {
        const client = createClient(await cookies());
        const result = await client.rpc('questionnaire_guide_question_ids', {
          qid: id,
        });
        if (result.error)
          return json(
            { error: '가이드 응답을 확인하지 못했어요.' },
            result.error.code === '42501' ? 403 : 503,
          );
        return json({ questionIds: result.data ?? [] });
      }
      if (path.length === 1 && id === 'guide-access' && staff)
        return json(await loadGuideAnswers());
      if (path.length === 1 && id === 'guide-answers') {
        const ids = z
          .array(z.uuid())
          .max(500)
          .safeParse(
            (new URL(request.url).searchParams.get('questions') ?? '')
              .split(',')
              .filter(Boolean),
          );
        if (!ids.success)
          return json({ error: '질문 목록을 확인해 주세요.' }, 400);
        return json(await loadGuideAnswers(ids.data));
      }

      if (path.length === 1 && id === 'my-responses' && staff)
        return json(await listMyReviewResponses());
      if (path.length === 1 && id === 'unread-reviews') {
        if (!staff) return json({ hasUnread: false });
        const client = createClient(await cookies());
        const { data, error } = await client
          .from('question_review_requests')
          .select(
            'id, questions!inner(created_by), question_review_reads!left(review_id)',
          )
          .eq('questions.created_by', access.user.id)
          .neq('requested_by', access.user.id)
          .is('resolved_at', null)
          .is('question_review_reads', null)
          .limit(1);
        if (error)
          return json({ error: '새 검토 요청을 확인하지 못했어요.' }, 503);
        return json({ hasUnread: !!data?.length });
      }
      if (path.length === 1 && id === 'unread')
        return json(await loadUnreadQuestionnaireUpdates(!staff));
      if (path.length === 1 && id === 'responses')
        return json(await loadAnswerStatuses());
      if (
        path.length === 2 &&
        resource === 'answers' &&
        z.uuid().safeParse(id).success
      )
        return json(await loadAnswers(id));
      if (
        path.length === 2 &&
        ['review-responses', 'published-responses'].includes(resource) &&
        z.uuid().safeParse(id).success &&
        (staff || resource === 'published-responses')
      )
        return json(
          await questionResponseCommand(
            id,
            new URL(request.url).searchParams.get('version') === '1'
              ? 'version'
              : 'read',
            undefined,
            resource === 'published-responses',
            access as AuthorizedUserAccess,
          ),
        );
      if (path.length > 1)
        return json({ error: '경로를 찾을 수 없어요.' }, 404);
      if (id && id !== 'new' && !z.uuid().safeParse(id).success)
        return json({ error: '잘못된 질문지 ID예요.' }, 400);
      if (id === 'new' && !staff)
        return json({ error: '작성 권한이 없어요.' }, 403);
      return json(
        await loadQuestionnaireView(
          id,
          access as AuthorizedUserAccess,
          new URL(request.url).searchParams,
        ),
      );
    }
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json({ error: '허용되지 않은 요청이에요.' }, 403);
    const memberCommand =
      path.length === 2 &&
      z.uuid().safeParse(id).success &&
      ((method === 'PUT' && ['answers', 'read'].includes(resource)) ||
        (['POST', 'PUT'].includes(method) &&
          resource === 'published-responses'));
    if (!staff && !memberCommand)
      return json({ error: '수정 권한이 없어요.' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'JSON 요청이 필요해요.' }, 415);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 750000)
      return json({ error: '요청이 너무 커요.' }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: '잘못된 JSON 요청이에요.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ error: '요청을 확인해 주세요.' }, 400);
    if (
      path.length === 2 &&
      ['review-responses', 'published-responses'].includes(resource) &&
      z.uuid().safeParse(id).success &&
      (staff || resource === 'published-responses') &&
      ['POST', 'PUT'].includes(method)
    )
      return json(
        await questionResponseCommand(
          id,
          method === 'POST' ? 'open' : 'save',
          body,
          resource === 'published-responses',
          access as AuthorizedUserAccess,
        ),
      );
    if (memberCommand && resource === 'answers')
      return json(await saveAnswers(id, body));
    if (
      (method === 'POST' && path.length === 0) ||
      (method === 'PUT' && path.length === 1)
    ) {
      if (
        path.length &&
        (!z.uuid().safeParse(id).success ||
          body.document?.questionnaireId !== id)
      )
        return json({ error: '질문지 ID가 일치하지 않아요.' }, 400);
      if (method === 'POST' && body.expectedRevision !== 0)
        return json({ error: '새 질문지의 revision을 확인해 주세요.' }, 400);
      const result = await saveQuestionnaireDraft(body);
      return json(
        result,
        result.ok
          ? method === 'POST'
            ? 201
            : 200
          : { forbidden: 403, invalid: 400, conflict: 409, unavailable: 503 }[
              result.code
            ],
      );
    }
    if (!z.uuid().safeParse(id).success)
      return json({ error: '잘못된 질문지 ID예요.' }, 400);
    let result: { error?: string; status?: number; mode?: string };
    if (method === 'DELETE' && path.length === 1)
      result = await deleteQuestionnaireDraft({ ...body, questionnaireId: id });
    else if (method === 'PATCH' && path.length === 2 && resource === 'status')
      result = await changeQuestionnaireStatus({
        ...body,
        questionnaireId: id,
      });
    else if (
      method === 'POST' &&
      path.length === 2 &&
      (resource === 'review' || resource === 'publication')
    )
      result = await transitionQuestionnaireDraft(
        { ...body, questionnaireId: id },
        resource === 'review' ? 'start_review' : 'publish',
      );
    else if (method === 'PUT' && path.length === 2 && resource === 'read') {
      const client = createClient(await cookies());
      const { error } = await client.rpc(
        staff ? 'mark_questionnaire_review_read' : 'open_published_response',
        { p_questionnaire_id: id },
      );
      if (error) return json({ error: '확인 상태를 저장하지 못했어요.' }, 503);
      result = {};
    } else return json({ error: '지원하지 않는 경로 또는 작업이에요.' }, 404);
    return json(result, result.error ? (result.status ?? 400) : 200);
  } catch (error) {
    if (error instanceof QuestionnaireHttpError)
      return json({ error: error.message }, error.status);
    return json(
      { error: '질문지를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
