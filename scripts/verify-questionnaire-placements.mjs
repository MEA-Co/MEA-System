import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve('app/(private)/dashboard/_views');
const modules = new Map();
function load(filename) {
  const full = path.resolve(filename);
  if (modules.has(full)) return modules.get(full);
  const exports = {};
  modules.set(full, exports);
  vm.runInNewContext(
    ts.transpileModule(readFileSync(full, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      TextEncoder,
      structuredClone,
      crypto: { randomUUID },
      require: (name) =>
        name.startsWith('.')
          ? load(path.resolve(path.dirname(full), `${name}.ts`))
          : require(name),
    },
  );
  return exports;
}
const { createPlacement, questionsToPlace, placementError } = load(
  `${root}/questions/lib/questionnaire/question-placement.ts`,
);
const { placementPreviewState } = load(
  `${root}/questions/lib/questionnaire/placement-preview.ts`,
);
const { questionnaireDocumentSchema } = load(
  `${root}/questions/lib/questionnaire/schema.ts`,
);
const plain = (value) => JSON.parse(JSON.stringify(value));
const field = (kind = 'text') => ({ id: randomUUID(), label: '답변', kind });
function block(deps = [], overrides = {}) {
  return {
    id: randomUUID(),
    title: '질문',
    prompt: '질문 내용',
    fields: [field()],
    row_mode: 'single',
    max_rows: null,
    source_block_id: null,
    source_field_id: null,
    after_block_id: null,
    condition: deps.length
      ? {
          mode: 'all',
          clauses: deps.map((id) => ({ blockId: id, op: 'answered' })),
        }
      : null,
    revision: 1,
    created_by: randomUUID(),
    created_at: '',
    updated_at: '',
    archived_at: null,
    ...overrides,
  };
}
const section = (...blocks) => ({
  id: randomUUID(),
  title: '섹션',
  questions: blocks.map(createPlacement),
});

test('adds transitive prerequisites exactly once in source order without modifying originals', () => {
  const a = block();
  const b = block([a.id]);
  const c = block([a.id, b.id]);
  const library = [c, b, a];
  const before = JSON.stringify(library);
  assert.deepEqual(
    plain(questionsToPlace(c.id, [], library).map((q) => q.id)),
    [a.id, b.id, c.id],
  );
  assert.deepEqual(
    plain(questionsToPlace(c.id, [section(a)], library).map((q) => q.id)),
    [b.id, c.id],
  );
  assert.equal(JSON.stringify(library), before);
  const placement = createPlacement(a);
  assert.equal(placement.sourceQuestionId, a.id);
  assert.notEqual(placement.id, a.id);
  assert.notEqual(createPlacement(a).id, placement.id);
});

test('validates prerequisites across sections, reversed moves, duplicates and source removal', () => {
  const a = block();
  const b = block([a.id]);
  const library = [a, b];
  assert.equal(placementError([section(a), section(b)], library), null);
  assert.ok(placementError([section(b), section(a)], library));
  assert.ok(placementError([section(b)], library));
  assert.ok(placementError([section(a), section(a)], library));
  assert.ok(placementError([section(a)], [{ ...a, archived_at: 'archived' }]));
  assert.ok(placementError([section(a)], []));
  assert.throws(() => questionsToPlace(b.id, [], [b]), /참조하는 질문/);
  const cycleA = { ...a, after_block_id: b.id };
  assert.throws(() => questionsToPlace(b.id, [], [cycleA, b]), /순환/);
});

test('schema keeps placement source identity and reads legacy nullable source metadata', () => {
  const a = block();
  const s = section(a);
  const doc = {
    questionnaireId: randomUUID(),
    versionId: randomUUID(),
    title: '질문지',
    sections: [s],
  };
  const parsed = questionnaireDocumentSchema.parse(doc);
  assert.equal(parsed.sections[0].questions[0].sourceQuestionId, a.id);
  s.questions[0].sourceQuestionId = null;
  assert.equal(
    questionnaireDocumentSchema.parse(doc).sections[0].questions[0]
      .sourceQuestionId,
    undefined,
  );
  s.questions[0].sourceQuestionId = 'invalid';
  assert.equal(questionnaireDocumentSchema.safeParse(doc).success, false);
});

test('all-column prerequisites need complete answers in the same row and preserve matching row identity', () => {
  const a = block([], { fields: [field(), field()] });
  const b = block([a.id], { row_mode: 'reference', source_block_id: a.id });
  const [x, y] = a.fields.map((f) => f.id);
  const answers = {
    [a.id]: [
      { id: 2, answers: { [x]: '하나' } },
      { id: 4, answers: { [y]: '둘' } },
      { id: 7, answers: { [x]: '하나', [y]: '둘' } },
    ],
  };
  assert.deepEqual(plain(placementPreviewState(b, [a, b], answers)), {
    waiting: false,
    matchedRows: [answers[a.id][2]],
  });
  assert.equal(
    placementPreviewState(b, [a, b], { [a.id]: answers[a.id].slice(0, 2) })
      .waiting,
    true,
  );
  assert.equal(placementPreviewState(b, [a, b], {}).waiting, true);
});

test('multiple conditions honor all/any and compare text, choice and scale values', () => {
  const choice = {
    ...field('multiple'),
    options: [
      { id: randomUUID(), label: '가' },
      { id: randomUUID(), label: '나' },
    ],
  };
  const scale = { ...field('scale'), scaleMax: 5 };
  const text = field();
  const a = block([], { fields: [choice, scale, text] });
  const b = block([], {
    condition: {
      mode: 'all',
      clauses: [
        {
          blockId: a.id,
          fieldId: choice.id,
          op: 'includes',
          value: choice.options[0].id,
        },
        { blockId: a.id, fieldId: scale.id, op: 'gte', value: 4 },
        { blockId: a.id, fieldId: text.id, op: 'equals', value: '내용' },
      ],
    },
  });
  const row = {
    id: 5,
    answers: {
      [choice.id]: JSON.stringify([choice.options[0].id]),
      [scale.id]: '4',
      [text.id]: '내용',
    },
  };
  assert.equal(
    placementPreviewState(b, [a, b], { [a.id]: [row] }).waiting,
    false,
  );
  const partial = { ...row, answers: { ...row.answers, [scale.id]: '2' } };
  assert.equal(
    placementPreviewState(b, [a, b], { [a.id]: [partial] }).waiting,
    true,
  );
  assert.equal(
    placementPreviewState(
      { ...b, condition: { ...b.condition, mode: 'any' } },
      [a, b],
      { [a.id]: [partial] },
    ).waiting,
    false,
  );
});

test('references and sequencing wait for actual preceding answers, including an explicit source column', () => {
  const a = block([], { fields: [field(), field()] });
  const b = block([], {
    row_mode: 'reference',
    source_block_id: a.id,
    source_field_id: a.fields[1].id,
    after_block_id: a.id,
  });
  assert.equal(placementPreviewState(b, [a, b], {}).waiting, true);
  assert.equal(
    placementPreviewState(b, [a, b], {
      [a.id]: [{ id: 1, answers: { [a.fields[0].id]: '앞 열만' } }],
    }).waiting,
    true,
  );
  const row = { id: 3, answers: { [a.fields[1].id]: '참조할 답변' } };
  assert.deepEqual(plain(placementPreviewState(b, [a, b], { [a.id]: [row] })), {
    waiting: false,
    matchedRows: [row],
  });
});
