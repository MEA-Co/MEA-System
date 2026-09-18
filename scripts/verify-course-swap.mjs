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
test('humanities directional courses remain recommendations rather than strongly advised sub-core', async () => {
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { priority } = await import('../app/(private)/consulting/subject-selection/_lib/course-swap.ts');
  for (const [department, names] of [
    ['광고홍보학과', ['경제', '실용 통계', '문학과 영상']],
    ['경영학과', ['사회와 문화', '인간과 심리']],
    ['경제학과', ['실용 통계', '금융과 경제생활']],
    ['행정학과', ['경제']],
    ['법학과', ['현대사회와 윤리']],
    ['사회복지학과', ['현대사회와 윤리']],
    ['심리학과', ['생명과학']],
    ['미디어학과', ['문학과 영상']],
    ['철학과', ['인문학과 윤리']],
    ['무역학과', ['세계시민과 지리']],
    ['국제학과', ['세계시민과 지리']],
  ]) {
    const profile = findPriorityProfile(department).profile;
    for (const name of names) {
      assert.ok(!profile.subCore.includes(name), `${department}: ${name}`);
      assert.ok(profile.recommendCourses.includes(name), `${department}: ${name} remains recommended`);
      assert.ok(priority(course('direction', name), profile).score < 6);
    }
  }
  const ad = findPriorityProfile('광고홍보학과').profile;
  assert.deepEqual(ad.subCore, ['매체 의사소통', '인간과 심리']);
  assert.ok(priority(course('foundation', '매체 의사소통'), ad).score >= 6);
});
test('health drafts prefer one ethics course after sub-core, counting prior and fixed courses', async () => {
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const profile = findPriorityProfile('의예과').profile;
  const physics = course('mechanics', '역학과 에너지', '과학');
  const ethics = course('ethics-med', '현대사회와 윤리');
  const inquiry = course('ethics-inquiry', '윤리문제 탐구');
  const bio = course('bio-med', '세포와 물질대사', '과학');
  const data = {
    priorRequiredCourses: [course('physics-basic', '물리학', '과학'), course('bio-basic', '생명과학', '과학')], linkedRules: [],
    terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: [], selectionGroups: [{ id: 'med', name: '선택', choose: 2, courses: [physics, ethics, inquiry, bio] }] }],
  };
  const picks = (plan, fixed = []) => buildStandardDraft(plan, fixed, profile).flatMap((term) => term.recommendedCourses.map((item) => item.course.name));
  assert.deepEqual(picks(data), [bio.name, ethics.name]);
  const noSubcore = structuredClone(data);
  noSubcore.terms[0].selectionGroups[0].courses.pop();
  assert.deepEqual(picks(noSubcore), [ethics.name, physics.name], 'do not prioritize both ethics courses');
  assert.deepEqual(picks(noSubcore, [ethics.id]), [physics.name], 'stage-one ethics already counts');
  const prior = structuredClone(noSubcore);
  prior.priorRequiredCourses.push(ethics);
  prior.terms[0].selectionGroups[0].choose = 1;
  assert.deepEqual(picks(prior), [physics.name], 'prior ethics already counts');
  const school = structuredClone(noSubcore);
  school.terms[0].requiredCourses.push(ethics);
  school.terms[0].selectionGroups[0].choose = 1;
  assert.deepEqual(picks(school), [physics.name], 'school-required ethics already counts');
  assert.equal(profile.recommendDomains.includes('사회'), false);
  assert.equal(profile.core.includes(ethics.name), false);
  assert.equal(profile.subCore.includes(ethics.name), false);
  const unavailable = structuredClone(noSubcore);
  unavailable.terms[0].selectionGroups[0].courses = [physics];
  unavailable.terms[0].selectionGroups[0].choose = 1;
  assert.deepEqual(picks(unavailable), [physics.name]);
});
test('reviewed profiles keep named academic connections above broad domain order', async () => {
  const { findPriorityProfile, PRIORITY_PROFILES, normalizeCourseName } = await import('../features/subject-selection/recommendations.ts');
  const { subjectSelectionCourses } = await import('../app/(private)/consulting/subject-selection/_lib/subjects.ts');
  const known = new Set(subjectSelectionCourses.map((item) => normalizeCourseName(item.name)));
  // Korean/English/math general electives were omitted from the source catalog.
  for (const name of ['확률과 통계', '영어 독해와 작문']) known.add(normalizeCourseName(name));
  for (const base of PRIORITY_PROFILES) for (const department of base.departments) {
    const profile = findPriorityProfile(department).profile;
    for (const name of [...(profile.recommendCourses ?? []), ...(profile.withinTierPreferences ?? []).flatMap((item) => item.courses)])
      assert.ok(known.has(normalizeCourseName(name)), `${department}: unknown course ${name}`);
  }
  for (const [department, preferred, other, domain] of [
    ['심리학과', '세포와 물질대사', '역학과 에너지', '과학'],
    ['환경공학과', '기후변화와 환경생태', '행성우주과학', '과학'],
    ['도시공학과', '세계시민과 지리', '생명과학', '사회'],
    ['산업공학과', '실용 통계', '화학', '수학'],
    ['사학과', '한국지리 탐구', '금융과 경제생활', '사회'],
    ['미디어학과', '정치', '윤리와 사상', '사회'],
  ]) {
    const profile = findPriorityProfile(department).profile;
    const plan = { priorRequiredCourses: [course('p', '물리학', '과학'), course('b', '생명과학', '과학'), course('e', '지구과학', '과학')], linkedRules: [], terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: [], selectionGroups: [{ id: 'g', name: '선택', choose: 1, courses: [course('other', other, domain), course('preferred', preferred, domain)] }] }] };
    assert.equal(buildStandardDraft(plan, [], profile)[0].recommendedCourses[0].course.name, preferred, department);
  }
});
test('2022 basic-credit ceiling includes prior courses, excludes activities and guards every swap', async () => {
  const { basicCreditStatus, basicCreditKind } = await import('../app/(private)/consulting/subject-selection/_lib/basic-credit-limit.ts');
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const math = course('math-cap', '미적분 II', '수학');
  const science = course('science-cap', '물리학', '과학');
  const plan = {
    schoolName: '상한 테스트', currentGrade: 1, targetCohort: 2026, track: '일반 과정', source: 'manual', linkedRules: [],
    priorRequiredCourses: [course('prior-basic', '기이수 국어', '국어', 81), course('prior-other', '기이수 과학', '과학', 90)],
    terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: [], selectionGroups: [{ id: 'cap-group', name: '선택', choose: 1, rule: null, courses: [math, science] }] }],
  };
  const full = [...plan.priorRequiredCourses, science];
  assert.equal(basicCreditStatus(plan, full).limit, 81);
  assert.equal(basicCreditStatus(plan, full).exceeded, false);
  assert.match(swapProblem(plan, [], [science.id], science.id, math.id, true), /상한 81/);
  const profile = { id: 'test', label: 'test', departments: [], core: [], subCore: [math.name], recommendDomains: ['과학'] };
  const draft = buildStandardDraft(plan, [], profile);
  assert.equal(draft[0].recommendedCourses[0].course.id, science.id);
  assert.equal(buildStandardDraft(plan, [], profile, { [science.id]: math.id })[0].recommendedCourses[0].course.id, science.id);
  const combined = buildCombinedMajorDraft(plan, [], profile, { ...profile, core: [math.name] });
  assert.ok(!combined.terms.flatMap((term) => term.recommendedCourses).some((item) => item.course.id === math.id));
  const excess = [...plan.priorRequiredCourses, math, course('extra', '추가 과학', '과학', 6)];
  assert.equal(basicCreditStatus(plan, excess).limit, 84);
  assert.equal(basicCreditStatus(plan, excess).exceeded, false);
  assert.equal(basicCreditStatus(plan, [...full, course('activity', '창의적 체험활동', '창체', 18)]).limit, 81);
  assert.equal(basicCreditKind(course('common', '공통수학1', null)), 'basic');
  const broken = structuredClone(plan);
  broken.priorRequiredCourses[0].credit = null;
  assert.match(swapProblem(broken, [], [science.id], science.id, math.id), /미확인/);
  const over = structuredClone(plan);
  over.priorRequiredCourses[0].credit = 84;
  assert.equal(swapProblem(over, [], [math.id], math.id, science.id), null, 'allow a repair that reduces excess');
  assert.equal(basicCreditStatus({ ...plan, targetCohort: 2024 }, full).applicable, false);
});
test('fit summary uses only fixed templates and actual course names', async () => {
  const { comparisonFitSummary } = await import('../features/subject-selection/comparison.ts');
  assert.equal(comparisonFitSummary('물질과 에너지', '세포와 물질대사', { fitPreference: 'current', alternativeInterest: '생명 분야' }),
    '전공 연관성에서는 물질과 에너지가 세포와 물질대사보다 더 적합해요. 하지만 생명 분야에 관심이 있다면 세포와 물질대사도 괜찮은 선택이에요.');
  assert.match(comparisonFitSummary('물질과 에너지', '물리학', { fitPreference: 'alternative', alternativeInterest: '화학' }), /물리학이 물질과 에너지보다/);
  assert.equal(comparisonFitSummary('a', 'b', { fitPreference: 'similar', alternativeInterest: '관심 분야' }),
    '두 과목은 전공 연관성 측면에서 비슷해요. 더 관심 있거나 성적에 자신 있는 과목을 골라주세요.');
});
test('combined counseling checks secondary preparation before recommending a swap', async () => {
  const { combinedComparison } = await import('../app/(private)/consulting/subject-selection/_lib/combined-comparison.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { comparisonContext } = await import('../features/subject-selection/explain-comparison.ts');
  const primary = { department: '건축학과', profile: findPriorityProfile('건축학과').profile };
  const secondary = { department: '산업공학과', profile: findPriorityProfile('산업공학과').profile };
  const chemistry = course('chemistry', '물질과 에너지', '과학');
  const geo = course('geo', '한국지리 탐구');
  const history = course('history', '동아시아 역사 기행');
  const biology = course('biology', '세포와 물질대사', '과학');
  const sameTier = combinedComparison(chemistry, biology, primary, secondary, [chemistry], 'neutral', false);
  assert.equal(sameTier.verdict, '둘 다 가능');
  assert.ok(sameTier.impacts.every((impact) => !impact.weakened));
  const preferred = course('preferred', '세계시민과 지리');
  const ethics = course('ethics', '현대사회와 윤리');
  const slightPreference = combinedComparison(preferred, ethics, primary, secondary, [preferred], 'neutral', false);
  assert.equal(slightPreference.verdict, '둘 다 가능');
  assert.ok(slightPreference.impacts.every((impact) => !impact.weakened));
  for (const candidate of [geo, history]) {
    const result = combinedComparison(chemistry, candidate, primary, secondary, [chemistry], 'grades', true);
    assert.equal(result.verdict, '현재 과목 우선 추천');
    assert.equal(result.impacts[1].weakened, true);
    assert.match(result.impacts[1].message, /산업공학과/);
    assert.equal(result.impacts[1].insufficient, false, 'losing domain preference is not losing a core requirement');
  }
  const physics = course('physics', '물리학', '과학');
  const safer = combinedComparison(chemistry, physics, primary, secondary, [chemistry], 'neutral', false);
  assert.ok(safer.score > combinedComparison(chemistry, geo, primary, secondary, [chemistry], 'neutral', false).score);
  const context = comparisonContext({ department: primary.department, secondaryDepartment: secondary.department, current: chemistry.name, candidates: [] });
  assert.equal(context.internalPolicy.profile.matchedDepartment, primary.department);
  assert.equal(context.secondaryPolicy.profile.matchedDepartment, secondary.department);
});
test('architecture prioritizes spatial courses within a tier and specialized math needs explicit endorsement', async () => {
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { priority } = await import('../app/(private)/consulting/subject-selection/_lib/course-swap.ts');
  const { getCourseTags } = await import('../app/(private)/consulting/subject-selection/_lib/course-selection-utils.ts');
  const { allowsDomainRecommendation } = await import('../features/subject-selection/course-priority-policy.ts');
  const architecture = findPriorityProfile('건축학과').profile;
  const ethics = course('ethics', '현대사회와 윤리');
  const geo = course('geo', '세계시민과 지리');
  const economicsMath = course('econ-math', '경제 수학', '수학');
  const physics = course('physics', '물리학', '과학');
  const draft = (courses, profile = architecture, replacements = {}) => buildStandardDraft({ priorRequiredCourses: [], linkedRules: [], terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: [], selectionGroups: [{ id: 'g', name: '선택', choose: 1, courses }] }] }, [], profile, replacements)[0].recommendedCourses[0];
  assert.equal(draft([ethics, geo]).course.id, 'geo');
  assert.equal(draft([geo, ethics]).course.id, 'geo');
  assert.equal(draft([geo, physics]).course.id, 'physics', 'Sub core still outranks within-tier preference');
  assert.match(draft([ethics, geo]).note, /공간/);
  assert.equal(draft([ethics, geo], architecture, { geo: 'ethics' }).note, undefined);
  assert.ok(priority(geo, architecture).score > priority(ethics, architecture).score);
  assert.ok(priority(geo, architecture).score < priority(physics, architecture).score);
  assert.equal(draft([economicsMath, ethics]).course.id, 'ethics');
  assert.equal(priority(economicsMath, architecture).label, '기타 과목');
  assert.ok(!getCourseTags(economicsMath, architecture, []).some((tag) => tag.kind === 'internal'));
  const mathOnly = { ...architecture, recommendDomains: [], subCore: [] };
  assert.equal(draft([economicsMath, course('unknown', '미등록 과목', '교양')], mathOnly).course.id, 'econ-math');
  assert.equal(draft([course('unknown', '미등록 과목', '교양'), economicsMath], mathOnly).course.id, 'unknown', 'no related-math fallback bonus');
  for (const name of ['경제학과', '경영학과', '무역학과', '국제통상학과']) {
    const profile = findPriorityProfile(name).profile;
    assert.equal(allowsDomainRecommendation('경제 수학', profile), true);
    assert.ok(getCourseTags(economicsMath, profile, []).some((tag) => ['core', 'sub-core'].includes(tag.kind)));
  }
  assert.equal(allowsDomainRecommendation('경제수학', findPriorityProfile('기계공학과').profile), false);
  assert.equal(draft([economicsMath]).course.id, 'econ-math', 'deprioritization is not a selection ban');
});

test('batched course tags preserve per-course results and refresh after selection changes', async (t) => {
  const { createCourseTagger, getCourseTags, catalogCourseFor } = await import('../app/(private)/consulting/subject-selection/_lib/course-selection-utils.ts');
  const { findPriorityProfile, findUniversityMatches } = await import('../features/subject-selection/recommendations.ts');
  const { default: curriculum } = await import('../app/(private)/consulting/subject-selection/_data/test-curriculum.ts');
  const courses = curriculum.terms.flatMap((term) => [...term.requiredCourses, ...term.selectionGroups.flatMap((group) => group.courses)]);
  const profile = findPriorityProfile('기계공학과').profile;
  const matches = findUniversityMatches('기계공학과', profile.id);
  for (const completed of [[], courses.slice(0, 20), courses]) {
    const tag = createCourseTagger(profile, matches, completed);
    for (const item of courses) assert.deepEqual(tag(item), getCourseTags(item, profile, matches, [], completed));
  }
  assert.equal(catalogCourseFor(course('x', '미적분Ⅱ')), catalogCourseFor(course('y', '미적분 II')));
  if (process.env.SUBJECT_TAG_BENCHMARK !== '1') return;
  const measure = (batch) => {
    const start = performance.now();
    for (let run = 0; run < 20; run++) {
      const tag = batch ? createCourseTagger(profile, matches, courses) : (item) => getCourseTags(item, profile, matches, [], courses);
      courses.forEach(tag);
    }
    return performance.now() - start;
  };
  t.diagnostic(`tag calculation, ${courses.length} courses x20: per-course ${measure(false).toFixed(1)}ms; batched ${measure(true).toFixed(1)}ms`);
});

test('combined draft counseling swaps only recommendations and rebuilds the candidate pool without altering fixed courses', async () => {
  const { replaceDraftCourse } = await import('../app/(private)/consulting/subject-selection/_lib/draft-counseling.ts');
  const required = course('required', '사회와 문화');
  const fixed = course('fixed', '경제');
  const first = course('first', '세계사');
  const alternative = course('alternative', '정치');
  const third = course('third', '법과 사회');
  const outside = course('outside', '윤리와 사상');
  const curriculum = { priorRequiredCourses: [], linkedRules: [], terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: [required], selectionGroups: [
    { id: 'one', name: '선택', choose: 2, courses: [fixed, first, alternative, third] },
    { id: 'two', name: '다른 선택군', choose: 0, courses: [outside] },
  ] }] };
  const initial = buildStandardDraft(curriculum, ['fixed'], null);
  const snapshot = structuredClone(initial);
  const swapped = replaceDraftCourse(curriculum, ['fixed'], initial, 'first', 'alternative');
  assert.equal(swapped.problem, null);
  assert.deepEqual(swapped.terms[0].recommendedCourses.map((item) => item.course.id), ['alternative']);
  assert.deepEqual(swapped.terms[0].confirmedCourses.map((item) => item.course.id), ['fixed']);
  assert.deepEqual(swapped.terms[0].requiredCourses, [required]);
  assert.ok(swapped.terms[0].unselectedGroups[0].courses.some((item) => item.course.id === 'first'));
  assert.ok(!swapped.terms[0].unselectedGroups[0].courses.some((item) => item.course.id === 'alternative'));
  const again = replaceDraftCourse(curriculum, ['fixed'], swapped.terms, 'alternative', 'third');
  assert.equal(again.problem, null);
  assert.equal(again.terms[0].recommendedCourses[0].course.id, 'third');
  assert.deepEqual(initial, snapshot, 'history remains immutable for undo');
  for (const [from, to] of [['fixed', 'alternative'], ['required', 'alternative'], ['first', 'fixed'], ['first', 'outside']]) {
    const rejected = replaceDraftCourse(curriculum, ['fixed'], initial, from, to);
    assert.ok(rejected.problem);
    assert.equal(rejected.terms, initial);
  }
});

test('humanities relationships recognize academic connections without shared course quotas', async () => {
  const { humanitiesRelationship } = await import('../features/subject-selection/humanities-relationships.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { evaluateMajorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const { screenMajorReview } = await import('../app/(private)/consulting/subject-selection/_lib/major-review-screening.ts');
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const get = (name) => findPriorityProfile(name).profile;
  for (const [first, second] of [['경영학과', '영어영문학과'], ['경영학과', '사회학과'], ['사회학과', '영어영문학과']]) {
    // Isolate the thematic route from additional individually recommended courses.
    const primary = { ...get(first), recommendCourses: [] };
    const secondary = { ...get(second), recommendCourses: [] };
    assert.ok(humanitiesRelationship(primary, secondary), first + second);
    assert.equal(humanitiesRelationship(primary, secondary), humanitiesRelationship(secondary, primary));
    const names = [...new Set([...primary.core, ...primary.subCore, ...secondary.core, ...secondary.subCore])];
    const courses = names.map((name, index) => course(`h${index}`, name));
    const fixture = { priorRequiredCourses: [], linkedRules: [], terms: [{ id: 'grade-2-semester-1', label: '2-1', requiredCourses: courses, selectionGroups: [] }] };
    const depth = evaluateMajorDepth(primary, secondary, courses, courses);
    assert.ok(depth.shared.length < 2, 'must exercise the thematic route, not the shared-course route');
    assert.equal(depth.supported, true);
    assert.equal(screenMajorReview(fixture, primary, secondary).worthReviewing, true);
    assert.equal(buildCombinedMajorDraft(fixture, [], primary, secondary).status, 'both');
    const onlyCores = courses.filter((item) => [...primary.core, ...secondary.core].includes(item.name));
    assert.equal(evaluateMajorDepth(primary, secondary, courses, onlyCores).supported, false, 'connection does not waive preparation');
    assert.equal(evaluateMajorDepth(primary, secondary, courses, courses.filter((item) => !primary.subCore.includes(item.name))).supported, false, 'protect primary preparation');
    const limited = { ...fixture, terms: [{ ...fixture.terms[0], requiredCourses: onlyCores, selectionGroups: [{ id: 'limited', name: '선택', choose: 1, courses: courses.filter((item) => !onlyCores.includes(item)) }] }] };
    assert.equal(screenMajorReview(limited, primary, secondary).worthReviewing, true);
    assert.equal(buildCombinedMajorDraft(limited, [], primary, secondary).status, 'review', 'capacity shortages remain a review, not academic rejection');
    const missing = { ...fixture, terms: [{ ...fixture.terms[0], requiredCourses: courses.filter((item) => item.name !== secondary.core[0]) }] };
    assert.equal(screenMajorReview(missing, primary, secondary).worthReviewing, false, 'unavailable cores still need attention');
  }
  for (const [first, second] of [['데이터과학과', '국어국문학과'], ['에너지공학과', '행정학과'], ['경영학과', '국어국문학과']]) {
    assert.equal(humanitiesRelationship(get(first), get(second)), null, 'no blanket humanities or interdisciplinary exemption');
  }
});

test('method relationships admit data psychology but not arbitrary data or engineering combinations', async () => {
  const { majorMethodRelationship, methodRelationshipStatus } = await import('../features/subject-selection/major-relationships.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { screenMajorReview } = await import('../app/(private)/consulting/subject-selection/_lib/major-review-screening.ts');
  const { evaluateMajorDepth } = await import('../app/(private)/consulting/subject-selection/_lib/major-depth.ts');
  const get = (name) => findPriorityProfile(name).profile;
  const data = get('데이터과학과');
  const psych = get('심리학과');
  const names = ['미적분 II', '기하', '정보', '인공지능 수학', '데이터 과학', '사회와 문화', '확률과 통계', '인간과 심리', '실용 통계'];
  const courses = names.map((name, index) => course(`method-${index}`, name));
  const fixture = { priorRequiredCourses: [], terms: [{ requiredCourses: courses, selectionGroups: [] }] };
  assert.equal(majorMethodRelationship(data, psych).id, 'data-psychology');
  assert.equal(majorMethodRelationship(psych, data).id, 'data-psychology');
  assert.equal(majorMethodRelationship(data, get('행정학과')).id, 'data-administration');
  assert.equal(majorMethodRelationship(data, get('법학과')), null);
  assert.equal(majorMethodRelationship(get('컴퓨터공학과'), psych), null);
  assert.equal(majorMethodRelationship(data, get('국어국문학과')), null);
  assert.equal(majorMethodRelationship(get('에너지공학과'), get('행정학과')), null);
  const depth = evaluateMajorDepth(data, psych, courses, courses);
  assert.equal(depth.shared.length, 0);
  assert.equal(depth.supported, true);
  assert.equal(screenMajorReview(fixture, data, psych).worthReviewing, true);
  assert.equal(evaluateMajorDepth(data, psych, courses, courses.filter((item) => item.name !== '인간과 심리')).supported, false);
  assert.equal(methodRelationshipStatus(data, psych, courses.filter((item) => item.name !== '데이터 과학')).satisfied, true);
  assert.equal(methodRelationshipStatus(data, psych, courses.filter((item) => !['데이터 과학', '확률과 통계'].includes(item.name))).satisfied, false);
  assert.equal(screenMajorReview(fixture, data, get('국어국문학과')).worthReviewing, false);
});

test('combined data psychology draft remains reviewable when method courses need fixed-slot changes', async () => {
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const { findConfirmedAdjustment, validateConfirmedAdjustment } = await import('../app/(private)/consulting/subject-selection/_lib/confirmed-adjustment.ts');
  const primary = findPriorityProfile('데이터과학과').profile;
  const secondary = findPriorityProfile('심리학과').profile;
  const required = ['미적분 II', '기하', '정보', '인공지능 수학', '데이터 과학', '사회와 문화', '확률과 통계', '실용 통계'].map((name, index) => course(`r${index}`, name));
  const fixture = { priorRequiredCourses: [], linkedRules: [], terms: [{ id: 'grade-3-semester-1', label: '3-1', requiredCourses: required, selectionGroups: [{ id: 'one', name: '선택', choose: 1, courses: [course('keep', '경제'), course('psych', '인간과 심리')] }] }] };
  const blocked = buildCombinedMajorDraft(fixture, ['keep'], primary, secondary);
  assert.equal(blocked.status, 'review');
  const available = buildCombinedMajorDraft(fixture, [], primary, secondary);
  assert.equal(available.status, 'both');
  const withoutStatistics = { ...fixture, terms: [{ ...fixture.terms[0], requiredCourses: required.filter((item) => item.name !== '확률과 통계') }] };
  assert.notEqual(buildCombinedMajorDraft(withoutStatistics, [], primary, secondary).status, 'both');
  assert.ok(available.terms[0].recommendedCourses.some((item) => item.course.id === 'psych'));
  const adjustment = findConfirmedAdjustment(fixture, ['keep'], primary, secondary, []);
  assert.ok(adjustment.proposal);
  assert.equal(adjustment.proposal.result.status, 'both');
  assert.deepEqual(adjustment.proposal.nextIds, ['psych']);
  assert.equal(validateConfirmedAdjustment(fixture, ['keep'], primary, adjustment.proposal), null);
});
test('major review screening separates distant pairs from shared science foundations without changing selections', async () => {
  const { screenMajorReview } = await import('../app/(private)/consulting/subject-selection/_lib/major-review-screening.ts');
  const { findPriorityProfile } = await import('../features/subject-selection/recommendations.ts');
  const { default: data } = await import('../app/(private)/consulting/subject-selection/_data/test-curriculum.ts');
  const get = (name) => findPriorityProfile(name).profile;
  const snapshot = JSON.stringify(data);
  const distant = screenMajorReview(data, get('도시공학과'), get('국어국문학과'));
  assert.equal(distant.worthReviewing, false);
  assert.ok(distant.reasons.length);
  const related = screenMajorReview(data, get('에너지공학과'), get('생명과학과'));
  assert.equal(related.worthReviewing, true);
  assert.ok(related.sharedNames.length >= 2);
  const absent = screenMajorReview({ ...data, priorRequiredCourses: [], terms: [] }, get('에너지공학과'), get('생명과학과'));
  assert.equal(absent.worthReviewing, false);
  assert.ok(absent.reasons.some((reason) => reason.includes('확보하기 어려운 코어')));
  assert.equal(JSON.stringify(data), snapshot);
});
test('Yonsei autonomous general science hides candidate tags after one course without inventing a public requirement', async () => {
  const { getCourseTags } = await import('../app/(private)/consulting/subject-selection/_lib/course-selection-utils.ts');
  const { universityRuleStatus } = await import('../features/subject-selection/university-status.ts');
  const { findUniversityMatches } = await import('../features/subject-selection/recommendations.ts');
  const biology = course('bio', '생명과학', '과학');
  for (const department of ['도시공학과', '컴퓨터공학과']) {
    const match = findUniversityMatches(department, null).find((item) => item.university === '연세대');
    assert.ok(match);
    const general = match.rules.find((rule) => rule.domain === '과학' && rule.selectionType === 'general');
    assert.equal(general.choose, undefined);
    assert.equal(general.note, '과학 일반선택 자율선택');
    const tags = (courses) => getCourseTags(biology, null, [match], [], courses);
    assert.equal(universityRuleStatus(general, []).target, 0);
    assert.equal(universityRuleStatus(general, []).satisfied, true);
    assert.ok(tags([]).some((tag) => tag.label === '연세대 권장 후보'));
    assert.equal(tags([course('physics', '물리학', '과학')]).length, 0);
    assert.equal(tags([biology]).length, 0);
    assert.ok(match.rules.some((rule) => !universityRuleStatus(rule, [{ name: '생명과학', domain: '과학', selectionType: 'general' }]).satisfied), 'other requirements remain unmet');
    assert.ok(tags([course('advanced', '역학과 에너지', '과학')]).length, 'career science does not satisfy general science');
    assert.ok(tags([]).length, 'removing the only general course restores candidate tags');
    assert.ok(tags(undefined).length, 'ranking membership remains stable without completion context');
  }
});
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
    fitPreference: 'similar',
    fitReason: '두 과목의 직접적인 내용 연관성에 차이를 판단할 근거가 부족함',
    alternativeInterest: '관심 분야',
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

test('question templates route dropping a selected course and adding an unselected course correctly', async () => {
  const { counselingTemplates } = await import('../app/(private)/consulting/subject-selection/_lib/counseling-question.ts');
  assert.match(counselingTemplates.find(item => item.id === 'omit').label, /이 과목 안 듣고 싶어요$/);
  assert.match(counselingTemplates.find(item => item.id === 'consider').label, /미선택 과목 중.*이 과목 듣고 싶어요$/);
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
    '현재 과목 우선 추천',
  );
  assert.match(compareAdvice(a, b, profile, 'grades', true).explanation, /부담되더라도/);
  assert.equal(compareAdvice(b, a, profile, 'grades', true).verdict, '교체 추천');
  assert.equal(compareAdvice(a, b, { ...profile, subCore: [a.name, b.name] }, 'grades', true).verdict, '둘 다 가능');
  assert.equal(swapProblem(curriculum, ['fixed'], ['a'], 'a', 'b'), null);
});
test('grade concerns allow science convergence alternatives without generalizing to all electives', () => {
  const career = course('career', '지구시스템과학', '과학');
  const convergence = course('convergence', '기후변화와 환경생태', '과학');
  for (const [from, to] of [[career, convergence], [convergence, career]]) {
    assert.match(compareAdvice(from, to, null, 'grades', false).explanation, /석차등급을 기재하지 않지만/);
    assert.doesNotMatch(compareAdvice(from, to, null, 'neutral', false).explanation, /석차등급/);
    assert.doesNotMatch(compareAdvice(from, to, { core: [], subCore: [career.name], recommendDomains: [] }, 'grades', true).explanation, /석차등급/);
  }
  assert.doesNotMatch(compareAdvice(career, course('math', '수학과제 탐구', '수학'), null, 'grades', true).explanation, /석차등급/);
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
  const result = findConfirmedAdjustment(data, ids, primary, secondary, []);
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
  const result = buildCombinedMajorDraft(curriculum, ['fixed'], first, second, ['a']);
  assert.deepEqual(result.terms[0].confirmedCourses.map(item => item.course.id), ['fixed']);
  assert.deepEqual(result.additions.map(item => item.id), ['c']);
  assert.deepEqual(result.displaced.map(item => item.id), ['a']);
  assert.equal(result.status, 'focused');
  const full = buildCombinedMajorDraft(curriculum, ['fixed', 'a'], first, second);
  assert.equal(full.status, 'review');
  assert.deepEqual(full.assessments[1].missing, ['세계사']);
  assert.equal(full.terms[0].recommendedCourses.length, 0);
});

test('combined-major preview inserts science prerequisites and reports failed choice cores', async () => {
  const { buildCombinedMajorDraft } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const data = scienceDraftFixture('지구과학', '지구시스템과학');
  const second = { ...scienceProfile, core: ['지구시스템과학'], coreChoices: [{ id: 'choice', label: '선택', courses: ['행성우주과학'], choose: 1 }] };
  const result = buildCombinedMajorDraft(data, [], scienceProfile, second);
  assert.deepEqual(result.additions.map(item => item.id), ['basic', 'advanced']);
  assert.equal(result.gaps.length, 0);
  assert.equal(result.assessments[1].choices.length, 1);
  assert.equal(result.status, 'review');
});

test('combined-major drafts use a fixed 1.5 primary weighting', async () => {
  const { buildCombinedMajorDraft, PRIMARY_MAJOR_WEIGHT } = await import('../app/(private)/consulting/subject-selection/_lib/combined-major.ts');
  const first = { ...scienceProfile, subCore: [], recommendCourses: ['경제'], recommendDomains: [] };
  const second = { ...scienceProfile, subCore: ['정치'], recommendDomains: [] };
  assert.equal(PRIMARY_MAJOR_WEIGHT, 1.5);
  const snapshot = JSON.stringify(curriculum);
  const result = buildCombinedMajorDraft(curriculum, ['fixed'], first, second);
  assert.equal(result.terms[0].recommendedCourses[0].course.id, 'b');
  assert.ok(result.terms[0].confirmedCourses.some((item) => item.course.id === 'fixed'));
  assert.equal(JSON.stringify(curriculum), snapshot);
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
