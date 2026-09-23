import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeClause,
  questionConnections,
  questionGraphLayout,
  rowLimitLabel,
} from '../app/(private)/dashboard/_views/questions/lib/question-list.ts';

const question = (id, sources = [], extra = {}) => ({
  id,
  title: id,
  prompt: id,
  fields: [],
  row_mode: 'single',
  max_rows: 1,
  source_block_id: null,
  after_block_id: null,
  condition: sources.length
    ? {
        mode: 'all',
        clauses: sources.map((blockId) => ({ blockId, op: 'answered' })),
      }
    : null,
  ...extra,
});

test('chain, branches and merges point forward and nodes never overlap', () => {
  const questions = [
    question('d', ['b', 'c']),
    question('c', ['a']),
    question('a'),
    question('b', ['a']),
    question('isolated'),
  ];
  const graph = questionGraphLayout(
    questions,
    questions.map((q) => q.id),
  );
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 4);
  for (const edge of graph.edges) {
    const source = graph.nodes.find((n) => n.question.id === edge.source);
    const target = graph.nodes.find((n) => n.question.id === edge.target);
    assert.ok(source.x + source.width < target.x);
  }
  for (const a of graph.nodes)
    for (const b of graph.nodes) {
      if (a === b) continue;
      assert.ok(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
      );
    }
});

test('filtered graph includes all ancestors but not unrelated questions', () => {
  const questions = [
    question('a'),
    question('b', ['a']),
    question('c', ['b']),
    question('unrelated'),
  ];
  assert.deepEqual(
    questionGraphLayout(questions, ['c']).nodes.map((n) => n.question.id),
    ['a', 'b', 'c'],
  );
  assert.equal(questionGraphLayout(questions, []).nodes.length, 0);
});

test('choice labels use stored option text and reference is separate from OR conditions', () => {
  const source = question('a', [], {
    fields: [
      {
        id: 'f',
        label: '전형',
        kind: 'multiple',
        options: [{ id: 'choice', label: '수시' }],
      },
    ],
  });
  const clause = {
    blockId: 'a',
    fieldId: 'f',
    op: 'includes',
    value: 'choice',
  };
  const target = question('b', [], {
    source_block_id: 'a',
    condition: {
      mode: 'any',
      clauses: [clause, { blockId: 'a', op: 'answered' }],
    },
  });
  const questions = [source, target];
  assert.deepEqual(describeClause(clause, questions), {
    fieldLabel: '전형',
    particle: '에서',
    valueLabel: '수시',
    suffix: '항목을 선택했을 때',
  });
  const edges = questionConnections(questions);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].labels.length, 2);
  assert.deepEqual(edges[0].notes, ['응답 항목 참조']);
});

test('many incoming edges reserve separate vertical label lanes', () => {
  const sources = Array.from({ length: 10 }, (_, i) => question(`q${i}`));
  const target = question(
    'target',
    sources.map((q) => q.id),
  );
  const node = questionGraphLayout([...sources, target], ['target']).nodes.find(
    (n) => n.question.id === 'target',
  );
  assert.ok(node.height > 52 + 9 * 52);
});

test('missing and cyclic legacy links do not crash or hang layout', () => {
  const questions = [
    question('a', ['b']),
    question('b', ['a']),
    question('c', ['missing']),
  ];
  const graph = questionGraphLayout(questions, ['a', 'b', 'c']);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  assert.ok(Number.isFinite(graph.width) && Number.isFinite(graph.height));
  assert.equal(
    describeClause(
      { blockId: 'missing', fieldId: 'missing', op: 'answered' },
      questions,
    ).fieldLabel,
    '찾을 수 없는 열',
  );
});

test('row limit labels distinguish single, repeatable and reference', () => {
  assert.equal(rowLimitLabel(question('a')), '행 최대 1개');
  assert.equal(
    rowLimitLabel(question('a', [], { row_mode: 'repeatable', max_rows: 20 })),
    '행 최대 20개',
  );
  assert.equal(
    rowLimitLabel(question('a', [], { row_mode: 'reference' })),
    '앞선 응답 수만큼 반복',
  );
});
