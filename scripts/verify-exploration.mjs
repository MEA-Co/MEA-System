import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCoreValueDraft,
  createEmptyGoal,
  createMajorFieldStrengthDraft,
  createPureFieldStrengthDraft,
  enforceGoalReadiness,
  shouldResearchIssues,
} from '../features/exploration/domain.ts';
import { DEPARTMENT_MAPPER_INSTRUCTIONS } from '../features/exploration/prompts/department-mapper.ts';
import { EXPLORATION_COACH_INSTRUCTIONS } from '../features/exploration/prompts/exploration-coach.ts';
import { GOAL_EVALUATOR_INSTRUCTIONS } from '../features/exploration/prompts/goal-evaluator.ts';
import { DepartmentMapSchema } from '../features/exploration/schemas/exploration.ts';

const clearSlot = (value, ownership = 'student_explicit') => ({
  value,
  status: 'clear',
  ownership,
  reason: '학생이 명확히 선택했습니다.',
});

const completeGoal = () => ({
  keyword: clearSlot('태양광 발전'),
  problem: clearSlot('재료에 따라 발전 효율이 달라지는 이유'),
  aspect: clearSlot('재료별 에너지 변환 효율'),
  method: clearSlot('공개된 연구·실험 데이터를 같은 기준으로 비교'),
  ready: true,
  nextTarget: 'done',
  coherenceIssue: null,
  feasibilityIssue: null,
});

test('키워드만 있는 초기 목표는 준비 상태가 아니다', () => {
  const goal = createEmptyGoal();
  goal.keyword = clearSlot('에너지 효율');

  assert.equal(goal.ready, false);
  assert.equal(goal.nextTarget, 'keyword');
});

test('코치가 제안했지만 학생이 선택하지 않은 요소는 확정하지 않는다', () => {
  const goal = completeGoal();
  goal.problem = clearSlot(
    '온도에 따른 패널 효율 저하',
    'assistant_suggested',
  );

  const checked = enforceGoalReadiness(goal);
  assert.equal(checked.ready, false);
  assert.equal(checked.nextTarget, 'problem');
});

test('학생이 확인한 코치 제안은 학생 소유 선택으로 인정한다', () => {
  const goal = completeGoal();
  goal.problem = clearSlot(
    '온도에 따른 패널 효율 저하',
    'student_confirmed',
  );

  assert.equal(enforceGoalReadiness(goal).ready, true);
});

test('method가 없으면 나머지 세 요소가 있어도 준비 상태가 아니다', () => {
  const goal = completeGoal();
  goal.method = {
    value: null,
    status: 'missing',
    ownership: 'none',
    reason: '탐구 방법이 없습니다.',
  };

  const checked = enforceGoalReadiness(goal);
  assert.equal(checked.ready, false);
  assert.equal(checked.nextTarget, 'method');
});

test('problem과 method의 연결 문제가 있으면 준비 상태가 아니다', () => {
  const goal = completeGoal();
  goal.coherenceIssue =
    '배터리 종류 조사는 태양광 발전 효율 문제에 직접 답하기 어렵습니다.';

  assert.equal(enforceGoalReadiness(goal).ready, false);
});

test('학생이 선택한 네 요소가 연결되고 실행 가능하면 준비 상태다', () => {
  assert.equal(enforceGoalReadiness(completeGoal()).ready, true);
});

test('대략적인 실험 방법론만 정해도 구조상 준비 상태로 인정한다', () => {
  const goal = completeGoal();
  goal.method = clearSlot(
    '온도 조건을 달리한 간단한 비교 실험으로 효율 변화 양상을 확인',
  );

  assert.equal(enforceGoalReadiness(goal).ready, true);
});

test('평가기와 코치는 세부 변인·지표 설계를 완료 조건으로 요구하지 않는다', () => {
  assert.match(GOAL_EVALUATOR_INSTRUCTIONS, /세부 변인과 지표/);
  assert.match(GOAL_EVALUATOR_INSTRUCTIONS, /미완성 처리하지 않는다/);
  assert.match(EXPLORATION_COACH_INSTRUCTIONS, /계속 질문하지 않는다/);
  assert.match(EXPLORATION_COACH_INSTRUCTIONS, /이 대화에서 확정할 필요가 없다/);
});

test('학과 소개는 일반 설명 뒤에 학교 맥락 예시를 배치한다', () => {
  const generalRuleIndex = DEPARTMENT_MAPPER_INSTRUCTIONS.indexOf(
    '일반적이고 통상적인 학과 설명',
  );
  const schoolExampleIndex = DEPARTMENT_MAPPER_INSTRUCTIONS.indexOf(
    'schoolContextExamples에는',
  );

  assert.ok(generalRuleIndex >= 0);
  assert.ok(schoolExampleIndex > generalRuleIndex);
  assert.match(EXPLORATION_COACH_INSTRUCTIONS, /특정 학교나 교내 활동 이야기로 시작하지 않는다/);
});

test('학과 지도는 일반 분야와 분리된 학교 맥락 예시를 포함한다', () => {
  const parsed = DepartmentMapSchema.safeParse({
    department: '산업공학과',
    overview: '사람, 정보, 기술이 함께 움직이는 시스템을 효율적으로 설계하는 학문이다.',
    fields: [
      {
        fieldName: '시스템 설계',
        explanation: '복잡한 과정의 구성 요소와 흐름을 살핀다.',
        keywords: [
          { keyword: '공정 개선', explanation: '과정의 낭비를 줄인다.', exampleTopic: null },
          { keyword: '최적화', explanation: '조건에 맞는 선택을 찾는다.', exampleTopic: null },
        ],
      },
      {
        fieldName: '데이터 분석',
        explanation: '자료에서 의사결정에 필요한 패턴을 찾는다.',
        keywords: [
          { keyword: '예측', explanation: '미래 변화를 추정한다.', exampleTopic: null },
          { keyword: '품질 관리', explanation: '결과의 차이를 분석한다.', exampleTopic: null },
        ],
      },
      {
        fieldName: '인간 중심 설계',
        explanation: '사람이 시스템을 사용하는 방식을 살핀다.',
        keywords: [
          { keyword: '인간공학', explanation: '사람에게 맞는 환경을 설계한다.', exampleTopic: null },
          { keyword: '사용자 경험', explanation: '이용 과정의 어려움을 개선한다.', exampleTopic: null },
        ],
      },
    ],
    schoolContextExamples: [
      '수학 시간에 여러 조건을 비교하는 활동으로 연결해볼 수 있다.',
      '동아리에서 교내 이동 동선을 관찰하는 탐구를 해볼 수 있다.',
    ],
  });

  assert.equal(parsed.success, true);
});

test('현재성이 의미 있는 키워드가 새로 명확해졌을 때만 조사한다', () => {
  const previousGoal = createEmptyGoal();
  const nextGoal = createEmptyGoal();
  nextGoal.keyword = clearSlot('생성형 AI의 교육 활용');
  nextGoal.nextTarget = 'problem';

  assert.equal(shouldResearchIssues(previousGoal, nextGoal), true);
  assert.equal(shouldResearchIssues(nextGoal, nextGoal), false);

  const mathGoal = createEmptyGoal();
  mathGoal.keyword = clearSlot('이차함수의 대칭성');
  assert.equal(shouldResearchIssues(previousGoal, mathGoal), false);
});

test('완성 프로필을 가치관·과목 역량·전공 역량 초안으로 분리한다', () => {
  const state = {
    department: '산업공학과',
    conversation: [],
    goal: completeGoal(),
    departmentMap: null,
    latestResearch: null,
    profile: {
      interestKeyword: {
        label: '인간 중심 시스템 설계',
        description: '사람이 이해하고 선택할 수 있는 시스템을 살핀다.',
        evidence: 'keyword',
      },
      valueOrientation: {
        label: '사용자 선택권',
        description: '효율뿐 아니라 사용자의 이해와 선택을 중요하게 본다.',
        evidence: 'aspect',
      },
      capability: {
        label: '비교·분석',
        description: '여러 자료를 같은 기준으로 비교하는 방식을 선택했다.',
        evidence: 'method',
      },
      capabilityApplication: {
        schoolSubject: '수학',
        pureFieldFitDraft:
          '수학 과목에서 자료를 같은 기준으로 구조화하고 비교하는 힘을 활용하고자 한다.',
        majorFieldFitDraft:
          '산업공학과의 시스템 문제를 데이터로 비교하고 개선점을 찾는 접근을 활용하고자 한다.',
      },
    },
  };

  assert.match(createCoreValueDraft([state]), /사용자 선택권/);
  assert.match(createPureFieldStrengthDraft([state]), /수학 과목/);
  assert.match(createMajorFieldStrengthDraft([state]), /산업공학과/);
});
