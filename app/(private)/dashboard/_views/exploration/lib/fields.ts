export const gradeOptions = ['1', '2', '3'];
export const semesterOptions = ['1', '2'];
export const recordTypeOptions = ['창체', '세특'];
export const creativeActivityOptions = [
  '자율·자치활동',
  '동아리활동',
  '진로활동',
];

export const groups = [
  {
    title: '기본 정보',
    description: '탐구 주제와 생활기록부에 기재할 영역을 입력해 주세요.',
    fields: [
      {
        key: 'topic',
        label: '주제',
        placeholder:
          '탐구 소재와 탐구 방법이 잘 드러나는 한 문장으로 작성해 주세요',
        required: true,
      },
      { key: 'grade', label: '기재 영역 · 학년', placeholder: '학년 선택' },
      { key: 'semester', label: '기재 영역 · 학기', placeholder: '학기 선택' },
      {
        key: 'recordType',
        label: '기재 영역 · 창체 또는 세특',
        placeholder: '기재 유형 선택',
      },
      {
        key: 'recordArea',
        label: '기재 영역 · 활동 영역 또는 교과명',
        placeholder: '활동 영역 선택 또는 과목명 입력',
      },
    ],
  },
  {
    title: '활동 내용',
    description: '탐구 요약과 탐구 과정에서 드러난 생각을 기록해 주세요.',
    fields: [
      {
        key: 'record',
        label: '탐구 요약',
        placeholder: '탐구 요약을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'story',
        label: '스토리',
        placeholder:
          '탐구 과정에서 어려웠던 부분을 극복한 과정, 활동을 우수하게 만들기 위한 모든 생각과 고민 과정을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'motivation',
        label: '포지셔닝 · 계기',
        placeholder:
          '이 탐구활동을 시작하게 된 계기 또는 이전 활동과의 연계 포인트를 입력해주세요',
        multiline: true,
      },
      {
        key: 'followup',
        label: '포지셔닝 · 후속 연계 활동',
        placeholder: '탐구 이후 후속 연계한 활동을 입력해 주세요',
        multiline: true,
      },
      {
        key: 'competencies',
        label: '역량',
        placeholder: '역량을 하나씩 입력해 주세요',
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
        placeholder: '탐구 유형 선택',
        options: ['이론형', '사례/응용형', '가치판단형'],
      },
      {
        key: 'inquirySubtype',
        label: '탐구 방법론 (다중 선택)',
        placeholder: '탐구 방법론 선택',
        options: [
          '실험',
          '독서(문헌)',
          '제작',
          '데이터 분석',
          '설문, 인터뷰',
          '모델링, 시뮬레이션',
          '개념분석, 논증',
          '사례연구,비교',
        ],
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
] as const satisfies {
  title: string;
  description: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    required?: boolean;
    multiline?: boolean;
    options?: string[];
  }[];
}[];

type FieldKey = (typeof groups)[number]['fields'][number]['key'];
export type ActivityReference = {
  clientKey: string;
  title: string;
  link: string;
  usage: string;
};
export type Activity = {
  clientKey: number;
  values: Record<Exclude<FieldKey, 'references'>, string> & {
    references: ActivityReference[];
  };
};
export const emptyValues = (): Activity['values'] => ({
  topic: '',
  grade: '',
  semester: '',
  recordType: '',
  recordArea: '',
  record: '',
  story: '',
  motivation: '',
  followup: '',
  competencies: '',
  inquiryType: '',
  inquirySubtype: '',
  references: [],
  selfAssessment: '',
});
