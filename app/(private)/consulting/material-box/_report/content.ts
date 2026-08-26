import type { ConsultingReportRequest } from '@/features/consulting/report';

export type MaterialBoxExampleReportData = {
  persona: {
    name: string;
    grade: string;
  };
  fieldMap: ReadonlyArray<{
    rank: number;
    major: string;
    systemSupport: {
      summary: string;
    };
    mentor: {
      name: string;
      affiliation: string;
      advice: string;
    };
    selectedKeywords: ReadonlyArray<string>;
  }>;
  majorStory: {
    differentiator: string;
    explanation: string;
  };
  coreValue: {
    statement: string;
    guidingQuestions: ReadonlyArray<readonly [string, string]>;
  };
  competencies: ReadonlyArray<{
    type: string;
    title: string;
    content: string;
    evidence: string;
  }>;
  oneLineBrand: string;
  schoolRecordStrategy: ReadonlyArray<{
    title: string;
    basis: ReadonlyArray<string>;
    description: string;
  }>;
  supportingValues: ReadonlyArray<{
    value: string;
    role: string;
    description: string;
  }>;
  projectRoadmap: {
    finalGoal: string;
    basis: ReadonlyArray<string>;
    steps: ReadonlyArray<{
      number: string;
      stage: string;
      title: string;
      question: string;
      deliverable: string;
    }>;
  };
  courses: ReadonlyArray<{
    course: string;
    reason: string;
  }>;
};

function formatReportDate(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/\. /g, '. ')
    .trim();
}

export function createMaterialBoxExampleReportRequest(
  report: MaterialBoxExampleReportData,
  issuedAt = new Date(),
): ConsultingReportRequest {
  const majors = report.fieldMap.map(({ major }) => major);
  const keywords = report.fieldMap.flatMap(
    ({ selectedKeywords }) => selectedKeywords,
  );

  return {
    fileName: `${report.persona.name}_생활기록부_브랜딩_재료함_설계.pdf`,
    document: {
      metadata: {
        title: '생활기록부 브랜딩 컨설팅 재료함 설계 리포트',
        author: 'MEA',
        subject: `${report.persona.name} 학생 예시 컨설팅 리포트`,
        language: 'ko-KR',
        creator: 'MEA Consulting',
      },
      header: {
        brand: 'MEA',
        label: 'MATERIAL BOX CONSULTING REPORT',
      },
      footer: '생활기록부 브랜딩 컨설팅 · 재료함 설계 예시',
      hero: {
        eyebrow: 'EXAMPLE CONSULTING REPORT',
        title: report.oneLineBrand,
        description: `${report.persona.name} · ${report.persona.grade}`,
        meta: [
          {
            label: '희망 전공',
            value: majors.join(' · '),
          },
          {
            label: '리포트 발행일',
            value: formatReportDate(issuedAt),
          },
        ],
      },
      overview: {
        title: '진로 브랜드 한눈에 보기',
        caption: 'BRAND SNAPSHOT',
        cards: [
          {
            label: '학생',
            values: [report.persona.name, report.persona.grade],
          },
          {
            label: '희망 전공',
            values: majors.map((major, index) => `${index + 1}. ${major}`),
          },
          {
            label: '선택 키워드',
            values: keywords,
          },
        ],
      },
      sectionGroups: [
        {
          title: '전공 세부 분야 키워드',
          caption: 'KEYWORDS',
          sections: report.fieldMap.map((field) => ({
            number: String(field.rank).padStart(2, '0'),
            eyebrow: `${field.rank}순위 희망 전공`,
            title: `${field.major} · ${field.selectedKeywords.join(' · ')}`,
            content: `${field.systemSupport.summary}\n\n${field.mentor.name} 멘토 (${field.mentor.affiliation})\n${field.mentor.advice}`,
          })),
        },
        {
          title: '학생의 스토리와 전공 가치관',
          caption: 'STORY & CORE VALUE',
          sections: [
            {
              number: '01',
              eyebrow: 'STORYTELLING',
              title: report.majorStory.differentiator,
              content: report.majorStory.explanation,
            },
            {
              number: '02',
              eyebrow: 'CORE VALUE',
              title: report.coreValue.statement,
              content: report.coreValue.guidingQuestions
                .map(([question, answer]) => `${question} ${answer}`)
                .join('\n'),
            },
          ],
        },
        {
          title: '계열 적합 역량',
          caption: 'COMPETENCY',
          sections: report.competencies.map((competency, index) => ({
            number: String(index + 1).padStart(2, '0'),
            eyebrow: competency.type,
            title: competency.title,
            content: `${competency.content}\n\n근거 · ${competency.evidence}`,
          })),
        },
        {
          title: '생기부 전반 전략',
          caption: 'SCHOOL RECORD STRATEGY',
          sections: report.schoolRecordStrategy.map((strategy, index) => ({
            number: String(index + 1).padStart(2, '0'),
            eyebrow: strategy.basis.join(' · '),
            title: strategy.title,
            content: strategy.description,
          })),
        },
        {
          title: '브랜드를 구체화하는 보조 가치',
          caption: 'SUPPORTING VALUES',
          sections: report.supportingValues.map((item, index) => ({
            number: String(index + 1).padStart(2, '0'),
            eyebrow: item.role,
            title: item.value,
            content: item.description,
          })),
        },
        {
          title: '브랜드 기반 선택과목 후보',
          caption: 'COURSE STRATEGY',
          sections: report.courses.map((course, index) => ({
            number: String(index + 1).padStart(2, '0'),
            title: course.course,
            content: course.reason,
          })),
        },
      ],
      callout: {
        label: 'BRANDING · ONE-LINE BRAND',
        title: '한 줄 브랜드',
        content: report.oneLineBrand,
      },
      nextSteps: {
        title: '브랜드 기반 장기 탐구 주제',
        caption: 'PROJECT ROADMAP',
        items: report.projectRoadmap.steps.map((step) => ({
          number: step.number,
          title: `${step.stage} · ${step.title}`,
          description: `${step.question}\n확보할 것 · ${step.deliverable}`,
        })),
      },
    },
  };
}
