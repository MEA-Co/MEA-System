import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  normalizeRichTextValue,
  richTextPlainText,
} from '@/app/(private)/dashboard/_views/questions/lib/rich-text';
import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
async function handle(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    const access = await getUserAccess();
    if (!access.user) return json({ error: '로그인이 필요해요.' }, 401);
    if (
      !access.isOnboarded ||
      !access.role ||
      !['admin', 'consultant_lead'].includes(access.role ?? '') ||
      !['admin', 'consultant_lead'].includes(await getViewRole(access.role))
    )
      return json({ error: '검토 요청 접근 권한이 없어요.' }, 403);
    const { questionId } = await context.params;
    if (!z.uuid().safeParse(questionId).success)
      return json({ error: '질문 ID를 확인해 주세요.' }, 400);
    const originVersionId = new URL(request.url).searchParams.get(
      'originVersionId',
    );
    if (originVersionId && !z.uuid().safeParse(originVersionId).success)
      return json({ error: '질문지 ID를 확인해 주세요.' }, 400);
    const client = createClient(await cookies());
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      if (
        (origin && origin !== new URL(request.url).origin) ||
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
      if (request.method === 'PUT') {
        const parsed = z
          .object({ ids: z.array(z.uuid()).min(1).max(100) })
          .safeParse(body);
        if (!parsed.success)
          return json({ error: '확인할 검토 요청을 확인해 주세요.' }, 400);
        const { error } = await client.rpc('mark_question_reviews_read', {
          qid: questionId,
          ids: parsed.data.ids,
        });
        if (error)
          return json({ error: '읽음 상태를 저장하지 못했어요.' }, 403);
      } else {
        const parsed = z
          .object({
            id: z.uuid(),
            originVersionId: z.uuid().nullable().optional(),
            description: z
              .string()
              .max(5000)
              .transform(normalizeRichTextValue)
              .refine((v) => richTextPlainText(v).trim().length > 0)
              .optional(),
          })
          .refine((v) => request.method !== 'POST' || !!v.description)
          .safeParse(body);
        if (!parsed.success)
          return json(
            {
              error:
                '검토 요청 내용을 입력해 주세요. 최대 5,000자까지 작성할 수 있어요.',
            },
            400,
          );
        const data = parsed.data;
        const result =
          request.method === 'POST'
            ? await client.rpc('request_question_review', {
                p_id: data.id,
                p_question_id: questionId,
                p_origin_version_id: data.originVersionId ?? null,
                p_description: data.description,
              })
            : await client.rpc('resolve_question_review', {
                p_id: data.id,
                p_question_id: questionId,
              });
        if (result.error)
          return json(
            {
              error:
                '처리하지 못했어요. 질문의 게시 상태와 권한을 확인해 주세요.',
            },
            result.error.code === '42501'
              ? 403
              : result.error.code === '40001'
                ? 409
                : 400,
          );
      }
    }
    const { data, error } = await client.rpc('read_question_reviews', {
      qid: questionId,
    });
    if (error)
      return json(
        { error: '검토 요청을 불러오지 못했어요.' },
        error.code === '42501' ? 403 : 503,
      );
    const permission = await client.rpc('can_request_question_review', {
      qid: questionId,
      origin_id: originVersionId,
    });
    if (permission.error)
      return json({ error: '검토 요청 권한을 확인하지 못했어요.' }, 503);
    const unread = await client.rpc('unread_question_review_ids', {
      qid: questionId,
    });
    if (unread.error)
      return json({ error: '새 검토 요청을 확인하지 못했어요.' }, 503);
    return json({
      ...data,
      canRequest: permission.data === true,
      unreadIds: unread.data ?? [],
    });
  } catch {
    return json(
      { error: '검토 요청을 처리하지 못했어요. 다시 시도해 주세요.' },
      503,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;

export const PUT = handle;
