import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const memberId = '11111111-1111-4111-8111-111111111111';
const source = ts.transpileModule(
  readFileSync(
    'app/(private)/dashboard/_views/consultants/actions/update-consultant-role.ts',
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

function fixture({
  role = 'admin',
  loggedIn = true,
  isOnboarded = true,
  error = null,
} = {}) {
  const calls = [];
  const refreshes = [];
  const imports = {
    'server-only': {},
    'next/cache': { revalidatePath: (path) => refreshes.push(path) },
    'next/headers': { cookies: async () => ({}) },
    '@/lib/auth': {
      getUserAccess: async () => ({
        user: loggedIn ? { id: memberId } : null,
        role,
        isOnboarded,
      }),
    },
    '@/lib/profile': {
      MEMBER_ROLE_LABELS: {
        consultant: '컨설턴트',
        consultant_lead: '컨설턴트 리드',
      },
    },
    '@/lib/supabase/server': {
      createClient: () => ({
        rpc: async (name, input) => {
          calls.push({ name, ...input });
          return { error };
        },
      }),
    },
  };
  const adminExports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync('lib/admin.ts', 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: adminExports,
      require: (name) => imports[name] ?? require(name),
    },
  );
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      name === '@/lib/admin' ? adminExports : (imports[name] ?? require(name)),
  });
  return {
    calls,
    refreshes,
    save: (role = 'consultant_lead', id = memberId) => {
      const form = new FormData();
      form.set('role', role);
      form.set('targetId', id);
      return exports.updateConsultantRole({}, form);
    },
  };
}

test('both supported role changes use the authenticated RPC and refresh the list', async () => {
  const f = fixture();
  for (const role of ['consultant', 'consultant_lead']) {
    const result = await f.save(role);
    assert.ok(result.success);
    assert.equal(result.savedRole, role);
    assert.equal(result.error, undefined);
    assert.equal(f.calls.at(-1).next_role, role);
    assert.equal(f.calls.at(-1).target_id, memberId);
    assert.equal(f.calls.at(-1).name, 'update_consultant_role');
  }
  assert.deepEqual(f.refreshes, ['/dashboard', '/dashboard']);
});

test('students, consultants, leads, expired sessions and incomplete profiles never write', async () => {
  for (const options of [
    { role: 'student' },
    { role: 'consultant' },
    { role: 'consultant_lead' },
    { loggedIn: false },
    { isOnboarded: false },
  ]) {
    const f = fixture(options);
    assert.ok((await f.save()).error);
    assert.equal(f.calls.length, 0);
    assert.equal(f.refreshes.length, 0);
  }
});

test('invalid IDs and forged admin or student roles are rejected before writing', async () => {
  const f = fixture();
  for (const role of ['admin', 'student', '', 'unknown'])
    assert.ok((await f.save(role)).error);
  assert.ok((await f.save('consultant', 'invalid-id')).error);
  assert.equal(f.calls.length, 0);
});

test('revoked permissions, missing targets and other failures have useful errors without success', async () => {
  for (const [code, message] of [
    ['42501', '변경 권한'],
    ['P0002', '찾지 못했어요'],
    ['XX000', '잠시 후'],
  ]) {
    const f = fixture({ error: { code, message: 'private database detail' } });
    const result = await f.save();
    assert.ok(result.error.includes(message));
    assert.equal(result.success, undefined);
    assert.equal(result.error.includes('private database detail'), false);
    assert.equal(f.refreshes.length, 0);
  }
});
