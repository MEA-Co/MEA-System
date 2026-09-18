/* eslint-disable no-console -- Standalone verification reports its results. */
// Read-only smoke test against the configured catalog. Never prints credentials.
import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

import {
  metadataReferences,
  metadataSchema,
} from '../features/major-values/metadata.ts';
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(key, 'Server catalog key required');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: majors, error } = await db
  .from('majors')
  .select('id,name')
  .in('name', ['컴퓨터·소프트웨어공학', '심리학']);
assert.ifError(error);
assert.equal(majors.length, 2);
const { data, error: rpcError } = await db.rpc('get_major_value_context', {
  p_major_ids: majors.map((m) => m.id),
  p_include_keywords: true,
});
assert.ifError(rpcError);
const metadata = metadataSchema.parse(data);
const references = metadataReferences(metadata);
for (const major of metadata.majors) {
  assert.ok(major.inquiry_dimensions.length);
  assert.ok(major.value_lenses.length);
  assert.ok(major.keywords.length);
  const refinedParents = new Set(
    major.value_lenses
      .filter((l) => l.relation === 'refine')
      .map((l) => l.parent_id),
  );
  assert.ok(
    !major.value_lenses.some((l) => refinedParents.has(l.id)),
    'Refined parents must not appear twice',
  );
}
console.log(
  JSON.stringify(
    {
      version: metadata.metadata_version,
      majors: metadata.majors.map((m) => ({
        name: m.major.name,
        dimensions: m.inquiry_dimensions.length,
        lenses: m.value_lenses.length,
        tensions: m.value_tensions.length,
        keywords: m.keywords.length,
      })),
      coreValueReferences: references.coreValueIds.length,
    },
    null,
    2,
  ),
);
