import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

import { assessSupport } from '../features/mentor-round/server/comment-support.mjs';
import {
  availableComponents,
  confidenceFor,
  validateAdvice,
  validateBallot,
} from '../features/mentor-round/server/persona-ballot.mjs';
import manifest from '../features/mentor-round/server/persona-sources.json' with { type: 'json' };
import { matchPassages } from '../features/mentor-round/server/source-evidence.mjs';
import { vote } from '../features/mentor-round/server/vote.mjs';
import {
  composePersona,
  personas,
} from '../features/mentor-round/shared/personas.mjs';

const persona = personas[0];
const component = persona.components[0];
const passages = [
  {
    id: component.sourceRefs[0],
    summary: component.statement,
    quote: '테스트 원문',
    question: '테스트 질문',
  },
];
const options = ['혼자 학습', '강의 활용', '질문하기'];
const valid = () => ({
  choice: '1',
  reason: '어려운 개념을 강의로 보완해 보세요.',
  context: '개념 이해 방법을 고르는 상황입니다.',
  applied: [
    {
      componentId: component.id,
      evidence: '혼자 해결하기 어려운 개념을 강의로 보완합니다.',
      sourceRefs: component.sourceRefs,
    },
  ],
  alternatives: [
    { choice: '0', tradeoff: '기본 개념을 이해하면 혼자 학습할 수 있습니다.' },
    { choice: '2', tradeoff: '질문할 사람이 있으면 도움을 받을 수 있습니다.' },
  ],
  caveats: ['현재 이해 수준은 확인이 필요합니다.'],
});
const request = (overrides = {}) =>
  new Request('https://mea.test/api/mentor-round/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      panel: 'mea28-v1',
      mentor: 0,
      q: '어려운 개념을 어떻게 공부할까요?',
      opts: options,
      ...overrides,
    }),
  });
const response = (payload) =>
  Response.json({
    output: [
      { content: [{ type: 'output_text', text: JSON.stringify(payload) }] },
    ],
  });

test('all 28 personas retain same-mentor sources, exact summaries, stable unique components and no private lookup IDs', () => {
  assert.equal(personas.length, 28);
  const ids = [];
  personas.forEach((p, i) =>
    p.components.forEach((c, j) => {
      assert.equal(c.statement, manifest[i].sources[j].summary);
      assert.deepEqual(c.sourceRefs, [
        'evidence-' + manifest[i].sources[j].digest,
      ]);
      assert.equal(c.provenance.personaId, p.id);
      assert.equal(c.applicability.status, 'not-collected');
      ids.push(c.id);
    }),
  );
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(JSON.stringify(personas).includes(manifest[0].owner), false);
  assert.equal(
    JSON.stringify(personas).includes(manifest[0].sources[0].session),
    false,
  );
});
test('digest mismatch is excluded and surviving source IDs never shift', () => {
  const original = manifest[0].sources.map((s) => s.digest);
  try {
    manifest[0].sources[1].digest = createHash('sha256')
      .update('valid quote')
      .digest('hex');
    const result = matchPassages(0, (_, i) =>
      i === 1 ? 'valid quote' : 'wrong quote',
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'evidence-' + manifest[0].sources[1].digest);
  } finally {
    manifest[0].sources.forEach((s, i) => (s.digest = original[i]));
  }
});
test('only fully verified components are available', () => {
  assert.deepEqual(availableComponents(persona, passages), [component]);
  assert.deepEqual(availableComponents(persona, []), []);
});
test('valid ballot links only selected components and sources', () => {
  const applied = validateBallot(valid(), options, [component]);
  assert.equal(applied[0].id, component.id);
  assert.equal(applied[0].label, component.label);
});
for (const value of ['', '01', '1.5', '-1', '3', 1, null])
  test(`reject noncanonical choice ${JSON.stringify(value)}`, () => {
    const b = valid();
    b.choice = value;
    assert.throws(() => validateBallot(b, options, [component]));
  });
for (const mutation of [
  (b) => (b.applied[0].componentId = personas[1].components[0].id),
  (b) => (b.applied[0].sourceRefs = ['foreign-source']),
  (b) =>
    (b.applied[0].sourceRefs = [
      ...component.sourceRefs,
      ...component.sourceRefs,
    ]),
  (b) => b.applied.push(b.applied[0]),
  (b) => (b.alternatives[0].choice = '1'),
  (b) => (b.alternatives[0].choice = '4'),
  (b) => b.alternatives.pop(),
  (b) => (b.caveats = [null]),
])
  test('reject malformed/cross-persona relationships', () => {
    const b = valid();
    mutation(b);
    assert.throws(() => validateBallot(b, options, [component]));
  });
test('no relevant strategy remains empty, never forces a tag', () => {
  const b = valid();
  b.applied = [];
  assert.deepEqual(validateBallot(b, options, []), []);
});
test('confidence distinguishes unavailable evidence, partial coverage, unsupported advice, and assessor failure', () => {
  assert.equal(confidenceFor(persona, [], [], null).label, '원문 확인 불가');
  const c = confidenceFor(persona, passages, [], null);
  assert.equal(c.status, 'unavailable');
  assert.deepEqual(c.sourceCoverage, { verified: 1, total: 3 });
  assert.match(
    confidenceFor(persona, passages, [], { level: '하' }).label,
    /하/,
  );
  assert.match(
    confidenceFor(persona, passages, [], { level: '중' }).label,
    /중/,
  );
});
test('synthetic draft retains immutable lineage and requires review', () => {
  const selections = [component, personas[1].components[0]].map((c) => ({
    ...c.provenance,
  }));
  const draft = composePersona('synthetic-test', selections);
  assert.equal(draft.reviewStatus, 'needs-review');
  assert.deepEqual(
    draft.components.map((c) => c.provenance),
    selections,
  );
  draft.components[0].label = 'changed';
  assert.notEqual(component.label, 'changed');
  assert.throws(() =>
    composePersona('synthetic-test', [selections[0], selections[0]]),
  );
  assert.throws(() =>
    composePersona('synthetic-test', [{ ...selections[0], version: '999' }]),
  );
  assert.throws(() => composePersona('real-mentor', selections));
});
test('mock vote stores exact persona version, rationale, tags and sources', async () => {
  let sent;
  const result = await vote(
    request(),
    { OPENAI_API_KEY: 'offline-test-only' },
    {
      readEvidence: async () => passages,
      assessSupport: async () => ({ level: '중', sources: passages }),
      fetch: async (_, init) => {
        sent = JSON.parse(init.body);
        return response(valid());
      },
    },
  );
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body.persona, persona);
  assert.equal(body.reason, valid().reason);
  assert.equal(body.explanation.version, '3');
  assert.equal(body.explanation.criteria[0].componentId, component.id);
  assert.deepEqual(body.sources, passages);
  assert.equal(JSON.parse(sent.input).persona.components.length, 1);
  assert.equal(JSON.parse(sent.input).sources[0].quote, '테스트 원문');
  assert.equal(JSON.stringify(sent).includes(manifest[0].owner), false);
});
test('mock vote handles missing source DB without fabricating citations', async () => {
  const b = valid();
  b.applied = [];
  const result = await vote(
    request(),
    { OPENAI_API_KEY: 'offline-test-only' },
    {
      readEvidence: async () => {
        throw Error('offline');
      },
      assessSupport: async () => null,
      fetch: async () => response(b),
    },
  );
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.deepEqual(body.applied, []);
  assert.deepEqual(body.sources, []);
  assert.equal(body.confidence.sourceCoverage.verified, 0);
});
test('mock vote rejects fabricated component refs and old panel', async () => {
  const b = valid();
  b.applied[0].sourceRefs = ['fabricated'];
  const deps = {
    readEvidence: async () => passages,
    assessSupport: async () => null,
    fetch: async () => response(b),
  };
  assert.equal((await vote(request(), {}, deps)).status, 502);
  assert.equal((await vote(request({ panel: 'old' }), {}, deps)).status, 409);
});
test('support assessment sees original quote; malformed refs and upstream failure fail closed', async () => {
  const before = globalThis.fetch;
  try {
    globalThis.fetch = async (_, init) => {
      const data = JSON.parse(JSON.parse(init.body).input);
      assert.equal(data.notes[0].quote, '테스트 원문');
      return response({ band: 'partial', refs: ['0'] });
    };
    assert.equal(
      (await assessSupport({}, 0, 'q', 'a', 'comment', passages)).level,
      '중',
    );
    globalThis.fetch = async () => response({ band: 'direct', refs: ['01'] });
    assert.equal(
      await assessSupport({}, 0, 'q', 'a', 'comment', passages),
      null,
    );
    globalThis.fetch = async () => {
      throw Error('timeout');
    };
    assert.equal(
      await assessSupport({}, 0, 'q', 'a', 'comment', passages),
      null,
    );
  } finally {
    globalThis.fetch = before;
  }
});
test('historical and versioned snapshots restore unchanged; interrupted votes become retryable', async () => {
  const path = new URL(
    '../app/(private)/dashboard/_views/mentor-round/lib/rounds.ts',
    import.meta.url,
  );
  const source = (await readFile(path, 'utf8')).replaceAll(
    "'@/features/",
    "'" + new URL('../features/', import.meta.url).href,
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const { restoreRounds } = await import(
    'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
  );
  const snapshot = structuredClone(persona);
  snapshot.version = 'historical-version';
  const rounds = [
    {
      id: 'saved',
      q: '질문',
      opts: options,
      panel: 'mea28-v1',
      ballots: [
        { state: 'done', choice: 0, reason: '이전 답변' },
        { state: 'done', choice: 1, reason: '새 답변', persona: snapshot },
        { state: 'loading' },
      ],
    },
  ];
  const before = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => JSON.stringify(rounds) };
    const restored = restoreRounds('test');
    assert.deepEqual(restored[0].ballots[0], rounds[0].ballots[0]);
    assert.equal(restored[0].ballots[0].explanation, undefined);
    assert.deepEqual(restored[0].ballots[1].persona, snapshot);
    assert.equal(restored[0].ballots[2].state, 'failed');
  } finally {
    globalThis.localStorage = before;
  }
});

test('abstention requires comparison of every option', () => {
  const ballot = valid();
  ballot.choice = '-1';
  ballot.applied = [];
  assert.throws(() => validateBallot(ballot, options, [component]));
  ballot.alternatives.push({
    choice: '1',
    tradeoff: '공식 자료 확인이 필요합니다.',
  });
  assert.deepEqual(validateBallot(ballot, options, [component]), []);
});

test('v3 returns the advice but does not copy unrelated generated fields or invent a confidence grade', async () => {
  const b = valid();
  const fake = 'FABRICATED_EXPERIENCE';
  b.context = fake;
  b.applied[0].evidence = fake;
  b.alternatives.forEach((a) => {
    a.tradeoff = fake;
  });
  b.caveats = [fake];
  let assessments = 0;
  const result = await vote(
    request(),
    {},
    {
      readEvidence: async () => passages,
      assessSupport: async () => {
        assessments++;
        return { level: '상', sources: passages };
      },
      fetch: async () => response(b),
    },
  );
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(body).includes(fake), false);
  assert.equal(body.support, null);
  assert.equal(assessments, 0);
  assert.equal(body.explanation.version, '3');
  assert.equal(body.reason, valid().reason);
  assert.equal(body.explanation.conclusion, valid().reason);
  assert.equal(body.applied[0].evidence, component.statement);
  assert.deepEqual(body.sources, passages);
});

test('advice voice rejects explicit impersonation and production boilerplate, but permits discussing AI as a study topic', () => {
  for (const reason of [
    '저는 이 방법으로 성적을 올렸어요.',
    '제가 재수할 때도 강의를 들었어요.',
    'AI가 이 선택을 제안했어요.',
    '현재 적합성은 미검증입니다.',
  ])
    assert.throws(() => validateAdvice(reason));
  const advice = 'AI가 찾은 자료는 실제로 존재하는지 먼저 확인해 보세요.';
  assert.equal(validateAdvice(advice), advice);
});

test('invalid advice voice never replaces a source-linked comment with invented testimony', async () => {
  const b = valid();
  b.reason = '저는 이 방법으로 합격했어요.';
  const result = await vote(
    request(),
    {},
    {
      readEvidence: async () => passages,
      fetch: async () => response(b),
    },
  );
  assert.equal(result.status, 502);
});
