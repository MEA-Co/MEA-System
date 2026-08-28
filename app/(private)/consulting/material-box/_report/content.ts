import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';

export type MaterialBoxExampleReportData = {
  persona: {
    name: string;
    grade: string;
  };
  fieldMap: ReadonlyArray<{
    rank: number;
    major: string;
    systemSupport: {
      sources: ReadonlyArray<{
        label: string;
        href: string;
      }>;
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

export function createMaterialBoxExampleReportData(
  example: MaterialBoxExampleReportData,
): MaterialBoxProgressScreenData {
  return {
    majorKeywords: example.fieldMap.map((field) => ({
      major: field.major,
      keyword: field.selectedKeywords.join(', '),
      selectedSuggestions: field.selectedKeywords.map((keyword) => ({
        keyword,
        description: field.systemSupport.summary,
        links: field.systemSupport.sources.slice(0, 4).map((source, index) => ({
          title: source.label,
          type: index === 0 ? 'department' : 'laboratory',
          url: source.href,
          sourceKeyword: keyword,
        })),
      })),
    })),
    studentStory: example.majorStory.differentiator,
    coreValue: example.coreValue.statement,
    fieldStrength: example.competencies[0]?.title,
    majorFieldStrength: example.competencies[1]?.title,
    personalStrength: example.competencies[2]?.title,
  };
}
