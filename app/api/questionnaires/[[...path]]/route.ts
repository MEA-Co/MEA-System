import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  loadAnswers,
  loadAnswerStatuses,
  saveAnswers,
} from '@/app/(private)/dashboard/_views/questionnaire/lib/answers-server';
import { QuestionnaireHttpError } from '@/app/(private)/dashboard/_views/questionnaire/lib/http-error';
import { loadUnreadQuestionnairePublications } from '@/app/(private)/dashboard/_views/questionnaire/lib/publication-notifications';
import {
  addQuestionnaireExplanation,
  deleteQuestionnaireDraft,
  loadQuestionnaireView,
  manageQuestionnaireExplanation,
  manageQuestionnaireReview,
  publishQuestionnaireDraft,
  saveQuestionnaireDraft,
} from '@/app/(private)/dashboard/_views/questionnaire/lib/server';
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
    const path = (await context.params).path ?? [];
    const [id, resource, childId] = path;
    const method = request.method;
    if (method === 'GET') {
      if (path.length === 1 && id === 'unread')
        return json(await loadUnreadQuestionnairePublications(!staff));
      if (path.length === 1 && id === 'responses')
        return json(await loadAnswerStatuses());
      if (
        path.length === 2 &&
        resource === 'answers' &&
        z.uuid().safeParse(id).success
      )
        return json(await loadAnswers(id));
      if (path.length > 1)
        return json({ error: '경로를 찾을 수 없어요.' }, 404);
      if (id && id !== 'new' && !z.uuid().safeParse(id).success)
        return json({ error: '잘못된 질문지 ID예요.' }, 400);
      if (id === 'new' && !staff)
        return json({ error: '작성 권한이 없어요.' }, 403);
      return json(
        await loadQuestionnaireView(id, access as AuthorizedUserAccess),
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
      method === 'PUT' &&
      ['answers', 'read'].includes(resource);
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
    if (memberCommand && resource === 'answers')
      return json(await saveAnswers(id, body));
    if (
      (method === 'POST' && path.length === 0) ||
      (method === 'PUT' && path.length === 1)
    ) {
      if (
        path.length &&
        (!z.uuid().safeParse(id).success || body.document?.versionId !== id)
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
      result = await deleteQuestionnaireDraft({ ...body, versionId: id });
    else if (
      method === 'POST' &&
      path.length === 2 &&
      (resource === 'publication' || resource === 'distribution')
    )
      result = await publishQuestionnaireDraft(
        { ...body, versionId: id },
        resource === 'publication' ? 'publish' : 'distribute',
      );
    else if (
      method === 'POST' &&
      path.length === 2 &&
      resource === 'explanations'
    )
      result = await addQuestionnaireExplanation({ ...body, versionId: id });
    else if (
      (method === 'PATCH' || method === 'DELETE') &&
      path.length === 3 &&
      resource === 'explanations' &&
      z.uuid().safeParse(childId).success
    )
      result = await manageQuestionnaireExplanation(
        { ...body, versionId: id, id: childId },
        method === 'DELETE' ? 'delete' : 'update',
      );
    else if (method === 'POST' && path.length === 2 && resource === 'reviews')
      result = await manageQuestionnaireReview(
        { ...body, versionId: id },
        'request',
      );
    else if (
      method === 'PATCH' &&
      path.length === 3 &&
      resource === 'reviews' &&
      z.uuid().safeParse(childId).success &&
      body.resolved === true
    ) {
      const client = createClient(await cookies());
      const review = await client
        .from('questionnaire_review_requests')
        .select('id')
        .eq('id', childId)
        .eq('version_id', id)
        .maybeSingle();
      if (review.error)
        return json({ error: '검토 요청을 확인하지 못했어요.' }, 503);
      if (!review.data)
        return json({ error: '검토 요청을 찾을 수 없어요.' }, 404);
      result = await manageQuestionnaireReview({ id: childId }, 'resolve');
    } else if (method === 'PUT' && path.length === 2 && resource === 'read') {
      const client = createClient(await cookies());
      const { error } = await client.rpc(
        staff
          ? 'mark_questionnaire_publication_read'
          : 'open_questionnaire_response',
        { p_version_id: id },
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
