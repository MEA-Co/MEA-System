import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd(), true);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(
  new URL(url).origin,
  'http://127.0.0.1:54321',
  'Local Supabase only',
);
const auth = { persistSession: false, autoRefreshToken: false };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth });
const lead = process.argv.includes('--lead');
const role = lead ? 'consultant_lead' : 'consultant';
const email = lead
  ? 'codex-consultant-lead@example.test'
  : 'codex-consultant@example.test';
const file = lead
  ? '.env.local-consultant-lead.json'
  : '.env.local-consultant.json';
const credentials = existsSync(file)
  ? JSON.parse(readFileSync(file, 'utf8'))
  : {
      email,
      password: randomBytes(24).toString('base64url'),
    };
assert.equal(credentials.email, email);
const client = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth },
);
let login = await client.auth.signInWithPassword(credentials);
if (login.error) {
  const created = await admin.auth.admin.createUser({
    ...credentials,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  writeFileSync(file, JSON.stringify(credentials, null, 2) + '\n', {
    mode: 0o600,
  });
  login = await client.auth.signInWithPassword(credentials);
}
if (login.error) throw login.error;
const id = login.data.user.id;
const existing = await admin
  .from('profiles')
  .select('role')
  .eq('id', id)
  .maybeSingle();
if (existing.error) throw existing.error;
if (!existing.data) {
  const result = await admin
    .from('profiles')
    .insert({
      id,
      role,
      name: lead ? '로컬 테스트 컨설턴트 리드' : '로컬 테스트 컨설턴트',
    });
  if (result.error) throw result.error;
}
const profile = await client
  .from('profiles')
  .select('id,name,role')
  .eq('id', id)
  .single();
if (profile.error) throw profile.error;
assert.equal(profile.data.role, role);
await client.auth.signOut();
// eslint-disable-next-line no-console -- Report local account verification without credentials.
console.log({
  ...profile.data,
  email: credentials.email,
  credentialsFile: file,
  verified: true,
});
