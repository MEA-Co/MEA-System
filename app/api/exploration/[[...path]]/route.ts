import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  type ActivityRow,
  confirmRequestSchema,
  REPORT_BUCKET,
} from '@/app/(private)/dashboard/_views/exploration/lib/storage-model';
import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
type Context = { params: Promise<{ path?: string[] }> };
async function handle(request: Request, context: Context) {
  const access = await getUserAccess();
  if (!access.user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (
    !access.isOnboarded ||
    !['consultant', 'consultant_lead', 'admin'].includes(access.role ?? '')
  )
    return json({ error: '탐구활동 관리 권한이 없습니다.' }, 403);
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return json({ error: '잘못된 요청입니다.' }, 403);
  }
  const viewRole = await getViewRole(access.role!);
  const ownOnly = viewRole !== 'admin' && viewRole !== 'consultant_lead';
  const client = createClient(await cookies());
  const path = (await context.params).path ?? [];
  const id = path[0];
  if (id && !z.uuid().safeParse(id).success)
    return json({ error: '잘못된 경로입니다.' }, 404);
  if (request.method === 'GET' && !id) {
    const activities: ActivityRow[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client
        .from('exploration')
        .select('*, owner:profiles!owner_id(name)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .order('id')
        .range(offset, offset + 499);
      if (ownOnly) query = query.eq('owner_id', access.user.id);
      const { data, error } = await query;
      if (error)
        return json(
          {
            error:
              '확정된 탐구활동을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          },
          503,
        );
      activities.push(...(data as ActivityRow[]));
      if (data.length < 500) break;
    }
    return json({ activities });
  }
  if (request.method === 'GET' && path.length === 3 && path[1] === 'files') {
    let query = client
      .from('exploration')
      .select('reports')
      .eq('id', id)
      .is('deleted_at', null);
    if (ownOnly) query = query.eq('owner_id', access.user.id);
    const { data, error } = await query.maybeSingle();
    if (error) return json({ error: '파일을 불러오지 못했습니다.' }, 503);
    const report = (data?.reports as ActivityRow['reports'] | undefined)?.find(
      (r) => r.clientKey === path[2],
    );
    if (!report?.path)
      return json({ error: '첨부 파일을 찾을 수 없습니다.' }, 404);
    const result = await client.storage
      .from(REPORT_BUCKET)
      .createSignedUrl(report.path, 60, { download: report.name });
    return result.error
      ? json({ error: '다운로드 링크를 생성하지 못했습니다.' }, 503)
      : json({ url: result.data.signedUrl });
  }
  if (!id || path.length !== 1)
    return json({ error: '잘못된 경로입니다.' }, 404);
  const body = await request.json().catch(() => null);
  if (request.method === 'PUT') {
    const parsed = confirmRequestSchema.safeParse(body);
    if (!parsed.success || parsed.data.id !== id)
      return json({ error: '필수 항목과 첨부 파일을 확인해 주세요.' }, 400);
    const d = parsed.data;
    const { data, error } = await client.rpc('save_exploration', {
      p_id: id,
      p_values: d.values,
      p_reports: d.reports,
      p_expected_revision: d.expectedRevision,
      p_save_id: d.saveId,
    });
    if (error) {
      const status =
        error.code === '42501'
          ? 403
          : ['40001', '23505'].includes(error.code)
            ? 409
            : ['22023', '22P02'].includes(error.code)
              ? 400
              : 503;
      return json(
        {
          error:
            status === 409
              ? '다른 곳에서 수정되었거나 삭제된 탐구활동입니다. 현재 입력을 임시저장한 뒤 목록의 최신 확정본을 확인해 주세요.'
              : status === 400
                ? '필수 항목 또는 첨부 파일 업로드를 확인해 주세요.'
                : '탐구활동을 확정하지 못했습니다. 다시 시도해 주세요.',
        },
        status,
      );
    }
    return json({ activity: data });
  }
  if (request.method === 'DELETE') {
    const parsed = z
      .object({ expectedRevision: z.number().int().positive() })
      .safeParse(body);
    if (!parsed.success)
      return json({ error: '삭제 정보를 확인해 주세요.' }, 400);
    const { data: before } = await client
      .from('exploration')
      .select('reports')
      .eq('id', id)
      .eq('owner_id', access.user.id)
      .maybeSingle();
    const { error } = await client.rpc('delete_exploration', {
      p_id: id,
      p_expected_revision: parsed.data.expectedRevision,
    });
    if (error)
      return json(
        {
          error:
            '삭제하지 못했습니다. 목록을 새로 불러와 변경 여부를 확인해 주세요.',
        },
        error.code === '40001' ? 409 : 403,
      );
    const paths = ((before?.reports ?? []) as ActivityRow['reports']).flatMap(
      (r) => (r.path ? [r.path] : []),
    );
    const cleanup = paths.length
      ? await client.storage.from(REPORT_BUCKET).remove(paths)
      : null;
    return json({ ok: true, cleanupPending: !!cleanup?.error });
  }
  return json({ error: '지원하지 않는 요청입니다.' }, 405);
}
async function route(request: Request, context: Context) {
  try {
    return await handle(request, context);
  } catch {
    return json(
      { error: '요청을 처리하지 못했습니다. 입력 내용은 유지됩니다.' },
      503,
    );
  }
}
export { route as DELETE, route as GET, route as PUT };
