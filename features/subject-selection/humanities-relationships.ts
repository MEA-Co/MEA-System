import type { PriorityProfile, PriorityProfileId } from './recommendations';

type HumanitiesRelationship = {
  id: string;
  profiles: readonly [PriorityProfileId, PriorityProfileId];
  label: string;
  reason: string;
  independentStudy: string;
  languageDepartment?: string;
};

// Internal review routes, not admissions requirements or proof of a student's interests.
export const HUMANITIES_RELATIONSHIPS: readonly HumanitiesRelationship[] = [
  {
    id: 'business-society',
    profiles: ['business-global', 'sociology'],
    label: '조직·시장·소비와 사회',
    reason:
      '조직·노동·소비·시장을 기업의 의사결정과 사회 구조 양쪽 관점에서 탐구할 수 있어요.',
    independentStudy:
      '기업 활용 사례뿐 아니라 사회 구조·불평등·사회문제 자체의 탐구도 준비해야 해요.',
  },
  {
    id: 'language-society',
    profiles: ['language', 'sociology'],
    label: '언어·문학·문화와 사회',
    reason:
      '문화·정체성·담론을 문학·언어와 사회의 관점에서 함께 탐구할 수 있어요.',
    independentStudy:
      '문화에 대한 관심만으로 대신하지 않고 문학 작품·언어 탐구와 사회 분석을 각각 준비해야 해요.',
  },
  {
    id: 'business-english',
    profiles: ['business-global', 'language'],
    languageDepartment: '영어영문학과',
    label: '경영·국제 활동과 영미 언어·문화',
    reason:
      '문화적 맥락과 소통을 경영의 관점과 영미 언어·문학의 관점에서 함께 살펴볼 수 있어요.',
    independentStudy:
      '업무용 영어 능력만이 목적이라면 영문학 병행 근거로 보지 않아요. 영미 문학·언어 자체의 학습 의향과 준비가 필요해요.',
  },
  {
    id: 'economy-business',
    profiles: ['economics', 'business-global'],
    label: '경제 현상과 기업·국제 거래',
    reason:
      '시장과 자원 배분, 기업의 의사결정을 서로 다른 관점에서 탐구할 수 있어요.',
    independentStudy:
      '경제의 분석 기반과 경영·무역의 관심 분야를 각각 준비해야 해요.',
  },
  {
    id: 'politics-society',
    profiles: ['politics-law', 'sociology'],
    label: '사회 문제와 제도·정책',
    reason: '사회 구조와 문제를 제도·정책·권리의 관점과 함께 탐구할 수 있어요.',
    independentStudy:
      '정책 사례 소개에 그치지 않고 사회 분석과 정치·행정·법의 학습 기반을 각각 준비해야 해요.',
  },
  {
    id: 'history-language',
    profiles: ['history', 'language'],
    label: '역사적 맥락과 언어·문학',
    reason:
      '시대와 사회의 변화 속에서 언어·문학과 역사 자료를 함께 탐구할 수 있어요.',
    independentStudy:
      '작품의 시대 배경만 다루기보다 문학·언어 분석과 역사 탐구를 각각 준비해야 해요.',
  },
  {
    id: 'media-society',
    profiles: ['media', 'sociology'],
    label: '매체·소통과 사회',
    reason:
      '미디어·광고·여론이 사회와 개인에게 미치는 영향을 함께 탐구할 수 있어요.',
    independentStudy:
      '콘텐츠 제작뿐 아니라 사회 현상에 대한 분석도 준비해야 해요.',
  },
];

export function humanitiesRelationship(
  primary: PriorityProfile,
  secondary: PriorityProfile,
) {
  return (
    HUMANITIES_RELATIONSHIPS.find((rule) => {
      const [first, second] = rule.profiles;
      const matches =
        (primary.id === first && secondary.id === second) ||
        (primary.id === second && secondary.id === first);
      const language = primary.id === 'language' ? primary : secondary;
      return (
        matches &&
        (!rule.languageDepartment ||
          language.matchedDepartment === rule.languageDepartment)
      );
    }) ?? null
  );
}
