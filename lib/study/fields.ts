import type {
  ContentReference,
  ReportAttachment,
} from '@/lib/content/attachments';
export type {
  ContentReference,
  ReportAttachment,
} from '@/lib/content/attachments';
export const categoryOptions = ['내신', '모의고사(수능)', '기타'] as const;
export const subjectOptions = [
  '국어',
  '영어',
  '수학',
  '사회',
  '과학',
  '기타',
] as const;
export const problemSourceOptions = [
  { value: 'self', label: '자신 또는 지도한 학생이 겪은 문제 상황' },
  { value: 'template', label: '공통 문제 상황 템플릿' },
] as const;
// 기존 학생 경험 값은 저장 데이터를 바꾸지 않고 통합 선택지로 표시한다.
export function problemSourceDisplayValue(value: string) {
  return value === 'student' ? 'self' : value;
}
export const groups = [
  {
    title: '기본 정보',
    fields: [
      {
        key: 'title',
        label: '제목 / 이름',
        placeholder: '학습법을 알아보기 쉽게 제목이나 이름을 입력해 주세요',
        maxLength: 100,
      },
    ],
  },
  {
    title: '문제 상황',
    fields: [
      {
        key: 'problemSource',
        label: '문제 상황 출처',
        placeholder: '문제 상황 출처 선택',
        required: true,
      },
      {
        key: 'category',
        label: '학습법 적용 대상',
        placeholder: '내신/모의고사(수능)/기타 중에 선택해주세요.',
        required: true,
      },
      {
        key: 'subject',
        label: '교과',
        placeholder: '교과 선택',
        required: true,
      },
      {
        key: 'customSubject',
        label: '세부 과목명',
        placeholder: '예: 확률과 통계',
      },
      {
        key: 'problem',
        label: '문제 상황',
        placeholder: '예: 경우의 수-수형도 유형 문제에서의 잦은 실수',
        required: true,
        description: '문제 상황을 명확하게 명사형으로 작성해주세요.',
      },
    ],
  },
  {
    title: '대응 솔루션',
    fields: [
      {
        key: 'strategy',
        label: '대응 솔루션 (학습 전략)',
        placeholder:
          '예: 오답 발생 시 오답 유형을 스스로 인지하고 개선할 수 있도록 기록하는 습관 들이기',
        required: true,
        multiline: true,
      },
      {
        key: 'practiceGuide',
        label: '대응 솔루션 실천 가이드',
        description:
          '학생이 그대로 따라 할 수 있도록 무엇을, 어떤 순서로, 얼마나 자주 해야 하는지 구체적이고 명확하게 작성해 주세요. 주차별 주간·일간 세부적인 실천 사항이 있다면 기간과 함께 작성해주어도 좋습니다.',
        placeholder:
          '예: 오답 발생 시마다 A4 한장에 틀린 시간, 틀린 문제 유형, 틀린 이유를 한 줄씩 기입하면서\n(1) 오답을 인지하고 줄여야겠다는 습관을 체화함과 동시에\n(2) 자주 발생하는 오답 원인을 확인하여 개선하고\n(3) 매일 동일 문제 대비 오답 수를 한 문제씩이라도 반드시 줄여본다.',
        required: true,
        multiline: true,
      },
      {
        key: 'practicePeriod',
        label: '실천 기간',
        placeholder: '솔루션을 적용할 시점과 실천 기간을 작성해 주세요',
        required: true,
      },
    ],
  },
  {
    title: '진단과 후속 대응',
    fields: [
      {
        key: 'checklist',
        label: '기간 종료 후 목표 달성 여부 진단 체크리스트',
        placeholder: '예: 2주간 매일 동일한 문제 수 대비 오답 수가 감소했다.',
        description:
          '기간 종료 후 스스로 확인할 수 있는 항목을 하나씩 작성해 주세요. 각 항목에 목표 달성을 판단할 구체적인 기준을 포함해 주세요.',
        required: true,
        multiline: true,
      },
      {
        key: 'followup',
        label: '기간 종료 후 후속 대응 전략',
        placeholder:
          '목표를 달성했을 때 학습 효과를 유지할 방법과, 달성하지 못했을 때 보완하거나 변경할 방법을 작성해 주세요.',
        required: true,
        multiline: true,
      },
    ],
  },
] as const;
export type FieldKey = (typeof groups)[number]['fields'][number]['key'];
export type Study = {
  ownerId?: string;
  ownerName?: string;
  clientKey: string;
  revision: number;
  status: 'draft' | 'confirmed';
  updatedAt: string;
  localVersion?: string;
  reports?: ReportAttachment[];
  values: Record<FieldKey, string> & {
    // 화면에서 제거한 항목의 기존 저장 값은 유지한다.
    resultDiagnosis: string;
    problemExperience: string;
    periodEnabled: boolean;
    references: ContentReference[];
  };
};
export const emptyValues = (): Study['values'] => ({
  title: '',
  category: '',
  subject: '',
  customSubject: '',
  problemSource: '',
  problem: '',
  strategy: '',
  practiceGuide: '',
  practicePeriod: '',
  checklist: '',
  followup: '',
  resultDiagnosis: '',
  problemExperience: '',
  periodEnabled: true,
  references: [],
});
export function studySummary(values: Study['values']) {
  return [
    values.category,
    [
      values.subject === '직접 입력' ? '기타' : values.subject,
      values.customSubject.trim() ? `(${values.customSubject.trim()})` : '',
    ]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Keep reference labels short; full content remains available in the detail drawer. */
export function studyTitle(values: Study['values']) {
  const text =
    values.title?.trim().replace(/\s+/g, ' ') ||
    values.strategy.trim().replace(/\s+/g, ' ') ||
    studySummary(values) ||
    '학습법';
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}
