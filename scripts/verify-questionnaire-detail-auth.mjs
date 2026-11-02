import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const path = '/api/questionnaires/50edce56-cfb4-49fd-a57e-40db4b84c271';

function load(file, imports) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  vm.runInNewContext(outputText, {
    exports,
    process: { env: {} },
    require: (key) => {
      assert.ok(key in imports, key);
      return imports[key];
    },
  });
  return exports;
}

test('only detail GET adds a proxy auth exception', async () => {
  let checks = 0;
  const { updateSession } = load('lib/supabase/proxy.ts', {
    'next/server': { NextResponse },
    '@supabase/ssr': {
      createServerClient: () => ({ auth: { getUser: () => ++checks } }),
    },
  });
  for (const [method, url, expected] of [
    ['GET', path, 0],
    ['GET', path + '/?view=preview', 0],
    ['PUT', path, 1],
    ['DELETE', path, 1],
    ['HEAD', path, 1],
    ['GET', '/api/questionnaires', 1],
    ['GET', '/api/questionnaires/new', 1],
    ['GET', path + '/answers', 1],
    ['GET', '/api/questionnaires/invalid', 1],
    ['GET', path + '/published-responses', 0],
  ]) {
    checks = 0;
    await updateSession(
      new NextRequest('https://example.test' + url, { method }),
    );
    assert.equal(checks, expected, method + ' ' + url);
  }
});

test('route client writes refreshed cookies with options and reads them on the next request', async () => {
  // Simulate the SDK requesting a refresh, using Next's cookie serialization.
  const { createClient } = load('lib/supabase/server.ts', {
    '@supabase/ssr': {
      createServerClient: (_url, _key, { cookies }) => cookies,
    },
  });
  const response = NextResponse.next();
  const cookies = createClient(response.cookies);
  cookies.setAll([
    {
      name: 'session',
      value: 'renewed',
      options: { httpOnly: true, path: '/' },
    },
  ]);
  const header = response.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Path=\//);
  const next = new NextRequest('https://example.test' + path, {
    headers: { cookie: header.split(';')[0] },
  });
  assert.equal(createClient(next.cookies).getAll()[0].value, 'renewed');
});
