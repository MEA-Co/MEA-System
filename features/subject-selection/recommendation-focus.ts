import type { PriorityProfile, PriorityProfileId } from './recommendations';

type Preference = NonNullable<PriorityProfile['withinTierPreferences']>[number];
const preference = (courses: string[], reason: string): Preference => ({
  courses,
  reason,
});

// MEA's default educational relevance policy, not university admission requirements.
const profilePreferences: Partial<Record<PriorityProfileId, Preference>> = {
  math: preference(
    ['확률과 통계', '실용 통계', '인공지능 수학', '수학과제 탐구'],
    '수학적 모델링·추론·통계 탐구와 직접 연결됩니다.',
  ),
  'math-computing': preference(
    ['확률과 통계', '실용 통계', '데이터 과학', '인공지능 수학'],
    '데이터 분석과 통계적 추론의 기초를 우선합니다.',
  ),
  'computing-engineering': preference(
    ['확률과 통계', '실용 통계', '데이터 과학', '인공지능 수학'],
    '알고리즘·데이터 분석·최적화 탐구와 연결됩니다.',
  ),
  'physics-chemistry': preference(
    ['물질과 에너지', '화학 반응의 세계', '수학과제 탐구'],
    '물리 기반 현상을 재료·에너지·수학적 모델로 확장합니다.',
  ),
  'physics-earth': preference(
    ['지구시스템과학', '기후변화와 환경생태', '물질과 에너지'],
    '구조물·해양·생활환경의 물리적 조건과 연결됩니다.',
  ),
  'physics-chemistry-combined': preference(
    ['데이터 과학', '수학과제 탐구', '기후변화와 환경생태'],
    '재료·에너지 분야의 분석 및 환경 문제 탐구로 확장합니다.',
  ),
  'physics-earth-combined': preference(
    ['수학과제 탐구', '데이터 과학'],
    '물리·지구 현상의 수학적 모델링과 관측 자료 분석에 연결됩니다.',
  ),
  chemistry: preference(
    ['세포와 물질대사', '역학과 에너지', '융합과학 탐구'],
    '분자 수준의 변화·에너지·실험 탐구로 확장합니다.',
  ),
  biology: preference(
    ['물질과 에너지', '화학 반응의 세계', '확률과 통계', '실용 통계'],
    '생명 현상의 화학적 원리와 실험 데이터 해석을 우선합니다.',
  ),
  earth: preference(
    ['기후변화와 환경생태', '역학과 에너지', '데이터 과학'],
    '지구 환경의 변화와 관측 자료 해석에 연결됩니다.',
  ),
  'bio-engineering': preference(
    ['데이터 과학', '확률과 통계', '실용 통계', '융합과학 탐구'],
    '생명·식품 실험의 데이터 분석과 응용 탐구를 우선합니다.',
  ),
  'environmental-engineering': preference(
    ['지구시스템과학', '기후변화와 환경생태', '데이터 과학'],
    '환경 시스템·기후·측정 자료 분석과 직접 연결됩니다.',
  ),
  language: preference(
    ['문학과 영상', '세계사', '동아시아 역사 기행', '사회와 문화'],
    '언어·문학을 문화적·역사적 맥락에서 이해하는 과목을 우선합니다.',
  ),
  history: preference(
    ['세계시민과 지리', '한국지리 탐구', '정치', '사회와 문화'],
    '역사적 사건의 공간·제도·사회적 맥락을 보완합니다.',
  ),
  philosophy: preference(
    ['현대사회와 윤리', '윤리문제 탐구', '윤리와 사상'],
    '철학적 논증과 윤리적 판단을 실제 문제에 적용합니다.',
  ),
  'politics-law': preference(
    ['사회문제 탐구', '경제', '현대사회와 윤리'],
    '공공 문제·제도·정책의 근거와 영향을 탐구합니다.',
  ),
  economics: preference(
    ['사회와 문화', '사회문제 탐구', '정치'],
    '경제 현상을 사회구조·정책과 함께 해석합니다.',
  ),
  'business-global': preference(
    ['확률과 통계', '실용 통계', '금융과 경제생활', '사회와 문화'],
    '시장·조직·국제 거래를 데이터와 사회적 맥락에서 이해합니다.',
  ),
  sociology: preference(
    ['정치', '경제', '인간과 심리', '현대사회와 윤리'],
    '사회구조와 제도·행동·불평등 문제를 보완합니다.',
  ),
  psychology: preference(
    ['세포와 물질대사', '사회문제 탐구', '현대사회와 윤리'],
    '인간 행동의 생물학적 기반과 사회적·윤리적 맥락을 우선합니다.',
  ),
  media: preference(
    ['사회문제 탐구', '정치', '인간과 심리', '데이터 과학'],
    '미디어의 사회적 영향·수용자·정보 분석에 연결됩니다.',
  ),
};

const departmentPreferences: Record<string, Preference> = {
  도시공학과: preference(
    [
      '세계시민과 지리',
      '한국지리 탐구',
      '도시의 미래 탐구',
      '기후변화와 환경생태',
    ],
    '도시 공간·지역 문제·환경 계획과 직접 연결됩니다.',
  ),
  건설환경공학과: preference(
    ['지구시스템과학', '기후변화와 환경생태', '물질과 에너지'],
    '지반·환경·건설 재료의 특성과 연결됩니다.',
  ),
  지리학과: preference(
    ['세계시민과 지리', '한국지리 탐구', '도시의 미래 탐구'],
    '자연환경뿐 아니라 지역·공간·인간 활동을 함께 탐구합니다.',
  ),
  산업공학과: preference(
    ['확률과 통계', '실용 통계', '경제', '경제수학'],
    '최적화·품질관리·의사결정의 수리적 분석과 연결됩니다.',
  ),
  영어영문학과: preference(
    ['영미 문학 읽기', '영어 독해와 작문', '세계사', '사회와 문화'],
    '영어 텍스트의 해석과 문화·사회적 맥락을 우선합니다.',
  ),
  광고홍보학과: preference(
    ['사회문제 탐구', '데이터 과학', '독서 토론과 글쓰기'],
    '수용자 분석·사회적 맥락·메시지 구성을 보완합니다.',
  ),
};

export function recommendationFocus(
  profile: PriorityProfile,
  department: string,
): Partial<PriorityProfile> {
  const focus =
    departmentPreferences[department] ?? profilePreferences[profile.id];
  const explicit: string[] = [];
  // Do not broaden the whole social-studies domain for health majors.
  const ethics =
    profile.id === 'chemistry-biology'
      ? {
          courses: ['현대사회와 윤리', '윤리문제 탐구'],
          preferCount: 1,
          reason:
            '화학·생명 기초를 확보한 뒤 환자·생명·의료 의사결정의 윤리적 판단을 보완합니다.',
        }
      : undefined;
  if (ethics) explicit.push(...ethics.courses);
  if (
    [
      'math-computing',
      'computing-engineering',
      'psychology',
      'biology',
      'bio-engineering',
    ].includes(profile.id)
  )
    explicit.push('확률과 통계', '실용 통계');
  if (['math-computing', 'computing-engineering'].includes(profile.id))
    explicit.push('수학과제 탐구');
  if (['도시공학과', '지리학과'].includes(department))
    explicit.push('세계시민과 지리', '한국지리 탐구', '도시의 미래 탐구');
  if (department === '산업공학과') explicit.push('경제', '경제수학');
  return {
    recommendCourses: [
      ...new Set([...(profile.recommendCourses ?? []), ...explicit]),
    ],
    breadthCourses: [
      ...new Set([
        ...(profile.breadthCourses ?? []),
        ...explicit.filter((name) => !profile.recommendCourses?.includes(name)),
      ]),
    ],
    withinTierPreferences: [
      ...(profile.withinTierPreferences ?? []),
      ...(focus ? [focus] : []),
    ],
    draftRecommendationGroups: [
      ...(profile.draftRecommendationGroups ?? []),
      ...(ethics ? [ethics] : []),
    ],
  };
}
