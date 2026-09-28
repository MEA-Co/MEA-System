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
  viewRole = role,
  count = 0,
  rpcError = null,
} = {}) {
  const calls = [];
  const z = require('zod').z;
  const usageExports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        'app/(private)/dashboard/_views/questions/lib/question-usage.ts',
        'utf8',
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports: usageExports },
  );
  const imports = {
    zod: { z },
    '@/app/(private)/dashboard/_views/questions/lib/question-usage':
      usageExports,
    'next/headers': { cookies: async () => ({}) },
    '@/app/(private)/dashboard/_views/questions/lib/question-blocks': {
      questionBlockSchema: z.any(),
    },
    '@/lib/admin': { getViewRole: async () => viewRole },
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
              pageSize: 10,
            },
            error: rpcError,
          };
        },
        from: (table) => {
          calls.push({ table });
          const builder = {
            select: (columns) => {
              calls.push({ columns });
              return builder;
            },
            is: () => builder,
            maybeSingle: () => builder,
            eq: (column, value) => {
              calls.push({ filter: column, value });
              return builder;
            },
            ilike: (column, value) => {
              calls.push({ search: column, value });
              return builder;
            },
            in: (column, value) => {
              calls.push({ in: column, value });
              return builder;
            },
            then: (resolve) =>
              resolve({ data: batches.shift() ?? [], count, error: null }),
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
    get: (query = '', path = []) =>
      exports.GET(new Request(`https://example.test/api/questions${query}`), {
        params: Promise.resolve({ path }),
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
  assert.equal(result.pageSize, 10);
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

test('relationship mode excludes explanations and storage metadata', async () => {
  const client = setup();
  assert.equal((await client.get('?mode=relationships')).status, 200);
  const columns = client.calls.find((call) => call.columns).columns;
  assert.ok(columns.includes('fields'));
  assert.ok(columns.includes('condition'));
  assert.ok(!columns.includes('*'));
  assert.ok(!columns.includes('details'));
  assert.ok(!columns.includes('save_id'));
});

test('admin lead preview filters before pagination and returns the display role', async () => {
  const client = setup({
    role: 'admin',
    viewRole: 'consultant_lead',
    count: 11,
    batches: [[], [{ id: 'mine', condition: null }]],
  });
  const result = await (await client.get('?page=99&search=%25_')).json();
  assert.equal(result.total, 11);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.role, 'consultant_lead');
  assert.equal(
    client.calls.some((c) => c.name === 'list_questions_page'),
    false,
  );
  assert.equal(
    client.calls.filter((c) => c.filter === 'created_by' && c.value === 'actor')
      .length,
    2,
  );
  assert.deepEqual(
    client.calls.filter((c) => 'start' in c),
    [
      { start: 980, end: 989 },
      { start: 10, end: 19 },
      { start: 0, end: 499 },
      { start: 0, end: 499 },
    ],
  );
});
test('admin lead preview full and relationship lists use the same owner filter', async () => {
  for (const query of ['', '?mode=relationships']) {
    const client = setup({ role: 'admin', viewRole: 'consultant_lead' });
    await client.get(query);
    assert.ok(
      client.calls.some(
        (c) => c.filter === 'created_by' && c.value === 'actor',
      ),
    );
  }
});
test('admin normal view retains the full paginated RPC', async () => {
  const client = setup({ role: 'admin' });
  const result = await (await client.get('?page=1')).json();
  assert.equal(result.role, 'admin');
  assert.ok(client.calls.some((c) => c.name === 'list_questions_page'));
});

test('admin lead preview detail query includes author constraint', async () => {
  const client = setup({ role: 'admin', viewRole: 'consultant_lead' });
  await client.get('', [randomUUID()]);
  assert.ok(
    client.calls.some((c) => c.filter === 'created_by' && c.value === 'actor'),
  );
});
