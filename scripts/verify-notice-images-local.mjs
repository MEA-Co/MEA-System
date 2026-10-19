// Local-only real Storage HTTP check. All created files/users/documents are removed.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

nextEnv.loadEnvConfig(process.cwd(), true);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(url, 'http://127.0.0.1:54321', 'Local database only');
const auth = { persistSession: false, autoRefreshToken: false };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth });
const users = [],
  paths = [];
let owner,
  document,
  revision = 0;
const bucket = 'questionnaire-notice-images';
async function user(role) {
  const credentials = {
    email: `notice-image-${randomUUID()}@example.test`,
    password: randomBytes(24).toString('base64url'),
  };
  const created = await admin.auth.admin.createUser({
    ...credentials,
    email_confirm: true,
  });
  assert.ifError(created.error);
  users.push(created.data.user.id);
  assert.ifError(
    (
      await admin
        .from('profiles')
        .insert({
          id: created.data.user.id,
          role,
          name: 'Temporary image verification',
        })
    ).error,
  );
  const client = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth },
  );
  assert.ifError((await client.auth.signInWithPassword(credentials)).error);
  return client;
}
try {
  owner = await user('consultant_lead');
  const other = await user('consultant_lead');
  const id = randomUUID(),
    noticeId = randomUUID(),
    imageId = randomUUID();
  document = {
    questionnaireId: id,
    title: '사진 테스트',
    sections: [],
    notices: [
      {
        id: noticeId,
        position: 'start',
        title: '안내',
        body: '',
        buttonLabel: '',
      },
    ],
  };
  let saved = await owner.rpc('save_questionnaire_draft', {
    p_document: document,
    p_expected_revision: 0,
    p_save_id: randomUUID(),
  });
  assert.ifError(saved.error);
  revision = saved.data.revision;
  const path = `${id}/${noticeId}/${imageId}.webp`;
  paths.push(path);
  const bytes = await sharp({
    create: { width: 32, height: 24, channels: 3, background: '#aabbcc' },
  })
    .webp()
    .toBuffer();
  assert.ok(
    (
      await other.storage
        .from(bucket)
        .upload(path, bytes, { contentType: 'image/webp' })
    ).error,
    'Other author upload denied',
  );
  assert.ifError(
    (
      await owner.storage
        .from(bucket)
        .upload(path, bytes, { contentType: 'image/webp' })
    ).error,
  );
  assert.ok(
    (
      await owner.storage
        .from(bucket)
        .upload(path, bytes, { contentType: 'image/webp', upsert: true })
    ).error,
    'Existing image overwrite denied',
  );
  assert.ok(
    (await other.storage.from(bucket).download(path)).error,
    'Private draft image read denied',
  );
  const download = await owner.storage.from(bucket).download(path);
  assert.ifError(download.error);
  assert.equal(download.data.size, bytes.length);
  document.notices[0].images = [{ id: imageId, name: 'sample.webp' }];
  saved = await owner.rpc('save_questionnaire_draft', {
    p_document: document,
    p_expected_revision: revision,
    p_save_id: randomUUID(),
  });
  assert.ifError(saved.error);
  revision = saved.data.revision;
  const missing = structuredClone(document);
  missing.notices[0].images[0].id = randomUUID();
  assert.equal(
    (
      await owner.rpc('save_questionnaire_draft', {
        p_document: missing,
        p_expected_revision: revision,
        p_save_id: randomUUID(),
      })
    ).status,
    400,
  );
  const read = await owner.rpc('read_questionnaire_draft', {
    p_questionnaire_id: id,
  });
  assert.ifError(read.error);
  assert.deepEqual(read.data.notices[0].images, document.notices[0].images);
  // No delete policy: removal must not damage a saved document.
  await owner.storage.from(bucket).remove([path]);
  assert.ifError((await owner.storage.from(bucket).download(path)).error);
  console.log(
    'Local Storage HTTP: private upload/read, other-author denial, immutable objects, saved metadata, missing-file rejection passed.',
  );
} finally {
  if (paths.length)
    assert.ifError((await admin.storage.from(bucket).remove(paths)).error);
  if (owner && document && revision)
    assert.ifError(
      (
        await owner.rpc('delete_questionnaire', {
          p_questionnaire_id: document.questionnaireId,
          p_expected_revision: revision,
        })
      ).error,
    );
  for (const id of users)
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
}
