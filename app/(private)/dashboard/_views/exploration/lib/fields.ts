export const groups = [
  {
    title: '기본 정보',
    description: '탐구 주제와 생활기록부에 기재할 영역을 입력해 주세요.',
    fields: [
      {
        key: 'topic',
        label: '주제',
        placeholder: '탐구활동의 주제를 입력해 주세요',
        required: true,
      },
      { key: 'grade', label: '기재 영역 · 학년', placeholder: '예: 2학년' },
      { key: 'semester', label: '기재 영역 · 학기', placeholder: '예: 1학기' },
      {
        key: 'recordType',
        label: '기재 영역 · 창체 또는 세특',
        placeholder: '예: 창체, 세특',
      },
      {
        key: 'recordArea',
        label: '기재 영역 · 활동 영역 또는 교과명',
        placeholder: '예: 자율자치, 동아리, 진로, 화학Ⅰ',
      },
      {
        key: 'competencies',
        label: '역량',
        placeholder: '예: 비판적 사고력, 자료 분석력',
      },
    ],
  },
  {
    title: '활동 내용',
    description: '세특 원문과 탐구 과정에서 드러난 생각을 기록해 주세요.',
    fields: [
      {
        key: 'record',
        label: '세특 원문',
        placeholder: '세특 원문을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'story',
        label: '스토리',
        placeholder:
          '챌린지 극복 과정, 활동을 우수하게 만들기 위한 모든 생각과 고민 과정을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'motivation',
        label: '포지셔닝 · 계기',
        placeholder:
          '이 탐구활동을 시작하게 된 계기와 이전 활동과의 연결을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'followup',
        label: '포지셔닝 · 후속 연계 활동',
        placeholder: '탐구 이후 이어갈 활동을 입력해 주세요',
        multiline: true,
      },
    ],
  },
  {
    title: '탐구 유형과 참고자료',
    description: '탐구 방식과 참고자료, 활동에 대한 진단을 정리해 주세요.',
    fields: [
      {
        key: 'inquiryType',
        label: '탐구 유형',
        placeholder: '예: 이론형, 사례응용형, 가치관형 등 택일',
      },
      {
        key: 'inquirySubtype',
        label: '탐구 세부 유형',
        placeholder:
          '예: 프로토타입 제작형, 실험형, 사례 비교형, 데이터 활용형, 문제 해결·정책 제언형, 인터뷰형 등',
      },
      {
        key: 'references',
        label: '참고자료와 각각의 활용 방안',
        placeholder:
          '자료명 또는 링크와 해당 자료를 어떻게 활용했는지 입력해 주세요',
        multiline: true,
      },
      {
        key: 'selfAssessment',
        label: '자가 진단',
        placeholder:
          '탐구의 강점과 부족한 점, 대입에 영향을 미쳤다고 생각하는 요소 등을 입력해 주세요',
        multiline: true,
      },
    ],
  },
] satisfies {
  title: string;
  description: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
  }[];
}[];

type FieldKey = (typeof groups)[number]['fields'][number]['key'];
export type Activity = { clientKey: number; values: Record<FieldKey, string> };
export const emptyValues = () =>
  Object.fromEntries(
    groups.flatMap((group) => group.fields.map((field) => [field.key, ''])),
  ) as Activity['values'];
