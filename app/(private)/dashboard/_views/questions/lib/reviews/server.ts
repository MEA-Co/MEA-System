import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

import {
  createReviewSchema,
  readReviewsSchema,
  resolveReviewSchema,
  reviewQuerySchema,
} from './schema';

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function handleQuestionReview(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    const access = await getUserAccess();
    if (!access.user) return json({ error: '로그인이 필요해요.' }, 401);
    if (
      !access.isOnboarded ||
      !access.role ||
      !['admin', 'consultant_lead'].includes(access.role) ||
      !['admin', 'consultant_lead'].includes(await getViewRole(access.role))
    )
      return json({ error: '검토 요청 접근 권한이 없어요.' }, 403);
    const { questionId } = await context.params;
    if (!z.uuid().safeParse(questionId).success)
      return json({ error: '질문 ID를 확인해 주세요.' }, 400);
    const url = new URL(request.url);
    const query = reviewQuerySchema.safeParse({
      completed: url.searchParams.get('completed') ?? 'false',
      page: url.searchParams.get('page') ?? 1,
    });
    if (!query.success)
      return json({ error: '조회 조건을 확인해 주세요.' }, 400);
    const client = createClient(await cookies());
    if (request.method === 'GET') {
      const { data, error } = await client.rpc('read_question_review_page', {
        qid: questionId,
        origin_id: null,
        completed: query.data.completed === 'true',
        page: query.data.page,
      });
      if (error)
        return json(
          { error: '검토 요청을 불러오지 못했어요.' },
          error.code === '42501' ? 403 : 503,
        );
      return json(data);
    }
    const origin = request.headers.get('origin');
    if (
      (origin && origin !== url.origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json({ error: '허용되지 않은 요청이에요.' }, 403);
    const raw = await request.text();
    if (raw.length > 30000)
      return json({ error: '검토 요청이 너무 길어요.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: '입력 내용을 확인해 주세요.' }, 400);
    }
    let result;
    if (request.method === 'POST') {
      const parsed = createReviewSchema.safeParse(body);
      if (!parsed.success)
        return json(
          {
            error:
              '검토 요청 내용을 입력해 주세요. 최대 5,000자까지 작성할 수 있어요.',
          },
          400,
        );
      result = await client.rpc('request_question_review', {
        p_id: parsed.data.id,
        p_question_id: questionId,
        p_origin_questionnaire_id: null,
        p_description: parsed.data.description,
      });
    } else if (request.method === 'PATCH') {
      const parsed = resolveReviewSchema.safeParse(body);
      if (!parsed.success)
        return json({ error: '처리할 검토 요청을 확인해 주세요.' }, 400);
      result = await client.rpc('resolve_question_review', {
        p_id: parsed.data.id,
        p_question_id: questionId,
      });
    } else if (request.method === 'PUT') {
      const parsed = readReviewsSchema.safeParse(body);
      if (!parsed.success)
        return json({ error: '확인할 검토 요청을 확인해 주세요.' }, 400);
      result = await client.rpc('mark_question_reviews_read', {
        qid: questionId,
        ids: [...new Set(parsed.data.ids)],
      });
    } else return json({ error: '허용되지 않은 요청이에요.' }, 405);
    if (result.error)
      return json(
        {
          error: '처리하지 못했어요. 질문의 게시 상태와 권한을 확인해 주세요.',
        },
        result.error.code === '42501'
          ? 403
          : result.error.code === '40001'
            ? 409
            : result.error.code === '22023'
              ? 400
              : 503,
      );
    // Mutation success is independent of any subsequent read/revalidation.
    return json({ ok: true });
  } catch {
    return json(
      { error: '검토 요청을 처리하지 못했어요. 다시 시도해 주세요.' },
      503,
    );
  }
}
