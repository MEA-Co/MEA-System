import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function setup({
  role = 'consultant_lead',
  batches = [],
  rpcError = null,
} = {}) {
  const calls = [];
  const z = require('zod').z;
  const imports = {
    zod: { z },
    'next/headers': { cookies: async () => ({}) },
    '@/app/(private)/dashboard/_views/questions/lib/question-blocks': {
      questionBlockSchema: z.any(),
    },
    '@/lib/auth': {
      getUserAccess: async () => ({
        user: { id: 'actor' },
        role,
        isOnboarded: true,
      }),
    },
    '@/lib/supabase/server': {
      createClient: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return {
            data: {
              blocks: [],
              references: [],
              total: 41,
              page: args.p_page,
              pageSize: 20,
            },
            error: rpcError,
          };
        },
        from: (table) => {
          calls.push({ table });
          const builder = {
            select: () => builder,
            is: () => builder,
            order: (column, options) => {
              calls.push({ column, options });
              return builder;
            },
            range: (start, end) => {
              calls.push({ start, end });
              return builder;
            },
            overrideTypes: async () => ({
              data: batches.shift() ?? [],
              error: null,
            }),
          };
          return builder;
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync('app/api/questions/[[...path]]/route.ts', 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Response,
      URL,
      TextEncoder,
      require: (name) => {
        assert.ok(imports[name], name);
        return imports[name];
      },
    },
  );
  return {
    calls,
    get: (query = '') =>
      exports.GET(new Request(`https://example.test/api/questions${query}`), {
        params: Promise.resolve({}),
      }),
  };
}
test('paged search uses the database RPC and returns count without fetching the full library', async () => {
  const client = setup();
  const response = await client.get('?page=2&search=%20진로%25_%20');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(client.calls)), [
    { name: 'list_questions_page', args: { p_page: 2, p_search: '진로%_' } },
  ]);
  const result = await response.json();
  assert.equal(result.total, 41);
  assert.equal(result.pageSize, 20);
  assert.equal(result.role, 'consultant_lead');
});
test('bad pages and search lengths are rejected before any database call', async () => {
  for (const query of [
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=no',
    '?page=100001',
    `?search=${'a'.repeat(201)}`,
  ]) {
    const client = setup();
    assert.equal((await client.get(query)).status, 400);
    assert.equal(client.calls.length, 0);
  }
});
test('consultants cannot call either full or paged question management API', async () => {
  const client = setup({ role: 'consultant' });
  assert.equal((await client.get('?page=1')).status, 403);
  assert.equal((await client.get()).status, 403);
  assert.equal(client.calls.length, 0);
});
test('database failure remains an error rather than an empty search result', async () => {
  assert.equal(
    (await setup({ rpcError: { code: 'PGRST202' } }).get('?page=1')).status,
    503,
  );
});
test('explicit full-library request batches past the API row limit with stable ordering', async () => {
  const rows = Array.from({ length: 1001 }, () => ({ id: randomUUID() }));
  const client = setup({
    batches: [rows.slice(0, 500), rows.slice(500, 1000), rows.slice(1000)],
  });
  const result = await (await client.get()).json();
  assert.equal(result.blocks.length, 1001);
  assert.deepEqual(
    client.calls.filter((c) => 'start' in c),
    [
      { start: 0, end: 499 },
      { start: 500, end: 999 },
      { start: 1000, end: 1499 },
    ],
  );
  assert.equal(client.calls.filter((c) => c.column === 'id').length, 3);
});
