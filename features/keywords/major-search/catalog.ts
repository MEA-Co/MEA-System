import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Alias, CatalogMajor } from './domain';

import 'server-only';

async function rows(db: SupabaseClient, table: string, columns: string) {
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order('id')
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        '전공 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    all.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < 500) return all;
  }
}
export async function loadCatalog(db: SupabaseClient) {
  const [majors, fields, aliases] = await Promise.all([
    rows(
      db,
      'majors',
      'id,name,description,field_id,group_name,item_type,sort_order',
    ),
    rows(db, 'fields', 'id,name'),
    rows(db, 'major_aliases', 'id,major_id,name,alias_type'),
  ]);
  const catalog = majors.map((major) => ({
    ...major,
    field_name: fields.find((f) => f.id === major.field_id)?.name ?? '',
    aliases: aliases
      .filter((a) => a.major_id === major.id)
      .map((a) => ({ name: a.name, alias_type: a.alias_type }) as Alias),
  })) as CatalogMajor[];
  if (!catalog.length) throw new Error('전공 목록이 아직 준비되지 않았습니다.');
  return {
    catalog,
    version: createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),
  };
}
