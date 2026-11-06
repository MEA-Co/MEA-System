import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  answerParagraphs,
  choiceLabelStyle,
  choiceLetter,
  confidenceDescription,
  explanationParagraphs,
  referencedSummaries,
  strategyApplications,
  uniqueSourcePairs,
} from '../app/(private)/dashboard/_views/mentor-round/lib/presentation.ts';

test('choice letters retain the abstention label without an option index', () => {
  assert.deepEqual([-1, 0, 1, 4].map(choiceLetter), ['—', 'A', 'B', 'E']);
});

test('readable paragraphs preserve original sentences rather than generating a summary', () => {
  assert.deepEqual(
    explanationParagraphs(
      '첫 문장입니다. 두 번째입니다.\n\n다음 문단입니다.\n마지막 문장입니다.',
    ),
    ['첫 문장입니다. 두 번째입니다.', '다음 문단입니다.', '마지막 문장입니다.'],
  );
  assert.deepEqual(explanationParagraphs(), []);
  assert.deepEqual(explanationParagraphs(' \n\n '), []);
});

test('strategy applications remain generated explanation, deduplicated without modifying stored tags', () => {
  const ballot = {
    state: 'done',
    reason: '핵심 조언.',
    applied: [
      { label: '사례 비교', kind: '전략', evidence: '구체적인 적용.' },
      { label: '개념 설명', kind: '스킬', evidence: '구체적인 적용.' },
      { label: '판단 기준', kind: '전략', evidence: '핵심 조언.' },
      { label: '빈 설명', kind: '전략', evidence: ' ' },
    ],
  };
  const before = structuredClone(ballot);
  assert.deepEqual(strategyApplications(ballot), ['구체적인 적용.']);
  assert.deepEqual(ballot, before);
  assert.deepEqual(strategyApplications({ state: 'done' }), []);
});

test('source display preserves verbatim questions, answer excerpts, and distinct summaries', () => {
  const source = {
    summary: '요약',
    question: '질문 첫 줄\n둘째 줄?',
    quote: '답변 “원문”\n공백  유지',
  };
  const other = { ...source, summary: '다른 요약' };
  const sources = [source, { ...source }, other];
  assert.deepEqual(uniqueSourcePairs(sources), [source, other]);
  assert.equal(uniqueSourcePairs(sources)[0].quote, '답변 “원문”\n공백  유지');
  assert.equal(sources.length, 3);
});

test('missing confidence and incomplete confidence remain distinct', () => {
  assert.equal(
    confidenceDescription(undefined),
    '아직 원문과 비교하지 않았어요',
  );
  assert.equal(confidenceDescription(null), '원문과 비교를 마치지 못했어요');
});

test('an explanation already included in an older comment is not repeated below its tags', () => {
  assert.deepEqual(
    strategyApplications({
      state: 'done',
      reason: '결론입니다.\n조건을 비교했어요. 다른 내용입니다.',
      applied: [
        { kind: '전략', label: '비교', evidence: '조건을  비교했어요.' },
        { kind: '스킬', label: '보완', evidence: '추가로 참고할 내용입니다.' },
      ],
    }),
    ['추가로 참고할 내용입니다.'],
  );
});

test('v2 uses only saved linked summaries without rendering internal prose or creating a confidence grade', () => {
  const ballot = {
    state: 'done',
    choice: 0,
    reason: '적합성 미검증 · 자동 등급 없음',
    explanation: { version: '2' },
    support: null,
    applied: [
      {
        id: 'component',
        label: '비교',
        evidence: '적합성 미검증',
        sourceRefs: ['used'],
      },
    ],
    sources: [
      {
        id: 'used',
        summary: '배운 개념을 문제에 적용했다.',
        question: '질문?',
        quote: '원문',
      },
      {
        id: 'unused',
        summary: '관련 없는 경험',
        question: '다른 질문?',
        quote: '다른 원문',
      },
    ],
  };
  const before = structuredClone(ballot);
  assert.deepEqual(referencedSummaries(ballot), [
    '배운 개념을 문제에 적용했다.',
  ]);
  assert.deepEqual(strategyApplications(ballot), []);
  assert.deepEqual(answerParagraphs(ballot), [
    '함께 참고할 만한 멘토의 경험이에요.',
  ]);
  assert.deepEqual(ballot, before);
  assert.match(
    answerParagraphs({ ...ballot, choice: -1 })[0],
    /하나를 고르기 어려워요/,
  );
  assert.match(
    answerParagraphs({ ...ballot, sources: [] })[0],
    /경험은 찾지 못했어요/,
  );
  assert.deepEqual(
    answerParagraphs({ state: 'done', reason: '이전 의견 그대로.' }),
    ['이전 의견 그대로.'],
  );
});

test('v3 renders the saved advice paragraphs without repeating experience summaries below the tags', () => {
  const reason =
    '틀린 문제부터 다시 풀어 보세요.\n막힌 개념을 확인하고 필요한 부분만 강의로 보완하면 좋아요.';
  const ballot = {
    state: 'done',
    reason,
    explanation: { version: '3' },
    support: null,
    applied: [{ label: '개념 확인', evidence: '과거 경험 요약' }],
  };
  assert.deepEqual(answerParagraphs(ballot), reason.split('\n'));
  assert.deepEqual(strategyApplications(ballot), []);
  assert.equal(ballot.support, null);
});

test('confidence reflects source support, not probability or correctness', () => {
  assert.equal(
    confidenceDescription({ level: '상', sources: [] }),
    '원문에 직접 근거가 많아요',
  );
  assert.equal(
    confidenceDescription({ level: '중', quotes: ['이전 발췌'] }),
    '일부 조언에 원문 근거가 있어요',
  );
  assert.equal(
    confidenceDescription({ level: '하', sources: [] }),
    '직접 근거보다 추론이 많아요',
  );
});

test('small choice letters meet 4.5:1 text contrast across all options', () => {
  const luminance = (hex) => {
    const [r, g, b] = hex
      .slice(1)
      .match(/../g)
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const choice of [-1, 0, 1, 2, 3, 4]) {
    const style = choiceLabelStyle(choice);
    const values = [luminance(style.background), luminance(style.color)].sort(
      (a, b) => a - b,
    );
    assert.ok(
      (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
      `choice ${choice} contrast`,
    );
  }
});
