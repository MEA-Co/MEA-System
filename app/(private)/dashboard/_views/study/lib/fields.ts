import type {
  ActivityReference,
  ActivityReport,
} from '../../exploration/lib/fields';
export type {
  ActivityReference,
  ActivityReport,
} from '../../exploration/lib/fields';
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
  { value: 'self', label: '자신이 겪은 문제 상황' },
  { value: 'student', label: '지도한 학생이 겪었던 문제 상황' },
  { value: 'template', label: '공통 문제 상황 템플릿' },
] as const;
export const groups = [
  {
    title: '기본 정보',
    fields: [
      {
        key: 'category',
        label: '시험 구분',
        placeholder: '공부법을 적용할 시험 구분을 선택해 주세요',
        required: true,
      },
      {
        key: 'subject',
        label: '과목',
        placeholder: '과목 선택',
        required: true,
      },
      {
        key: 'customSubject',
        label: '과목명',
        placeholder: '세부 과목명을 입력해 주세요',
      },
    ],
  },
  {
    title: '문제와 학습 전략',
    fields: [
      {
        key: 'problemSource',
        label: '문제 상황 유형',
        placeholder: '문제 상황 유형 선택',
        required: true,
      },
      {
        key: 'problem',
        label: '문제 상황',
        placeholder:
          '누가 어떤 학습 상황에서 어려움을 겪었는지, 반복되는 문제와 학습에 미친 영향을 구체적으로 작성해 주세요.',
        required: true,
        multiline: true,
      },
      {
        key: 'strategy',
        label: '대응 방안 (학습 전략)',
        placeholder:
          '문제를 개선하기 위해 사용할 학습 방법과 이 방법으로 바꾸려는 습관이나 능력을 작성해 주세요.',
        required: true,
        multiline: true,
      },
    ],
  },
  {
    title: '실천 계획',
    fields: [
      {
        key: 'practiceGuide',
        label: '대응 방안 실천 가이드',
        placeholder:
          '학생이 그대로 따라 할 수 있도록 실천 순서, 학습량과 빈도, 기록 방법을 구체적으로 작성해 주세요.',
        required: true,
        multiline: true,
      },
      {
        key: 'practicePeriod',
        label: '대응 방안 실천 기간',
        placeholder: '전략을 실천할 전체 기간을 작성해 주세요',
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
        placeholder:
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
      {
        key: 'resultDiagnosis',
        label: '성적 결과 후속 진단',
        placeholder:
          '시험 종료 후 전략 적용 전후의 성적과 학습 변화를 비교하고, 효과가 있었던 방법과 보완할 점을 작성해 주세요.',
        multiline: true,
        description:
          '시험 기간에 적용한 전략은 시험 종료 후 성적 상승 정도와 후속 진단을 추가할 수 있습니다.',
      },
    ],
  },
] as const;
export type FieldKey = (typeof groups)[number]['fields'][number]['key'];
export type Activity = {
  ownerId?: string;
  ownerName?: string;
  clientKey: string;
  revision: number;
  status: 'draft' | 'confirmed';
  updatedAt: string;
  localVersion?: string;
  reports?: ActivityReport[];
  values: Record<FieldKey, string> & { references: ActivityReference[] };
};
export const emptyValues = (): Activity['values'] => ({
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
  references: [],
});
export function studySummary(values: Activity['values']) {
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

/** Keep reference labels short; full strategy remains available in the detail drawer. */
export function studyTitle(values: Activity['values']) {
  const text =
    values.strategy.trim().replace(/\s+/g, ' ') ||
    studySummary(values) ||
    '공부법';
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}
