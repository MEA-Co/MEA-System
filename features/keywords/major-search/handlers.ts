import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import { loadCatalog } from './catalog';
import { normalizeMajorInput, searchCatalog } from './domain';
import { majorSearchDb } from './server';

import 'server-only';

const common = {
  requestId: z.uuid(),
  sessionId: z.uuid(),
  input: z.string().min(1).max(120),
  catalogVersion: z.string().max(64),
};
const schema = z.discriminatedUnion('op', [
  z.object({ ...common, op: z.literal('confirm'), majorId: z.uuid() }).strict(),
  z.object({ ...common, op: z.literal('no_match') }).strict(),
]);
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function handleMajorSearch(input: unknown) {
  const access = await getUserAccess();
  if (!access.user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (!hasRole(access, MEMBER_ROLES))
    return json({ error: '권한이 없습니다.' }, 403);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return json({ error: '잘못된 요청입니다.' }, 400);
  const body = parsed.data;
  const normalized = normalizeMajorInput(body.input);
  if (!normalized) return json({ error: '전공명을 입력해 주세요.' }, 400);
  try {
    const { catalog, version } = await loadCatalog(
      createClient(await cookies()),
    );
    const candidates = searchCatalog(catalog, body.input);
    if (body.catalogVersion !== version)
      return json(
        { error: '전공 목록이 변경되었습니다. 다시 검색해 주세요.' },
        409,
      );
    if (body.op === 'no_match') {
      const { data, error } = await majorSearchDb().rpc(
        'record_major_no_match',
        {
          p_request_id: body.requestId,
          p_user_id: access.user.id,
          p_session_id: body.sessionId,
          p_input_text: body.input,
          p_normalized_input: normalized,
          p_candidates: candidates,
          p_catalog_version: version,
        },
      );
      if (error)
        return json(
          {
            error:
              error.code === 'PGRST202'
                ? '전공 미매칭 기록을 위한 DB 함수 적용이 필요합니다.'
                : '찾는 학과 없음 기록을 저장하지 못했습니다. 다시 눌러 주세요.',
          },
          503,
        );
      return json({ noMatch: data });
    }
    if (!candidates.some((c) => c.id === body.majorId))
      return json({ error: '제시된 후보에서 전공을 선택해 주세요.' }, 409);
    const { data, error } = await majorSearchDb().rpc('confirm_major_search', {
      p_request_id: body.requestId,
      p_user_id: access.user.id,
      p_session_id: body.sessionId,
      p_input_text: body.input,
      p_normalized_input: normalized,
      p_candidates: candidates,
      p_catalog_version: version,
      p_major_id: body.majorId,
      p_model_name: null,
      p_model_version: null,
      p_prompt_version: null,
    });
    if (error)
      return json(
        {
          error:
            error.code === 'PGRST202'
              ? '전공 확정 저장을 위한 DB 함수 적용이 필요합니다.'
              : '확정 내용을 저장하지 못했습니다. 다시 시도해 주세요.',
        },
        503,
      );
    return json({ confirmed: data });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : '전공 검색을 처리하지 못했습니다.',
      },
      503,
    );
  }
}
export async function handleMajorCatalog() {
  const access = await getUserAccess();
  if (!access.user) return json({ error: '로그인이 필요합니다.' }, 401);
  if (!hasRole(access, MEMBER_ROLES))
    return json({ error: '권한이 없습니다.' }, 403);
  try {
    return json(await loadCatalog(createClient(await cookies())));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : '전공 목록을 불러오지 못했습니다.',
      },
      503,
    );
  }
}
