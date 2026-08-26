import type { MaterialBoxReportData } from '@/app/(private)/consulting/material-box/_report/types';

export type MaterialBoxReportSection = {
  number: string;
  eyebrow: string;
  title: string;
  content: string;
};

export type MaterialBoxReportContent = {
  careerIdentity: string;
  keyword: string;
  majors: Array<string>;
  sections: Array<MaterialBoxReportSection>;
  consultantSummary: string;
  nextSteps: Array<{
    number: string;
    title: string;
    description: string;
  }>;
};

export function createMaterialBoxReport(
  data: MaterialBoxReportData,
): MaterialBoxReportContent {
  return {
    careerIdentity: data.careerIdentity,
    keyword: data.keyword,
    majors: data.majorPreferences.map((preference) => preference.major),
    sections: [
      {
        number: '01',
        eyebrow: 'CAREER IDENTITY',
        title: '궁극적으로 그리고 있는 진로',
        content: data.careerIdentity,
      },
      {
        number: '02',
        eyebrow: 'CORE VALUE',
        title: '해결하고 싶은 문제와 핵심 가치',
        content: data.coreValue,
      },
      {
        number: '03',
        eyebrow: 'FIELD COMPETENCY',
        title: '분야에서 발휘할 강점과 역량',
        content: data.fieldStrength,
      },
      {
        number: '04',
        eyebrow: 'PERSONAL POTENTIAL',
        title: '나다운 습관과 잠재 역량',
        content: data.personalStrength,
      },
    ],
    consultantSummary: `‘${data.keyword}’에 대한 관심을 ‘${data.careerIdentity}’라는 구체적인 진로 방향으로 발전시켰습니다. 앞으로 교과 탐구와 비교과 활동에서 동일한 문제의식을 일관되게 드러내고, 학업 역량과 개인적인 장점을 실제 행동의 근거로 연결하면 자신만의 성장 서사가 더욱 선명해질 것입니다.`,
    nextSteps: [
      {
        number: '1',
        title: '탐구 질문 만들기',
        description:
          '세부 키워드와 핵심 가치가 만나는 지점에서 해결하고 싶은 문제를 한 문장의 탐구 질문으로 바꿔보세요.',
      },
      {
        number: '2',
        title: '교과 활동으로 증명하기',
        description:
          '잘하는 과목과 학습 방식을 활용한 탐구 과정을 남겨 분야 역량이 실제로 드러나게 해보세요.',
      },
      {
        number: '3',
        title: '나다운 행동 기록하기',
        description:
          '평소의 습관과 장점이 팀 활동, 발표, 조사 과정에서 어떤 역할과 행동으로 나타났는지 기록해보세요.',
      },
    ],
  };
}

export function formatMaterialBoxReportDate(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\. /g, '. ')
    .trim();
}

export const materialBoxReportFileName = 'MEA_재료함_컨설팅_리포트.pdf';
