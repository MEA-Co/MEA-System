import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { explorationPageSchema } from '@/lib/exploration/list-query';

export async function readExplorationPage(
  client: SupabaseClient,
  params: URLSearchParams,
  userId: string,
  ownOnly: boolean,
  localState: unknown = {},
) {
  const parsed = explorationPageSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success)
    return { status: 400, body: { error: '검색 조건을 확인해 주세요.' } };
  const merged = z
    .object({
      ids: z.array(z.uuid()).max(10000).default([]),
      count: z.number().int().min(0).max(10000).default(0),
    })
    .safeParse(localState);
  if (!merged.success)
    return { status: 400, body: { error: '임시저장 목록을 확인해 주세요.' } };
  const { scope, owner, q, page } = parsed.data;
  if (scope === 'others' && ownOnly)
    return {
      status: 403,
      body: { error: '다른 사람의 탐구활동을 조회할 권한이 없습니다.' },
    };
  const { data, error } = await client.rpc('read_exploration_page', {
    p_scope: scope,
    p_page: page,
    p_query: q,
    p_owner: owner || null,
    p_excluded: scope === 'own' ? merged.data.ids : [],
    p_local_count: scope === 'own' ? merged.data.count : 0,
    p_own_only: ownOnly,
  });
  if (error) throw error;
  return { status: 200, body: { ...data, userId } };
}

export async function readExplorationSummary(
  client: SupabaseClient,
  _userId: string,
  ownOnly: boolean,
) {
  const { data, error } = await client.rpc('read_exploration_summary', {
    p_own_only: ownOnly,
  });
  if (error) throw error;
  const authors: { id: string; label: string; count: number }[] = data.people;
  authors.sort(
    (a, b) => a.label.localeCompare(b.label, 'ko') || a.id.localeCompare(b.id),
  );
  const nameCounts = new Map<string, number>();
  for (const author of authors)
    nameCounts.set(author.label, (nameCounts.get(author.label) ?? 0) + 1);
  return {
    ...data,
    people: authors.map((author, index) => ({
      ...author,
      label:
        nameCounts.get(author.label)! > 1
          ? `${author.label} (${index + 1})`
          : author.label,
    })),
  };
}
