// Local Supabase only. Creates disposable accounts; never loads application .env files.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
);
const config = status.API_URL ? status : (status.data ?? status);
const url = config.API_URL;
assert.ok(
  url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname),
  'Only a local Supabase URL is allowed',
);
const admin = createClient(url, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [];
const objectPaths = [];
const bucket = 'exploration-reports';
async function account(role) {
  const email = `exploration-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(created.error, null);
  users.push(created.data.user.id);
  assert.equal(
    (
      await admin
        .from('profiles')
        .insert({ id: created.data.user.id, role, name: '탐구활동 로컬 검사' })
    ).error,
    null,
  );
  const client = createClient(url, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.equal(
    (await client.auth.signInWithPassword({ email, password })).error,
    null,
  );
  return { client, id: created.data.user.id };
}
try {
  const owner = await account('consultant');
  const other = await account('consultant_lead');
  const id = randomUUID();
  const fileId = randomUUID();
  const path = `${owner.id}/${id}/${fileId}.pdf`;
  objectPaths.push(path);
  const bytes = new Uint8Array(1024);
  bytes.set(new TextEncoder().encode('%PDF-1.4\n'));
  assert.equal(
    (
      await owner.client.storage
        .from(bucket)
        .upload(path, bytes, { contentType: 'application/pdf' })
    ).error,
    null,
    'Owner upload',
  );
  assert.ok(
    (await other.client.storage.from(bucket).download(path)).error,
    'Other account cannot download',
  );
  const anonymous = createClient(url, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(
    (await anonymous.storage.from(bucket).download(path)).error,
    'Anonymous cannot download',
  );
  const unauthorized = `${owner.id}/${id}/${randomUUID()}.pdf`;
  assert.ok(
    (await other.client.storage.from(bucket).upload(unauthorized, bytes)).error,
    'Other account cannot upload into owner folder',
  );
  const tooLarge = `${owner.id}/${id}/${randomUUID()}.pdf`;
  assert.ok(
    (
      await owner.client.storage
        .from(bucket)
        .upload(tooLarge, new Uint8Array(20 * 1024 * 1024 + 1))
    ).error,
    '20 MB bucket limit',
  );
  const values = {
    grade: '2',
    semester: '1',
    recordType: '세특',
    recordArea: '과학',
    schoolContext: '수행평가',
    topic: '로컬 파일 통합 검사',
    record: '내용',
    competencies: '문제 해결',
    motivation: '기획',
    story: '수행',
    result: '결과',
    followup: '',
    references: [],
  };
  const report = {
    clientKey: fileId,
    path,
    name: '보고서.pdf',
    size: bytes.length,
    type: 'application/pdf',
    lastModified: 1,
  };
  const args = {
    p_id: id,
    p_values: values,
    p_reports: [report],
    p_expected_revision: 0,
    p_save_id: randomUUID(),
  };
  const saved = await owner.client.rpc('save_exploration', args);
  assert.equal(saved.error, null, `Confirm: ${saved.error?.message}`);
  assert.equal(saved.data.revision, 1);
  assert.equal(
    (await owner.client.rpc('save_exploration', args)).data.revision,
    1,
    'Idempotent retry',
  );
  assert.equal(
    (
      await other.client
        .from('exploration')
        .select('id')
        .eq('id', id)
    ).data.length,
    0,
  );
  await owner.client.storage.from(bucket).remove([path]);
  assert.equal(
    (await owner.client.storage.from(bucket).info(path)).error,
    null,
    'Referenced file is protected from deletion',
  );
  const signed = await owner.client.storage
    .from(bucket)
    .createSignedUrl(path, 60, { download: report.name });
  assert.equal(signed.error, null);
  const downloaded = await fetch(signed.data.signedUrl);
  assert.equal(downloaded.status, 200);
  assert.equal((await downloaded.arrayBuffer()).byteLength, bytes.length);
  assert.equal(
    (
      await owner.client.rpc('delete_exploration', {
        p_id: id,
        p_expected_revision: 1,
      })
    ).error,
    null,
  );
  assert.equal(
    (await owner.client.storage.from(bucket).remove([path])).error,
    null,
  );
  assert.ok(
    (await owner.client.storage.from(bucket).info(path)).error,
    'Deleted record releases attachment',
  );
  process.stdout.write(
    'PASS: upload, 20MB limit, cross-account/anonymous denial, confirmation, retry, signed download, protected/delete attachment\n',
  );
} finally {
  if (objectPaths.length) await admin.storage.from(bucket).remove(objectPaths);
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Failed to clean up local test account');
  }
}
