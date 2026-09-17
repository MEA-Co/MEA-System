import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/')
        ? new URL(specifier.slice(2), root)
        : new URL(specifier, context.parentURL);
      for (const extension of ['', '.ts', '.tsx']) {
        const url = new URL(base.href + extension);
        if (existsSync(url)) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json') && !url.includes('/node_modules/'))
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${JSON.stringify(JSON.parse(readFileSync(fileURLToPath(url), 'utf8')))};`,
      };
    if (/\.tsx?$/.test(url) && !url.includes('/node_modules/'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    return nextLoad(url, context);
  },
});
const { swapProblem, compareAdvice, universityChanges } =
  await import('../app/(private)/consulting/subject-selection/_lib/course-swap.ts');
const { buildStandardDraft } =
  await import('../app/(private)/consulting/subject-selection/_lib/course-selection-draft.ts');
const course = (id, name, domain = '사회', credit = 3) => ({
  id,
  name,
  domain,
  credit,
  description: null,
});
const a = course('a', '경제');
const comparisonInput = {
  department: '에너지공학과',
  current: '생명과학',
  completed: [
    { name: '물리학', fixed: true },
    { name: '화학', fixed: true },
    { name: '생명과학', fixed: false },
  ],
  candidates: [
    {
      id: 'society',
      name: '사회와 문화',
      reason: 'grades',
      detail: '사회 과목이 익숙하고 생명과학 성적 부담이 큽니다.',
      confident: true,
      baseline: '현재 과목 우선 추천',
      warnings: [],
    },
  ],
};

test('comparison context uses catalog content and preserves student-specific reasons', async () => {
  const { comparisonContext } =
    await import('../features/subject-selection/explain-comparison.ts');
  const context = comparisonContext(comparisonInput);
  assert.equal(context.catalog.length, 2);
  assert.ok(context.catalog.every((item) => item.description && item.coreArea));
  assert.equal(context.candidates[0].reason, 'grades');
  assert.equal(context.completed[0].fixed, true);
  assert.ok(context.internalPolicy);
  const unknown = comparisonContext({
    ...comparisonInput,
    current: '미등록과목',
  });
  assert.equal(unknown.catalog[0].description, null);
});

test('comparison schemas bound requests and reject mismatched or empty model answers', async () => {
  const { comparisonRequestSchema, validateComparisonResponse } =
    await import('../features/subject-selection/comparison.ts');
  assert.equal(
    comparisonRequestSchema.safeParse(comparisonInput).success,
    true,
  );
  assert.equal(
    comparisonRequestSchema.safeParse({ ...comparisonInput, candidates: [] })
      .success,
    false,
  );
  assert.equal(
    comparisonRequestSchema.safeParse({
      ...comparisonInput,
      candidates: Array(3).fill(comparisonInput.candidates[0]),
    }).success,
    false,
  );
  const answer = {
    id: 'society',
    recommendation: '기본 추천',
    currentConnection: '현재 연결',
    alternativeConnection: '대안 연결',
    tradeoff: '장단점',
    decisionGuide: '선택 기준',
  };
  assert.equal(
    validateComparisonResponse({ comparisons: [answer] }, comparisonInput)
      .comparisons.length,
    1,
  );
  assert.throws(() =>
    validateComparisonResponse(
      { comparisons: [{ ...answer, id: 'other' }] },
      comparisonInput,
    ),
  );
  assert.throws(() =>
    validateComparisonResponse(
      { comparisons: [answer, answer] },
      comparisonInput,
    ),
  );
  assert.throws(() =>
    validateComparisonResponse(
      { comparisons: [{ ...answer, tradeoff: '' }] },
      comparisonInput,
    ),
  );
});

test(
  'live AI comparison returns explanations for the requested candidates',
  { skip: process.env.SUBJECT_COMPARISON_LIVE !== '1' },
  async (context) => {
    const { explainComparison } =
      await import('../features/subject-selection/explain-comparison.ts');
    const result = await explainComparison(comparisonInput);
    assert.equal(result.comparisons[0].id, 'society');
    context.diagnostic(JSON.stringify(result));
  },
);

test('university recommendation changes are not discarded', () => {
  const physics = course('physics', '물리학', '과학');
  const society = course('society', '사회와 문화');
  const data = {
    priorRequiredCourses: [],
    terms: [
      {
        label: '2-1',
        requiredCourses: [],
        selectionGroups: [{ courses: [physics, society] }],
      },
    ],
  };
  const changes = universityChanges(
    data,
    ['physics'],
    'physics',
    society,
    '기계공학과',
    null,
  );
  assert.ok(changes.length > 0);
  assert.ok(changes.some((item) => item.includes('부족')));
});
test('science hierarchy covers all four areas and recognizes completed basics', async () => {
  const { scienceSequenceGaps } =
    await import('../features/subject-selection/science-sequence.ts');
  for (const [basic, advanced] of [
    ['물리학', '역학과 에너지'],
    ['물리학', '전자기와 양자'],
    ['화학', '물질과 에너지'],
    ['화학', '화학 반응의 세계'],
    ['생명과학', '세포와 물질대사'],
    ['생명과학', '생물의 유전'],
    ['지구과학', '지구시스템과학'],
    ['지구과학', '행성우주과학'],
  ]) {
    assert.equal(scienceSequenceGaps([{ name: advanced }]).length, 1);
    assert.equal(
      scienceSequenceGaps([{ name: advanced }, { name: basic }]).length,
      0,
    );
  }
});
const b = course('b', '정치');
const c = course('c', '세계사');
const fixed = course('fixed', '사회와 문화');
const curriculum = {
  schoolName: '테스트고',
  currentGrade: 1,
  targetCohort: 2026,
  track: null,
  source: 'manual',
  priorRequiredCourses: [],
  linkedRules: [],
  terms: [
    {
      id: 'grade-2-semester-1',
      label: '2-1',
      requiredCourses: [],
      selectionGroups: [
        {
          id: 'g',
          name: '선택',
          choose: 2,
          rule: null,
          courses: [fixed, a, b, c],
        },
      ],
    },
  ],
};
test('only stage two can be exchanged with an unselected course in the same group', () => {
  assert.equal(swapProblem(curriculum, ['fixed'], ['a'], 'a', 'b'), null);
  assert.ok(swapProblem(curriculum, ['fixed'], ['a'], 'fixed', 'b'));
  assert.ok(swapProblem(curriculum, ['fixed'], ['a'], 'a', 'fixed'));
  assert.ok(swapProblem(curriculum, ['fixed'], ['a'], 'a', 'missing'));
});

test('question templates route selected-course necessity and unselected-course omission correctly', async () => {
  const { counselingTemplates } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  assert.equal(counselingTemplates.find(item => item.label === '이 과목을 꼭 들어야 하나요?').id, 'omit');
  assert.equal(counselingTemplates.find(item => item.label === '이 과목 안 들어도 괜찮나요?').id, 'consider');
});

test('considering an unselected subject offers only replaceable stage-two subjects', async () => {
  const { questionOptions } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  const options = questionOptions(curriculum, ['fixed'], ['a'], 'b');
  assert.deepEqual(options.replacements.map(item => item.course.id), ['a']);
  assert.deepEqual(options.unselected.map(item => item.course.id), ['b', 'c']);
  const prior = questionOptions({ ...curriculum, priorRequiredCourses: [course('prior', '정치')] }, ['fixed'], ['a'], 'b');
  assert.equal(prior.unselected.some(item => item.course.id === 'b'), false);
  assert.equal(prior.replacements.length, 0);
});

test('preliminary course advice distinguishes optional recommendations from core choices', async () => {
  const { courseQuestionSummary } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  const profile = { core: ['물리학'], coreChoices: [{ courses: ['생명과학'], choose: 1 }], subCore: ['경제'], recommendDomains: ['사회'] };
  assert.match(courseQuestionSummary(a, profile).recommendation, /Sub core/);
  assert.match(courseQuestionSummary(course('p', '물리학'), profile).recommendation, /필수 코어에 해당/);
  assert.match(courseQuestionSummary(course('b', '생명과학'), profile).recommendation, /무조건 필수라는 뜻은 아니며/);
  assert.match(courseQuestionSummary(b, profile).recommendation, /추천 과목군/);
});

test('grade concern alone does not boost an alternative without a directional estimate', () => {
  assert.equal(compareAdvice(a, b, null, 'grades', false).score, compareAdvice(a, b, null, 'neutral', false).score);
  assert.ok(compareAdvice(a, b, null, 'grades', true).score > compareAdvice(a, b, null, 'grades', false).score);
});
test('duplicate prior completion and unknown or different credits cannot be exchanged', () => {
  assert.ok(
    swapProblem(
      { ...curriculum, priorRequiredCourses: [course('prior', '정치')] },
      ['fixed'],
      ['a'],
      'a',
      'b',
    ),
  );
  for (const credit of [null, 2, NaN]) {
    const copy = structuredClone(curriculum);
    copy.terms[0].selectionGroups[0].courses[2].credit = credit;
    assert.ok(swapProblem(copy, ['fixed'], ['a'], 'a', 'b'));
  }
});
test('arts credits and school-specific science requirements are protected', () => {
  const copy = structuredClone(curriculum);
  copy.terms[0].selectionGroups[0].courses[1] = course('a', '음악', '예술');
  assert.ok(swapProblem(copy, ['fixed'], ['a'], 'a', 'b'));
  copy.terms[0].selectionGroups[0].courses[1] = course('a', '물리학', '과학');
  copy.linkedRules = ['(과학) 2학년 1학기에 1개 과목 이상 선택'];
  assert.ok(swapProblem(copy, ['fixed'], ['a'], 'a', 'b'));
});
test('swapping a science basic cannot strand a selected advanced course', () => {
  const copy = structuredClone(curriculum);
  copy.terms[0].selectionGroups[0].courses[0] = course(
    'fixed',
    '역학과 에너지',
    '과학',
  );
  copy.terms[0].selectionGroups[0].courses[1] = course('a', '물리학', '과학');
  assert.match(swapProblem(copy, ['fixed'], ['a'], 'a', 'b'), /물리학/);
  assert.equal(swapProblem(copy, ['fixed'], ['a'], 'a', 'b', true), null);
  assert.ok(swapProblem(copy, ['fixed'], ['a'], 'fixed', 'b', true));
  copy.priorRequiredCourses = [course('prior', '물리학', '과학')];
  assert.equal(swapProblem(copy, ['fixed'], ['a'], 'a', 'b'), null);
});
test('recommendation scores change advice but do not restrict student choice', () => {
  const profile = { core: [], subCore: ['경제'], recommendDomains: ['사회'] };
  assert.equal(
    compareAdvice(a, b, profile, 'neutral', false).verdict,
    '현재 과목 우선 추천',
  );
  assert.equal(
    compareAdvice(a, b, profile, 'grades', true).verdict,
    '둘 다 가능',
  );
  assert.equal(swapProblem(curriculum, ['fixed'], ['a'], 'a', 'b'), null);
});
test('replacement and undo snapshots preserve stage one and update the unselected pool', () => {
  for (const [replacements, expected] of [
    [{}, 'a'],
    [{ a: 'b' }, 'b'],
    [{ a: 'c' }, 'c'],
    [{ a: 'b' }, 'b'],
    [{}, 'a'],
  ]) {
    const [term] = buildStandardDraft(
      curriculum,
      ['fixed'],
      null,
      replacements,
    );
    assert.deepEqual(
      term.confirmedCourses.map(({ course }) => course.id),
      ['fixed'],
    );
    assert.deepEqual(
      term.recommendedCourses.map(({ course }) => course.id),
      [expected],
    );
    assert.ok(
      !term.unselectedGroups[0].courses.some(
        ({ course }) => course.id === expected,
      ),
    );
    assert.equal(term.unselectedGroups[0].courses.length, 2);
  }
});

const scienceDraftFixture = (basic, advanced) => ({
  ...curriculum,
  terms: [
    { ...curriculum.terms[0], selectionGroups: [{ id: 'early', name: 'early', choose: 1, courses: [fixed, course('basic', basic, '과학')] }] },
    { id: 'grade-2-semester-2', label: '2-2', requiredCourses: [], selectionGroups: [{ id: 'late', name: 'late', choose: 1, courses: [course('advanced', advanced, '과학'), b] }] },
  ],
});
const scienceProfile = { core: [], subCore: [], recommendDomains: ['과학'] };

test('graduation compensation prefers 3-2 and applies multiple courses atomically', async () => {
  const { findGraduationCompensation } = await import('../app/(private)/consulting/subject-selection/_lib/graduation-compensation.ts');
  const { confirmedSwapProblem, validateConfirmedAdjustment } = await import('../app/(private)/consulting/subject-selection/_lib/confirmed-adjustment.ts');
  const info = course('info', '정보과학', '정보', 3);
  const target = course('target', '경제', '사회', 3);
  const early = course('early', '진로와 직업', '교양', 3);
  const late1 = course('late1', '인간과 철학', '교양', 2);
  const late2 = course('late2', '논리와 사고', '교양', 2);
  const data = { ...curriculum, linkedRules: [], priorRequiredCourses: [course('prior', '교양 기이수', '교양', 13)], terms: [
    { id: 'grade-3-semester-1', label: '3-1', requiredCourses: [], selectionGroups: [
      { id: 'swap', name: '교체군', choose: 1, courses: [info, target] },
      { id: 'early-group', name: '교양', choose: 1, courses: [early] },
    ] },
    { id: 'grade-3-semester-2', label: '3-2', requiredCourses: [], selectionGroups: [
      { id: 'late-group', name: '교양', choose: 2, courses: [late1, late2] },
    ] },
  ] };
  const find = () => findGraduationCompensation(data, ['info'], ['target'],
    (items) => !confirmedSwapProblem(data, ['info'], scienceProfile, 'info', 'target', items));
  assert.match(confirmedSwapProblem(data, ['info'], scienceProfile, 'info', 'target'), /이수조건/);
  const additions = find();
  assert.deepEqual(additions.map((item) => item.course.id), ['late1', 'late2']);
  const proposal = { originalIds: ['info'], nextIds: ['target', 'late1', 'late2'], swaps: [
    { from: info, to: target, term: '3-1', group: '교체군', compensations: additions },
  ] };
  assert.equal(validateConfirmedAdjustment(data, ['info'], scienceProfile, proposal), null);
  assert.ok(validateConfirmedAdjustment(data, ['info'], scienceProfile, { ...proposal, nextIds: ['target'] }));
  assert.ok(confirmedSwapProblem(data, ['info'], scienceProfile, 'info', 'target', [...additions, additions[0]]));
  data.linkedRules = ['(정보) 3학년 1학기에 1개 과목 이상 선택'];
  assert.equal(find(), null, '3-1 school requirement cannot be moved to 3-2');
  data.linkedRules = [];
  data.terms[1].selectionGroups[0].choose = 0;
  assert.deepEqual(find().map((item) => item.course.id), ['early']);
  data.terms[0].selectionGroups[1].choose = 0;
  assert.equal(find(), null);
});

test('confirmed science swap uses free prerequisite slots but rejects a genuinely full basic group', async () => {
  const { confirmedSwapProblem } = await import('../app/(private)/consulting/subject-selection/_lib/confirmed-adjustment.ts');
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  const profile = { ...scienceProfile, core: [] };
  assert.equal(confirmedSwapProblem(data, ['b'], profile, 'b', 'advanced'), null);
  assert.match(confirmedSwapProblem(data, ['fixed', 'b'], profile, 'b', 'advanced'), /선행 과목/);
});

test('confirmed adjustment frees genetics capacity while preserving energy core and existing requirements', async () => {
  const { findConfirmedAdjustment, validateConfirmedAdjustment, confirmedSwapProblem } = await import('../app/(private)/consulting/subject-selection/_lib/confirmed-adjustment.ts');
  const { default: data } = await import('../app/(private)/consulting/subject-selection/_data/test-curriculum.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const primary = findPriorityProfile('에너지공학과').profile;
  const secondary = findPriorityProfile('생명과학과').profile;
  const all = data.terms.flatMap(term => term.selectionGroups.flatMap(group => group.courses));
  const id = name => { const found = all.find(item => item.name === name); assert.ok(found, name); return found.id; };
  const names = ['기하', '물리학', '화학', '정보', '역학과 에너지', '물질과 에너지', '인공지능 기초', '일본어 회화', '미적분Ⅱ', '전자기와 양자', '화학 반응의 세계', '정보과학', '진로와 직업', '인간과 철학', '논리와 사고', '인간과 심리'];
  const ids = names.map(id);
  const before = [...ids];
  const result = findConfirmedAdjustment(data, ids, primary, secondary, 'primary', []);
  assert.ok(result.proposal, `attempts=${result.attempts}`);
  assert.ok(result.proposal.nextIds.includes(id('생물의 유전')));
  assert.equal(result.proposal.swaps.length, 1);
  assert.ok(result.proposal.nextIds.includes(id('정보')));
  assert.ok(!result.proposal.nextIds.includes(id('생명과학')));
  assert.ok(result.proposal.result.additions.some(item => item.id === id('생명과학')));
  const regenerated = buildStandardDraft(data, result.proposal.nextIds, primary);
  assert.ok(regenerated[0].recommendedCourses.some(item => item.course.id === id('생명과학')));
  assert.equal(result.proposal.result.status, 'both');
  assert.equal(validateConfirmedAdjustment(data, ids, primary, result.proposal), null);
  assert.deepEqual(ids, before);
  assert.ok(validateConfirmedAdjustment(data, ids.slice(1), primary, result.proposal));
  assert.ok(confirmedSwapProblem(data, ids, primary, id('물리학'), id('생명과학')));
  assert.ok(confirmedSwapProblem(data, ids, primary, id('정보과학'), id('생명과학')));
});

test('physics recognizes chemistry-area depth without turning every science into depth', async () => {
  const { majorDepth, majorDepthEvidence, evaluateMajorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const physics = findPriorityProfile('물리학과').profile;
  const material = findPriorityProfile('신소재공학과').profile;
  const names = ['미적분 II', '기하', '물리학', '화학', '역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'];
  const completed = names.map((name, i) => course(String(i), name));
  const result = majorDepth(physics, completed);
  assert.equal(result.depth.length, 4);
  assert.deepEqual(result.beyondCore.map(item => item.name), ['물질과 에너지', '화학 반응의 세계']);
  assert.equal(majorDepthEvidence(physics, { name: '물질과 에너지' }), '화학 보완 영역의 심화');
  assert.equal(majorDepthEvidence(physics, { name: '지구시스템과학' }), null);
  assert.equal(majorDepthEvidence(physics, { name: '화학' }), null);
  assert.equal(evaluateMajorDepth(material, physics, completed, completed).supported, true);
  const coreOnly = majorDepth(physics, completed.filter(item => !['물질과 에너지', '화학 반응의 세계'].includes(item.name)));
  assert.equal(coreOnly.sufficient, true);
  assert.equal(coreOnly.beyondCore.length, 0);
  const missingBasic = majorDepth(physics, [course('c', '물질과 에너지'), course('d', '화학 반응의 세계')]);
  assert.equal(missingBasic.sufficient, false);
  assert.equal(missingBasic.depth.length, 0);
  assert.equal(missingBasic.missingFoundation.length, 2);
});

test('science area depth works consistently across chemistry, biology and earth profiles', async () => {
  const { majorDepthEvidence } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  for (const [department, subject, expected] of [
    ['화학과', '생물의 유전', '생명과학 보완 영역의 심화'],
    ['생물학과', '물질과 에너지', '화학 보완 영역의 심화'],
    ['지구과학과', '전자기와 양자', '물리학 보완 영역의 심화'],
    ['행정학과', '물질과 에너지', null],
  ]) assert.equal(majorDepthEvidence(findPriorityProfile(department).profile, { name: subject }), expected);
});

test('choice core surplus counts as depth while minimum and required subareas stay reserved', async () => {
  const { majorDepth, evaluateMajorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const material = findPriorityProfile('신소재공학과').profile;
  const bio = findPriorityProfile('바이오공학과').profile;
  const all = ['미적분 II', '기하', '물리학', '화학', '생명과학', '역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계', '세포와 물질대사'].map((name, i) => course(String(i), name));
  assert.equal(majorDepth(material, all).beyondCore.length, 2);
  assert.equal(evaluateMajorDepth(material, bio, all, all).supported, true);
  const minimum = all.filter(item => !['물질과 에너지', '화학 반응의 세계'].includes(item.name));
  assert.equal(majorDepth(material, minimum).beyondCore.length, 0);
  const chemical = findPriorityProfile('화학공학과').profile;
  const result = majorDepth(chemical, all);
  assert.equal(result.beyondCore.length, 2);
  assert.ok(result.beyondCore.some(item => item.name === '전자기와 양자'));
});

test('major depth does not substitute broad recommended domains or core-only coverage for depth', async () => {
  const { majorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const profile = { ...scienceProfile, core: ['물리학', '역학과 에너지'], subCore: ['전자기와 양자', '화학'] };
  assert.equal(majorDepth(profile, [course('a', '역학과 에너지'), course('b', '지구과학'), course('c', '화학')]).sufficient, false);
  const ready = majorDepth(profile, [course('basic', '물리학'), course('a', '역학과 에너지'), course('b', '전자기와 양자'), course('duplicate', '전자기와양자')]);
  assert.equal(ready.depth.length, 2);
  assert.equal(ready.beyondCore.length, 1);
  assert.equal(ready.sufficient, true);
});

test('combined depth requires shared academic foundations and protects single-major depth', async () => {
  const { evaluateMajorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const first = { ...scienceProfile, core: ['물리학', '화학'], subCore: ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'] };
  const close = { ...first };
  const distant = { core: ['정치', '법과 사회'], subCore: ['사회와 문화', '윤리와 사상'], recommendDomains: ['사회'] };
  const baseline = [...first.core, ...first.subCore].map((name, index) => course(String(index), name));
  const combined = [...baseline, ...distant.core.map((name, index) => course(`c${index}`, name)), ...distant.subCore.map((name, index) => course(`s${index}`, name))];
  const unrelated = evaluateMajorDepth(first, distant, baseline, combined);
  assert.equal(unrelated.first.sufficient, true);
  assert.equal(unrelated.second.sufficient, true);
  assert.equal(unrelated.supported, false);
  assert.equal(unrelated.shared.length, 0);
  assert.equal(evaluateMajorDepth(first, close, baseline, baseline).supported, true);
  const reduced = evaluateMajorDepth(first, close, baseline, baseline.slice(0, 4));
  assert.equal(reduced.first.sufficient, true);
  assert.equal(reduced.retention, 0.5);
  assert.equal(reduced.lost.length, 2);
  assert.equal(reduced.supported, false);
});

test('combined-major preview preserves fixed courses and flags unavailable core capacity', async () => {
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const first = { ...scienceProfile, core: ['사회와 문화'], subCore: ['경제'] };
  const second = { ...scienceProfile, core: ['세계사'], subCore: ['정치'] };
  const result = buildCombinedMajorDraft(curriculum, ['fixed'], first, second, 'equal', ['a']);
  assert.deepEqual(result.terms[0].confirmedCourses.map(item => item.course.id), ['fixed']);
  assert.deepEqual(result.additions.map(item => item.id), ['c']);
  assert.deepEqual(result.displaced.map(item => item.id), ['a']);
  assert.equal(result.status, 'focused');
  const full = buildCombinedMajorDraft(curriculum, ['fixed', 'a'], first, second, 'primary');
  assert.equal(full.status, 'review');
  assert.deepEqual(full.assessments[1].missing, ['세계사']);
  assert.equal(full.terms[0].recommendedCourses.length, 0);
});

test('combined-major preview inserts science prerequisites and reports failed choice cores', async () => {
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  const second = { ...scienceProfile, core: ['지구시스템과학'], coreChoices: [{ id: 'choice', label: '선택', courses: ['행성우주과학'], choose: 1 }] };
  const result = buildCombinedMajorDraft(data, [], scienceProfile, second, 'equal');
  assert.deepEqual(result.additions.map(item => item.id), ['basic', 'advanced']);
  assert.equal(result.gaps.length, 0);
  assert.equal(result.assessments[1].choices.length, 1);
  assert.equal(result.status, 'review');
});

test('combined-major priority changes optional recommendations without changing fixed choices', async () => {
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const first = { ...scienceProfile, subCore: [], recommendCourses: ['경제'], recommendDomains: [] };
  const second = { ...scienceProfile, subCore: ['정치'], recommendDomains: [] };
  assert.equal(buildCombinedMajorDraft(curriculum, ['fixed'], first, second, 'primary').terms[0].recommendedCourses[0].course.id, 'a');
  assert.equal(buildCombinedMajorDraft(curriculum, ['fixed'], first, second, 'equal').terms[0].recommendedCourses[0].course.id, 'b');
});

test('removed subjects stay out of automatic advice, allow explicit comparison and follow undo history', async () => {
  const { removedCourseIds, counselingCandidates } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  const history = [{}, { a: 'b' }, { a: 'c' }];
  assert.deepEqual([...removedCourseIds(history)], ['a', 'b']);
  assert.deepEqual([...removedCourseIds(history.slice(0, 2))], ['a']);
  assert.equal(removedCourseIds([{}]).size, 0);
  assert.deepEqual(counselingCandidates([a, b, c], null, '', false, [a, b]).map(item => item.id), ['c']);
  assert.deepEqual(counselingCandidates([a, b, c], null, 'a', false, [a, b]).map(item => item.id), ['a', 'c']);
  assert.deepEqual(counselingCandidates([course('another-term', a.name), c], null, '', false, [a]).map(item => item.id), ['c']);
});

test('science workload preference filters automatic alternatives but preserves explicit comparisons', async () => {
  const { suggestsReducingScience, counselingCandidates } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  assert.equal(suggestsReducingScience('과학을 세과목이나 듣는건 어려울거 같아요'), true);
  assert.equal(suggestsReducingScience('과학 과목 수를 줄이고 싶어요'), true);
  assert.equal(suggestsReducingScience('생명과학 암기가 부담돼요'), false);
  assert.equal(suggestsReducingScience('과학 세 과목도 어렵지 않아요'), false);
  const earth = course('earth', '지구과학', '과학');
  assert.deepEqual(counselingCandidates([earth, b], scienceProfile, '', true).map(item => item.id), ['b']);
  assert.deepEqual(counselingCandidates([earth], scienceProfile, '', true), []);
  assert.deepEqual(counselingCandidates([earth, b], scienceProfile, 'earth', true).map(item => item.id), ['earth', 'b']);
  assert.equal(counselingCandidates([earth, b], scienceProfile, '', false)[0].id, 'earth');
});

test('initial draft excludes advanced sciences when the basic cannot fit the confirmed group', () => {
  for (const [basic, advanced] of [
    ['물리학', '역학과 에너지'],
    ['화학', '물질과 에너지'],
    ['생명과학', '세포와 물질대사'],
    ['지구과학', '지구시스템과학'],
  ]) {
    const draft = buildStandardDraft(scienceDraftFixture(basic, advanced), ['fixed'], scienceProfile);
    assert.deepEqual(draft[0].confirmedCourses.map(item => item.course.id), ['fixed']);
    assert.deepEqual(draft[1].recommendedCourses.map(item => item.course.id), ['b']);
    assert.ok(draft[1].unselectedGroups[0].courses.some(item => item.course.id === 'advanced'));
  }
});

test('initial draft accepts prior, school-required, confirmed and automatically selected science basics', () => {
  for (const mode of ['prior', 'required', 'confirmed', 'recommended']) {
    const data = scienceDraftFixture('지구과학', '지구시스템과학');
    const basic = course('basic', '지구과학', '과학');
    let confirmed = ['fixed'];
    if (mode === 'prior') data.priorRequiredCourses = [basic];
    if (mode === 'required') data.terms[0].requiredCourses = [basic];
    if (mode === 'confirmed') confirmed = ['basic'];
    if (mode === 'recommended') confirmed = [];
    const draft = buildStandardDraft(data, confirmed, scienceProfile);
    assert.deepEqual(draft[1].recommendedCourses.map(item => item.course.id), ['advanced'], mode);
  }
});

test('initial draft reevaluates advanced candidates after picking a basic within the group', () => {
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  data.terms = [data.terms[1]];
  data.terms[0].selectionGroups[0].choose = 2;
  data.terms[0].selectionGroups[0].courses = [course('advanced', '지구시스템과학', '과학'), course('basic', '지구과학', '과학'), b];
  const draft = buildStandardDraft(data, [], { ...scienceProfile, subCore: ['지구시스템과학'] });
  assert.deepEqual(draft[0].recommendedCourses.map(item => item.course.id), ['basic', 'advanced']);
});

test('unavailable science basics leave a vacancy rather than an unsupported automatic recommendation', () => {
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  data.terms[1].selectionGroups[0].courses.pop();
  const draft = buildStandardDraft(data, ['fixed'], scienceProfile);
  assert.equal(draft[1].recommendedCourses.length, 0);
  assert.equal(draft[1].unfilledCount, 1);
});

test('explicit student replacements can still select an advanced course without its basic', () => {
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  const draft = buildStandardDraft(data, ['fixed'], scienceProfile, { b: 'advanced' });
  assert.deepEqual(draft[1].recommendedCourses.map(item => item.course.id), ['advanced']);
});
