'use server';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import type { MajorOverview } from './types';

export async function getMajorOverviews(
  input: unknown,
): Promise<
  { data: MajorOverview[]; error?: never } | { error: string; data?: never }
> {
  const access = await getUserAccess();
  if (!access.user || !hasRole(access, MEMBER_ROLES))
    return { error: '로그인이 필요합니다.' };
  const parsed = z.array(z.uuid()).min(1).max(3).safeParse(input);
  if (!parsed.success) return { error: '전공 정보를 확인하지 못했습니다.' };
  try {
    const db = createClient(await cookies());
    const [majors, keywords, links] = await Promise.all([
      db.from('majors').select('id,name').in('id', parsed.data),
      db
        .from('major_keywords')
        .select('id,major_id,name,description,sort_order')
        .in('major_id', parsed.data)
        .order('sort_order')
        .order('id'),
      db
        .from('major_university_sources')
        .select('major_id,university_source_id,purpose')
        .in('major_id', parsed.data),
    ]);
    if (majors.error || keywords.error || links.error) throw Error();
    if (majors.data.length !== new Set(parsed.data).size)
      return { error: '전공 목록이 변경되었습니다. 다시 검색해 주세요.' };
    const keywordIds = keywords.data.map((k) => k.id);
    const sourceIds = [
      ...new Set(links.data.map((l) => l.university_source_id)),
    ];
    const [examples, sources] = await Promise.all([
      keywordIds.length
        ? db
            .from('keyword_examples')
            .select('id,keyword_id,label,sort_order')
            .in('keyword_id', keywordIds)
            .order('sort_order')
            .order('id')
        : Promise.resolve({ data: [], error: null }),
      sourceIds.length
        ? db
            .from('university_sources')
            .select('id,title,url,institution')
            .in('id', sourceIds)
            .order('institution')
            .order('title')
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (examples.error || sources.error) throw Error();
    return {
      data: parsed.data.map((id) => {
        const major = majors.data.find((m) => m.id === id)!;
        const majorLinks = links.data.filter((link) => link.major_id === id);
        const allowed = new Set(
          majorLinks.map((link) => link.university_source_id),
        );
        const priority = (sourceId: string) =>
          majorLinks.some(
            (link) =>
              link.university_source_id === sourceId &&
              link.purpose === 'major_info',
          )
            ? 0
            : 1;
        return {
          ...major,
          keywords: keywords.data
            .filter((k) => k.major_id === id)
            .map((k) => ({
              id: k.id,
              name: k.name,
              description: k.description,
              examples: examples.data
                .filter((e) => e.keyword_id === k.id)
                .map((e) => ({ id: e.id, label: e.label })),
            })),
          sites: sources.data
            .filter((s) => allowed.has(s.id))
            .sort((a, b) => priority(a.id) - priority(b.id))
            // Existing catalog directory sources are shared across unrelated majors.
            // Keep department-specific curriculum/introduction pages instead.
            .filter(
              (s) =>
                !/대학\s*및\s*(학과|전공)|대학교\s*대학\s*안내/.test(s.title),
            )
            .filter((s) => {
              try {
                const u = new URL(s.url);
                return (
                  ['https:', 'http:'].includes(u.protocol) &&
                  !u.username &&
                  !u.password
                );
              } catch {
                return false;
              }
            })
            .map((s) => ({
              department:
                s.institution && !s.title.includes(s.institution)
                  ? `${s.institution} · ${s.title}`
                  : s.title,
              url: s.url,
            })),
        };
      }),
    };
  } catch {
    return {
      error:
        '전공 키워드와 참고 사이트를 불러오지 못했습니다. 다시 시도해 주세요.',
    };
  }
}
