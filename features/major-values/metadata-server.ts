import type { SupabaseClient } from '@supabase/supabase-js';

import type { ValuesContext } from './domain';
import { metadataSchema } from './metadata';

import 'server-only';

// Uses the existing SECURITY INVOKER RPC; inheritance/refinement stays in the DB.
export async function loadValuesMetadata(
  db: SupabaseClient,
  context: ValuesContext,
) {
  const chosen = [
    ...new Map(
      context.interests.map((i) => [
        i.majorName,
        { id: i.majorId, name: i.majorName },
      ]),
    ).values(),
  ];
  if (chosen.length < 1 || chosen.length > 3)
    throw new Error('전공 정보를 확인해주세요.');
  const { data: majors, error: lookupError } = await db
    .from('majors')
    .select('id,name')
    .in(
      'name',
      chosen.map((m) => m.name),
    );
  if (lookupError || majors?.length !== chosen.length)
    throw new Error('선택한 전공을 조회하지 못했습니다.');
  const majorIds = chosen.map((m) => {
    const row = majors.find((row) => row.name === m.name);
    if (!row || (m.id && row.id !== m.id))
      throw new Error('전공 ID와 이름이 일치하지 않습니다.');
    return row.id as string;
  });
  const { data, error } = await db.rpc('get_major_value_context', {
    p_major_ids: majorIds,
    p_include_keywords: true,
  });
  if (error)
    throw new Error(
      '전공 가치관 탐색 자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    );
  const metadata = metadataSchema.parse(data);
  if (
    metadata.majors.length !== majorIds.length ||
    !majorIds.every((id) => metadata.majors.some((m) => m.major.id === id))
  )
    throw new Error('전공 탐색 자료가 누락되었습니다.');
  for (const interest of context.interests) {
    const major = metadata.majors.find(
      (m) => m.major.name === interest.majorName,
    );
    if (
      !major ||
      (interest.majorId && interest.majorId !== major.major.id) ||
      (interest.keywordId &&
        !major.keywords.some((k) => k.id === interest.keywordId))
    )
      throw new Error('전공 또는 키워드 참조를 확인해주세요.');
  }
  return metadata;
}
