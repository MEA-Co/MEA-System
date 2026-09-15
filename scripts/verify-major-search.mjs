import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';
const require = createRequire(import.meta.url);
const exports = {};
const source = readFileSync(
  new URL('../features/keywords/major-search/domain.ts', import.meta.url),
  'utf8',
);
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports, require },
);
const { normalizeMajorInput, searchCatalog, parseMajorDraft } = exports;
const major = (id, name, aliases = [], rest = {}) => ({
  id,
  name,
  aliases,
  sort_order: 1,
  field_id: 'field',
  field_name: '공학계열',
  description: '설명',
  group_name: null,
  item_type: 'major',
  ...rest,
});
const catalog = [
  major('1', '컴퓨터공학', [
    { name: '컴공', alias_type: 'abbreviation' },
    { name: '전산학', alias_type: 'alternative_name' },
  ]),
  major('2', '컴퓨터과학'),
  major('3', '교과교육', [{ name: '역사교육', alias_type: 'group_member' }], {
    item_type: 'major_group',
  }),
];
test('normalizes whitespace, case and compatibility forms without altering the original input', () => {
  assert.equal(normalizeMajorInput('  컴퓨터  공학 '), '컴퓨터공학');
  assert.equal(normalizeMajorInput(' ＣＳ  Engineering '), 'csengineering');
  assert.equal(searchCatalog(catalog, '컴퓨터 공학')[0].id, '1');
});
test('exact name precedes exact alias, prefix and contains', () => {
  const ranked = [
    major('contains', '기초전산학'),
    major('prefix', '전산학응용'),
    major('alias', '컴퓨터공학', [
      { name: '전산학', alias_type: 'alternative_name' },
    ]),
    major('exact', '전산학'),
  ];
  assert.equal(
    searchCatalog(ranked, '전산학')
      .map((m) => m.id)
      .join(','),
    'exact,alias,prefix,contains',
  );
});
test('aliases collapse by major; matching metadata preserves group-member semantics', () => {
  const results = searchCatalog(
    [
      major('1', '전산학', [
        { name: '전산', alias_type: 'abbreviation' },
        { name: '전산학과', alias_type: 'alternative_name' },
      ]),
    ],
    '전산',
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].match_type, 'exact_alias');
  const group = searchCatalog(catalog, '역사교육')[0];
  assert.equal(group.item_type, 'major_group');
  assert.equal(group.matched_alias.alias_type, 'group_member');
});
test('empty and unrelated queries have no matches; results are capped and ordered', () => {
  assert.equal(searchCatalog(catalog, ' ').length, 0);
  assert.equal(searchCatalog(catalog, '점심메뉴').length, 0);
  const many = Array.from({ length: 8 }, (_, i) =>
    major(String(i), `공학${i}`, [], { sort_order: 8 - i }),
  );
  const results = searchCatalog(many, '공학');
  assert.equal(results.length, 5);
  assert.equal(results.map((m) => m.rank).join(','), '1,2,3,4,5');
  assert.equal(results[0].id, '7');
});
test('confirmed drafts require database IDs and a request ID', () => {
  assert.equal(parseMajorDraft('컴퓨터공학'), null);
  assert.equal(
    parseMajorDraft(
      JSON.stringify({
        input: '컴공',
        sessionId: 'bad',
        confirmed: { name: '컴퓨터공학' },
      }),
    ),
    null,
  );
  const draft = {
    input: '컴공',
    sessionId: '11111111-1111-4111-8111-111111111111',
    confirmed: {
      id: '22222222-2222-4222-8222-222222222222',
      name: '컴퓨터공학',
      requestId: '33333333-3333-4333-8333-333333333333',
    },
  };
  assert.equal(
    JSON.stringify(parseMajorDraft(JSON.stringify(draft))),
    JSON.stringify(draft),
  );
});
