import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  STUDY_PAGE_SIZE,
  studyPageSchema,
  studySearchFilter,
} from '@/app/(private)/dashboard/_views/study/lib/list-query';

export async function readStudyPage(
  client: SupabaseClient,
  params: URLSearchParams,
  userId: string,
  ownOnly: boolean,
  localState: unknown = {},
) {
  const parsed = studyPageSchema.safeParse(Object.fromEntries(params));
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
  const excluded = new Set(scope === 'own' ? merged.data.ids : []);
  const localCount = scope === 'own' ? merged.data.count : 0;
  if (scope === 'others' && ownOnly)
    return {
      status: 403,
      body: { error: '다른 사람의 학습법을 조회할 권한이 없습니다.' },
    };
  const filter = (
    query: ReturnType<ReturnType<SupabaseClient['from']>['select']>,
  ) => {
    query = query.is('deleted_at', null);
    query =
      scope === 'own'
        ? query.eq('owner_id', userId)
        : query.neq('owner_id', userId);
    if (scope === 'others' && owner) query = query.eq('owner_id', owner);
    if (q) query = query.or(studySearchFilter(q));
    return query;
  };
  // Only IDs are scanned when local edits replace saved rows; bodies remain paginated.
  let availableIds: string[] | undefined;
  let remoteTotal: number;
  if (excluded.size) {
    availableIds = [];
    for (let offset = 0; ; offset += 500) {
      const result = await filter(client.from('study').select('id'))
        .order('updated_at', { ascending: false })
        .order('id')
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      availableIds.push(
        ...(result.data as { id: string }[])
          .map((row) => row.id)
          .filter((id) => !excluded.has(id)),
      );
      if (result.data.length < 500) break;
    }
    remoteTotal = availableIds.length;
  } else {
    const countResult = await filter(
      client.from('study').select('id', { count: 'exact', head: true }),
    );
    if (countResult.error) throw countResult.error;
    remoteTotal = countResult.count ?? 0;
  }
  const total = remoteTotal + localCount;
  const actualPage = Math.min(
    page,
    Math.max(1, Math.ceil(total / STUDY_PAGE_SIZE)),
  );
  const start = (actualPage - 1) * STUDY_PAGE_SIZE;
  const localRows = Math.min(STUDY_PAGE_SIZE, Math.max(0, localCount - start));
  const offset = Math.max(0, start - localCount);
  const limit = STUDY_PAGE_SIZE - localRows;
  let activities: unknown[] = [];
  if (limit && offset < remoteTotal) {
    let query = filter(
      client.from('study').select('*, owner:profiles!owner_id(name)'),
    )
      .order('updated_at', { ascending: false })
      .order('id');
    query = availableIds
      ? query.in('id', availableIds.slice(offset, offset + limit)).limit(limit)
      : query.range(offset, offset + limit - 1);
    const result = await query;
    if (result.error) throw result.error;
    activities = result.data;
  }
  return {
    status: 200,
    body: {
      userId,
      activities,
      total,
      page: actualPage,
      pageSize: STUDY_PAGE_SIZE,
    },
  };
}

export async function readStudySummary(
  client: SupabaseClient,
  userId: string,
  ownOnly: boolean,
) {
  const own = await client
    .from('study')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('owner_id', userId);
  if (own.error) throw own.error;
  const people = new Map<
    string,
    { id: string; label: string; count: number }
  >();
  // Only author metadata is scanned; no study bodies or attachments are loaded here.
  if (!ownOnly)
    for (let offset = 0; ; offset += 500) {
      const result = await client
        .from('study')
        .select('owner_id, owner:profiles!owner_id(name)')
        .is('deleted_at', null)
        .neq('owner_id', userId)
        .order('id')
        .range(offset, offset + 499);
      if (result.error) throw result.error;
      for (const row of result.data) {
        const previous = people.get(row.owner_id);
        const profile = row.owner as unknown as { name?: string } | null;
        people.set(row.owner_id, {
          id: row.owner_id,
          label: profile?.name?.trim() || '이름 비공개',
          count: (previous?.count ?? 0) + 1,
        });
      }
      if (result.data.length < 500) break;
    }
  const authors = [...people.values()].sort(
    (a, b) => a.label.localeCompare(b.label, 'ko') || a.id.localeCompare(b.id),
  );
  return {
    mine: own.count ?? 0,
    others: authors.reduce((sum, author) => sum + author.count, 0),
    people: authors.map((author, index) => ({
      ...author,
      label:
        authors.filter((p) => p.label === author.label).length > 1
          ? `${author.label} (${index + 1})`
          : author.label,
    })),
  };
}
