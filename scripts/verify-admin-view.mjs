import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(path, imports) {
  imports = {
    'server-only': {},
    'next/cache': {},
    '@/lib/auth': {},
    '@/lib/profile': {},
    '@/lib/supabase/server': {},
    zod: require('zod'),
    ...imports,
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      process: { env: { NODE_ENV: 'production' } },
      require: (name) => {
        if (name === '@/lib/admin') return load('lib/admin.ts', imports);
        assert.ok(name in imports, `Unexpected import ${name}`);
        return imports[name];
      },
    },
  );
  return exports;
}

test('view role cookies only affect administrators and invalid cookies fall back', async () => {
  for (const value of [
    'student',
    'consultant',
    'consultant_lead',
    'admin',
    'invalid',
    undefined,
  ]) {
    const { getViewRole } = load('lib/admin.ts', {
      'server-only': {},
      'next/headers': { cookies: async () => ({ get: () => ({ value }) }) },
    });
    for (const role of ['student', 'consultant', 'consultant_lead']) {
      assert.equal(await getViewRole(role), role);
    }
    assert.equal(
      await getViewRole('admin'),
      ['student', 'consultant', 'consultant_lead'].includes(value)
        ? value
        : 'admin',
    );
  }
});

test('role switching only writes a presentation cookie for authenticated, onboarded admins', async () => {
  for (const role of ['student', 'consultant', 'consultant_lead', 'admin']) {
    for (const authenticated of [true, false]) {
      for (const isOnboarded of [true, false]) {
        const writes = [];
        const access = {
          role,
          user: authenticated ? { id: 'admin-user' } : null,
          isOnboarded,
        };
        const { setAdminView } = load(
          'app/(private)/dashboard/_actions/set-admin-view.ts',
          {
            'next/headers': {
              cookies: async () => ({ set: (...args) => writes.push(args) }),
            },
            '@/lib/auth': { getUserAccess: async () => access },
            '@/lib/profile': {
              MEMBER_ROLES: [
                'student',
                'consultant',
                'consultant_lead',
                'admin',
              ],
            },
          },
        );
        const result = await setAdminView('consultant_lead');
        const allowed = role === 'admin' && authenticated && isOnboarded;
        assert.equal(writes.length, allowed ? 1 : 0);
        assert.equal(Boolean(result.error), !allowed);
        assert.equal(access.role, role);
        if (allowed) {
          assert.equal(writes[0][0], 'mea-admin-view');
          assert.equal(writes[0][1], 'consultant_lead');
          assert.equal(writes[0][2].httpOnly, true);
          assert.equal(writes[0][2].secure, true);
          assert.ok((await setAdminView('invalid')).error);
          assert.equal(writes.length, 1);
        }
      }
    }
  }
});
