import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import {
  NOTICE_IMAGE_BUCKET,
  NOTICE_IMAGE_MAX_BYTES,
  noticeImagePath,
} from '@/lib/questionnaire-notice-images/model';
import { processNoticeImage } from '@/lib/questionnaire-notice-images/process';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const paramsSchema = z.object({
  questionnaireId: z.uuid(),
  noticeId: z.uuid(),
  imageId: z.uuid(),
});
type Context = { params: Promise<z.infer<typeof paramsSchema>> };
const json = (error: string, status: number) =>
  Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );
async function handle(request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return json('사진 경로를 확인해 주세요.', 404);
  const access = await getUserAccess();
  if (!access.user) return json('로그인이 필요해요.', 401);
  if (
    !access.isOnboarded ||
    !['admin', 'consultant_lead', 'consultant'].includes(access.role ?? '')
  )
    return json('사진 접근 권한이 없어요.', 403);
  const viewRole = await getViewRole(access.role!);
  if (viewRole === 'student') return json('사진 접근 권한이 없어요.', 403);
  const { questionnaireId, noticeId, imageId } = parsed.data;
  const client = createClient(await cookies());
  const storage = client.storage.from(NOTICE_IMAGE_BUCKET);
  const path = noticeImagePath(questionnaireId, noticeId, imageId);
  if (request.method === 'GET') {
    const { data, error } = await storage.download(path);
    if (error || !data) return json('사진을 불러올 수 없어요.', 404);
    return new Response(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  }
  if (!['admin', 'consultant_lead'].includes(viewRole))
    return json('사진을 첨부할 권한이 없어요.', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json('잘못된 요청이에요.', 403);
  if (request.headers.get('X-Questionnaire-Workflow') !== '2')
    return json('새로고침 후 다시 시도해 주세요.', 426);
  const { data: questionnaire } = await client
    .from('questionnaires')
    .select('id,status,created_by,archived_at')
    .eq('id', questionnaireId)
    .maybeSingle();
  if (
    !questionnaire ||
    questionnaire.archived_at ||
    !['draft', 'in_review'].includes(questionnaire.status) ||
    (questionnaire.status === 'draft' &&
      questionnaire.created_by !== access.user.id &&
      access.role !== 'admin')
  )
    return json('편집 가능한 질문지를 먼저 저장해 주세요.', 403);
  if (
    request.headers.get('Content-Type') !== 'image/webp' ||
    Number(request.headers.get('Content-Length') ?? 0) > NOTICE_IMAGE_MAX_BYTES
  )
    return json('사진 형식이나 용량을 확인해 주세요.', 400);
  const reader = request.body?.getReader();
  if (!reader) return json('사진을 선택해 주세요.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > NOTICE_IMAGE_MAX_BYTES) {
      await reader.cancel();
      return json('사진 용량이 너무 커요.', 413);
    }
    chunks.push(value);
  }
  let bytes: Buffer;
  try {
    bytes = await processNoticeImage(Buffer.concat(chunks));
  } catch {
    return json(
      '사진을 읽지 못했어요. JPG, PNG, WebP 사진을 다시 선택해 주세요.',
      400,
    );
  }
  const { error } = await storage.upload(path, bytes, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error)
    return json(
      '사진을 첨부하지 못했어요. 편집 권한과 연결을 확인해 주세요.',
      409,
    );
  return Response.json(
    { id: imageId },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export async function GET(request: Request, context: Context) {
  try {
    return await handle(request, context);
  } catch {
    return json('사진을 불러오지 못했어요.', 503);
  }
}
export async function PUT(request: Request, context: Context) {
  try {
    return await handle(request, context);
  } catch {
    return json('사진을 첨부하지 못했어요.', 503);
  }
}
