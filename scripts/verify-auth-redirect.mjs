import assert from 'node:assert/strict';
import test from 'node:test';

import { safeReturnPath, withReturnPath } from '../lib/auth-redirect.ts';

test('preserves a nested destination and its query through login and callback', () => {
  const path =
    '/dashboard?view=questions&questionnaireId=123&search=%ED%95%9C%EA%B8%80';
  const login = new URL(
    withReturnPath('/auth/login', path),
    'https://app.test',
  );
  const callback = new URL(
    withReturnPath('/auth/callback', login.searchParams.get('next')),
    'https://app.test',
  );
  assert.equal(safeReturnPath(callback.searchParams.get('next')), path);
});

test('rejects external, malformed and authentication loop destinations', () => {
  for (const path of [
    undefined,
    ['/'],
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/\tevil.test',
    '/auth/login',
    '/x/../auth/login',
    '/%61uth/callback',
    '/onboarding?next=/onboarding',
    '/%zz',
  ]) {
    assert.equal(safeReturnPath(path), '/dashboard', String(path));
  }
});

test('preserves destination through onboarding and a failed OAuth retry', () => {
  const path = '/consulting/material-box/result?item=123';
  for (const page of ['/onboarding', '/auth/login']) {
    const url = new URL(withReturnPath(page, path), 'https://app.test');
    url.searchParams.set('error', 'oauth');
    assert.equal(safeReturnPath(url.searchParams.get('next')), path);
  }
});
