import { normalizeCourseName, type PriorityProfile } from './recommendations';

// Internal counseling policy, not a claim about university admissions requirements.
const methods = ['확률과 통계', '인공지능 수학', '데이터 과학'];
export const MAJOR_METHOD_RELATIONSHIPS = [
  {
    id: 'data-psychology',
    first: ['데이터과학과', '통계학과'],
    second: ['심리학과', '상담심리학과'],
    label: '통계·행동 데이터 연구 방법 공유',
    reason:
      '통계적 분석과 심리학의 설문·실험·행동 연구를 함께 준비하는 조합으로 검토합니다.',
    groups: [
      { label: '통계·데이터 분석 기반', courses: methods, choose: 2 },
      {
        label: '심리학 자체의 학습 기반',
        courses: ['사회와 문화', '인간과 심리'],
        choose: 2,
      },
    ],
  },
  {
    id: 'data-administration',
    first: ['데이터과학과', '통계학과'],
    second: ['행정학과'],
    label: '정책 평가·공공데이터 분석 조건부 연계',
    reason:
      '정책 평가·공공데이터 분석을 준비하는 방향에 한해 검토합니다. 분석 도구뿐 아니라 정치·법과 사회 및 행정 관련 보완 학습도 확보해야 합니다.',
    groups: [
      { label: '통계·데이터 분석 기반', courses: methods, choose: 2 },
      {
        label: '정책·사회 탐구 기반',
        courses: ['정치', '법과 사회', '사회와 문화'],
        choose: 3,
      },
    ],
  },
] as const;

export function majorMethodRelationship(
  primary: PriorityProfile,
  secondary: PriorityProfile,
) {
  const name = (profile: PriorityProfile) =>
    profile.matchedDepartment ??
    (profile.departments?.length === 1 ? profile.departments[0] : '');
  const a = name(primary);
  const b = name(secondary);
  return (
    MAJOR_METHOD_RELATIONSHIPS.find(
      (rule) =>
        (rule.first.some((item) => item === a) &&
          rule.second.some((item) => item === b)) ||
        (rule.first.some((item) => item === b) &&
          rule.second.some((item) => item === a)),
    ) ?? null
  );
}

export function methodRelationshipStatus(
  primary: PriorityProfile,
  secondary: PriorityProfile,
  courses: readonly { name: string }[],
) {
  const relationship = majorMethodRelationship(primary, secondary);
  const selected = new Set(
    courses.map((course) => normalizeCourseName(course.name)),
  );
  const groups =
    relationship?.groups.map((group) => ({
      ...group,
      count: group.courses.filter((name) =>
        selected.has(normalizeCourseName(name)),
      ).length,
    })) ?? [];
  return {
    relationship,
    groups,
    satisfied:
      !!relationship && groups.every((group) => group.count >= group.choose),
  };
}
