import { cookies } from 'next/headers';
import { z } from 'zod';

import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import {
  confirmedContent,
  confirmLinkSchema,
} from '@/lib/exploration-links/model';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) {
  const access = await getUserAccess();
  if (!access.user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (
    !access.isOnboarded ||
    !['consultant', 'consultant_lead', 'admin'].includes(access.role ?? '')
  )
    return json({ error: '탐구줄기 관리 권한이 없습니다.' }, 403);
  const url = new URL(req.url);
  if (
    req.method !== 'GET' &&
    req.headers.get('origin') &&
    req.headers.get('origin') !== url.origin
  )
    return json({ error: '잘못된 요청입니다.' }, 403);
  const view = await getViewRole(access.role!);
  const others = ['admin', 'consultant_lead'].includes(view);
  const client = createClient(await cookies());
  const path = (await context.params).path ?? [];
  const id = path[0];
  if (
    path.length > 1 ||
    (id && id !== 'skills' && !z.uuid().safeParse(id).success)
  )
    return json({ error: '잘못된 경로입니다.' }, 404);
  if (!id && req.method === 'POST') {
    const parsed = z
      .object({
        scope: z.enum(['own', 'others']).default('own'),
        query: z.string().trim().max(200).default(''),
        page: z.number().int().min(1).max(100000).default(1),
        excluded: z.array(z.uuid()).max(10000).default([]),
        localCount: z.number().int().min(0).max(10000).default(0),
      })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      return json({ error: '목록 조건을 확인해 주세요.' }, 400);
    const d = parsed.data;
    if (d.scope === 'others' && !others)
      return json({ error: '조회 권한이 없습니다.' }, 403);
    const { data, error } = await client
      .rpc('read_exploration_link_page', {
        p_scope: d.scope,
        p_query: d.query,
        p_page: d.page,
        p_excluded: d.excluded,
        p_local_count: d.localCount,
      })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return json(data);
  }
  if (id === 'skills' && req.method === 'GET') {
    const parsed = z
      .object({
        q: z.string().trim().max(200),
        page: z.coerce.number().int().min(1).max(100000),
      })
      .safeParse({
        q: url.searchParams.get('q') ?? '',
        page: url.searchParams.get('page') ?? 1,
      });
    if (!parsed.success)
      return json({ error: '검색 조건을 확인해 주세요.' }, 400);
    const { q, page } = parsed.data;
    // Escaped substring, not PostgREST filter syntax; own reusable skills only.
    const literal = q.replace(/[\\%_]/g, '\\$&');
    const { data, count, error } = await client
      .from('exploration_link_skills')
      .select('id,name,description,updated_at', { count: 'exact' })
      .eq('owner_id', access.user.id)
      .ilike('name', `%${literal}%`)
      .order('updated_at', { ascending: false })
      .order('id')
      .range((page - 1) * 10, page * 10 - 1)
      .abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return json({
      items: (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        updatedAt: s.updated_at,
      })),
      total: count ?? 0,
      page,
    });
  }
  if (!id || id === 'skills')
    return json({ error: '지원하지 않는 요청입니다.' }, 405);
  if (req.method === 'GET') {
    let query = client
      .from('exploration_links')
      .select(
        'id,owner_id,name,description,graph,node_count,revision,updated_at',
      )
      .eq('id', id)
      .is('deleted_at', null);
    if (!others) query = query.eq('owner_id', access.user.id);
    const { data, error } = await query
      .abortSignal(AbortSignal.timeout(10000))
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return json(
        { error: '탐구줄기를 찾을 수 없거나 열람 권한이 없습니다.' },
        404,
      );
    const ids = [
      ...new Set<string>(
        (data.graph.edges as { skillId?: string }[]).flatMap((e) =>
          e.skillId ? [e.skillId] : [],
        ),
      ),
    ];
    const skills = ids.length
      ? await client
          .from('exploration_link_skills')
          .select('id,name,description,updated_at')
          .in('id', ids)
          .eq('owner_id', data.owner_id)
          .abortSignal(AbortSignal.timeout(10000))
      : { data: [], error: null };
    if (skills.error) throw skills.error;
    return json({
      link: {
        ...data,
        skills: (skills.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          updatedAt: s.updated_at,
        })),
      },
    });
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 2500000)
    return json({ error: '저장할 내용이 너무 큽니다.' }, 400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }
  let result;
  if (req.method === 'PUT') {
    const parsed = confirmLinkSchema.safeParse(body);
    if (!parsed.success)
      return json(
        { error: '이름과 연결 정보, 스킬 이름·설명을 확인해 주세요.' },
        400,
      );
    result = await client
      .rpc('save_exploration_link', {
        p_id: id,
        p_content: confirmedContent(parsed.data.content),
        p_expected_revision: parsed.data.expectedRevision,
        p_save_id: parsed.data.saveId,
      })
      .abortSignal(AbortSignal.timeout(15000));
  } else if (req.method === 'DELETE') {
    const parsed = z
      .object({ expectedRevision: z.number().int().positive() })
      .safeParse(body);
    if (!parsed.success)
      return json({ error: '삭제 정보를 확인해 주세요.' }, 400);
    result = await client
      .rpc('delete_exploration_link', {
        p_id: id,
        p_expected_revision: parsed.data.expectedRevision,
      })
      .abortSignal(AbortSignal.timeout(15000));
  } else return json({ error: '지원하지 않는 요청입니다.' }, 405);
  if (result.error) {
    const code = result.error.code;
    const status = ['40001', '23505'].includes(code)
      ? 409
      : code === '42501'
        ? 403
        : ['22023', '22P02'].includes(code)
          ? 400
          : 503;
    return json(
      {
        error:
          status === 409
            ? '다른 곳에서 탐구줄기 또는 연계 스킬이 변경되었습니다. 현재 입력을 임시저장한 뒤 최신 확정본을 확인해 주세요.'
            : status === 400
              ? '활동이 삭제되었거나 연결 정보가 올바르지 않습니다. 활동과 연결을 확인해 주세요.'
              : '저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.',
      },
      status,
    );
  }
  return json(req.method === 'PUT' ? { link: result.data } : { ok: true });
}
async function route(req: Request, context: Context) {
  try {
    return await handle(req, context);
  } catch {
    return json(
      { error: '요청을 처리하지 못했습니다. 입력은 유지됩니다.' },
      503,
    );
  }
}
export { route as DELETE,route as GET, route as POST, route as PUT };
