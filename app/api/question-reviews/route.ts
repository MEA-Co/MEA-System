import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const json = (data: unknown, status = 200) =>
    Response.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  try {
    const access = await getUserAccess();
    if (
      !access.user ||
      !access.isOnboarded ||
      !access.role ||
      !['admin', 'consultant_lead'].includes(access.role) ||
      !['admin', 'consultant_lead'].includes(await getViewRole(access.role))
    )
      return json({ error: '접근 권한이 없어요.' }, 403);
    const parsed = z
      .array(z.uuid())
      .min(1)
      .max(10)
      .safeParse(
        (new URL(request.url).searchParams.get('questions') ?? '').split(','),
      );
    if (!parsed.success)
      return json({ error: '질문 목록을 확인해 주세요.' }, 400);
    const client = createClient(await cookies());
    const { data, error } = await client.rpc('question_review_counts', {
      p_question_ids: [...new Set(parsed.data)],
    });
    if (error)
      return json({ error: '검토 요청 개수를 불러오지 못했어요.' }, 503);
    return json(data);
  } catch {
    return json({ error: '검토 요청 개수를 불러오지 못했어요.' }, 503);
  }
}
