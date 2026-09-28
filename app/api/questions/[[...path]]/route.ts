import { cookies } from 'next/headers';
import { z } from 'zod';

import {
  type QuestionBlockRow,
  questionBlockSchema,
} from '@/app/(private)/dashboard/_views/questions/lib/question-blocks';
import { withQuestionnaireUsage } from '@/app/(private)/dashboard/_views/questions/lib/question-usage';
import { getViewRole } from '@/lib/admin';
import { getUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path?: string[] }> };

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });

function errorStatus(code?: string) {
  if (code === '42501') return 403;
  if (code === '40001' || code === '55000' || code === '23505') return 409;
  if (code === '22023' || code === '23503' || code === '23514') return 400;
  if (code === 'P0002') return 404;
  return 503;
}

function errorMessage(message: string, status: number) {
  if (message.includes('used by a questionnaire'))
    return '질문지에 배치된 질문이에요. 해당 질문지에서 제거한 뒤 삭제해 주세요.';
  if (message.includes('dependency cycle'))
    return '질문의 선후관계가 순환해요.';
  if (message.includes('used by another block'))
    return '다른 질문이 참조하고 있어 삭제할 수 없어요.';
  if (message.includes('Referenced answer fields'))
    return '다른 질문에서 참조하는 열이나 행 구성은 바꿀 수 없어요.';
  if (status === 409)
    return '다른 곳에서 질문이 변경됐어요. 목록을 확인해 주세요.';
  if (status === 403) return '이 질문을 수정할 권한이 없어요.';
  if (status === 400) return '질문 설정과 참조 대상을 확인해 주세요.';
  return '질문을 처리하지 못했어요.';
}

const saveRequestSchema = z.object({
  document: questionBlockSchema,
  expectedRevision: z.number().int().min(0),
  saveId: z.uuid(),
});

const archiveRequestSchema = z.object({
  expectedRevision: z.number().int().min(1),
});

async function handle(request: Request, context: Context) {
  const access = await getUserAccess();
  if (!access.user) return json({ error: '로그인이 필요해요.' }, 401);
  if (
    !access.isOnboarded ||
    !['admin', 'consultant_lead'].includes(access.role ?? '')
  ) {
    return json({ error: '질문 관리 권한이 없어요.' }, 403);
  }
  const userId = access.user.id;
  const path = (await context.params).path ?? [];
  const id = path[0];
  const client = createClient(await cookies());

  if (request.method === 'GET') {
    const viewRole = await getViewRole(access.role!);
    const ownOnly = viewRole !== 'admin';
    if (path.length > 1 || (id && !z.uuid().safeParse(id).success)) {
      return json({ error: '경로를 찾을 수 없어요.' }, 404);
    }
    if (id) {
      let query = client
        .from('questions')
        .select(
          '*, details:question_details(id,title,text:body,visibleToConsultants:visible_to_consultants,position)',
        )
        .eq('id', id)
        .is('archived_at', null);
      if (ownOnly) query = query.eq('created_by', userId);
      const result = await query
        .maybeSingle()
        .overrideTypes<QuestionBlockRow, { merge: false }>();
      if (result.error)
        return json({ error: '질문을 불러오지 못했어요.' }, 503);
      if (!result.data) return json({ error: '질문을 찾을 수 없어요.' }, 404);
      return json({ block: result.data, userId: access.user.id });
    }
    const params = new URL(request.url).searchParams;
    if (params.has('page') || params.has('search')) {
      const parsed = z
        .object({
          page: z.coerce.number().int().min(1).max(100000),
          search: z.string().max(200),
        })
        .safeParse({
          page: params.get('page') ?? '1',
          search: params.get('search') ?? '',
        });
      if (!parsed.success)
        return json({ error: '검색어와 페이지를 확인해 주세요.' }, 400);
      if (access.role === 'admin' && ownOnly) {
        // Filter before counting and paging so preview pages stay full and totals
        // never include other authors. RLS and actual account privileges stay intact.
        const columns =
          'id,created_by,title,prompt,fields,row_mode,max_rows,source_block_id,source_field_id,after_block_id,condition,revision,created_at,updated_at,archived_at';
        const pattern =
          '%' + parsed.data.search.trim().replace(/[\\%_]/g, '\\$&') + '%';
        const pageSize = 10;
        const readPage = (page: number) =>
          client
            .from('questions')
            .select(columns, { count: 'exact' })
            .eq('created_by', userId)
            .is('archived_at', null)
            .ilike('search_text', pattern)
            .order('updated_at', { ascending: false })
            .order('id', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1);
        let result = await readPage(parsed.data.page);
        if (result.error)
          return json({ error: '질문 목록을 불러오지 못했어요.' }, 503);
        const total = result.count ?? 0;
        const page = Math.min(
          parsed.data.page,
          Math.max(1, Math.ceil(total / pageSize)),
        );
        if (page !== parsed.data.page) result = await readPage(page);
        if (result.error)
          return json({ error: '질문 목록을 불러오지 못했어요.' }, 503);
        const blocks = (result.data ?? []) as QuestionBlockRow[];
        const ids = [
          ...new Set(
            blocks
              .flatMap((block) => [
                block.source_block_id,
                block.after_block_id,
                ...(block.condition?.clauses.map((clause) => clause.blockId) ??
                  []),
              ])
              .filter(
                (id): id is string =>
                  !!id && !blocks.some((block) => block.id === id),
              ),
          ),
        ];
        let references: QuestionBlockRow[] = [];
        if (ids.length) {
          const linked = await client
            .from('questions')
            .select(columns)
            .eq('created_by', userId)
            .is('archived_at', null)
            .in('id', ids);
          if (linked.error)
            return json({ error: '참조 질문을 불러오지 못했어요.' }, 503);
          references = (linked.data ?? []) as QuestionBlockRow[];
        }
        return json({
          blocks: await withQuestionnaireUsage(client, blocks, userId, ownOnly),
          references,
          total,
          page,
          pageSize,
          userId: access.user.id,
          role: viewRole,
        });
      }
      const result = await client.rpc('list_questions_page', {
        p_page: parsed.data.page,
        p_search: parsed.data.search.trim(),
      });
      if (result.error)
        return json({ error: '질문 목록을 불러오지 못했어요.' }, 503);
      return json({
        ...result.data,
        blocks: await withQuestionnaireUsage(
          client,
          result.data.blocks ?? [],
          userId,
          ownOnly,
        ),
        userId: access.user.id,
        role: viewRole,
      });
    }
    // Graphs, question relationships and the composer explicitly request the full
    // library. Batch reads to avoid the Data API's per-response row limit.
    const relationshipsOnly = params.get('mode') === 'relationships';
    const columns = relationshipsOnly
      ? 'id,created_by,title,prompt,fields,row_mode,max_rows,source_block_id,source_field_id,after_block_id,condition,revision,created_at,updated_at,archived_at'
      : '*, details:question_details(id,title,text:body,visibleToConsultants:visible_to_consultants,position)';
    const blocks: QuestionBlockRow[] = [];
    const batchSize = 500;
    for (let start = 0; ; start += batchSize) {
      let query = client
        .from('questions')
        .select(columns)
        .is('archived_at', null);
      if (ownOnly) query = query.eq('created_by', userId);
      const result = await query
        .order('updated_at', { ascending: false })
        .order('id', { ascending: false })
        .range(start, start + batchSize - 1)
        .overrideTypes<QuestionBlockRow[], { merge: false }>();
      if (result.error)
        return json({ error: '질문을 불러오지 못했어요.' }, 503);
      blocks.push(...(result.data ?? []));
      if (!result.data || result.data.length < batchSize) break;
    }
    return json({ blocks, userId: access.user.id, role: viewRole });
  }

  const origin = request.headers.get('origin');
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return json({ error: '허용되지 않은 요청이에요.' }, 403);
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'JSON 요청이 필요해요.' }, 415);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 1000000) {
    return json({ error: '요청이 너무 커요.' }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: '잘못된 JSON 요청이에요.' }, 400);
  }

  if (request.method === 'POST' || request.method === 'PUT') {
    if (
      (request.method === 'POST' && path.length !== 0) ||
      (request.method === 'PUT' &&
        (path.length !== 1 || !z.uuid().safeParse(id).success))
    ) {
      return json({ error: '경로를 찾을 수 없어요.' }, 404);
    }
    const parsed = saveRequestSchema.safeParse(body);
    if (!parsed.success || (id && parsed.data.document.id !== id)) {
      return json({ error: '질문 내용을 확인해 주세요.' }, 400);
    }
    if (request.method === 'POST' && parsed.data.expectedRevision !== 0) {
      return json({ error: '새 질문의 수정 번호를 확인해 주세요.' }, 400);
    }
    const result = await client
      .rpc('save_question', {
        p_document: parsed.data.document,
        p_expected_revision: parsed.data.expectedRevision,
        p_save_id: parsed.data.saveId,
      })
      .overrideTypes<QuestionBlockRow, { merge: false }>();
    if (result.error) {
      const status = errorStatus(result.error.code);
      return json(
        { error: errorMessage(result.error.message, status) },
        status,
      );
    }
    return json({ block: result.data }, request.method === 'POST' ? 201 : 200);
  }

  if (
    request.method === 'DELETE' &&
    path.length === 1 &&
    z.uuid().safeParse(id).success
  ) {
    const parsed = archiveRequestSchema.safeParse(body);
    if (!parsed.success)
      return json({ error: '수정 번호를 확인해 주세요.' }, 400);
    const result = await client
      .rpc('archive_question', {
        p_id: id,
        p_expected_revision: parsed.data.expectedRevision,
      })
      .overrideTypes<QuestionBlockRow, { merge: false }>();
    if (result.error) {
      const status = errorStatus(result.error.code);
      return json(
        { error: errorMessage(result.error.message, status) },
        status,
      );
    }
    return json({ block: result.data });
  }
  return json({ error: '경로를 찾을 수 없어요.' }, 404);
}

export async function GET(request: Request, context: Context) {
  return handle(request, context);
}

export async function POST(request: Request, context: Context) {
  return handle(request, context);
}

export async function PUT(request: Request, context: Context) {
  return handle(request, context);
}

export async function DELETE(request: Request, context: Context) {
  return handle(request, context);
}
