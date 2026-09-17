export type CareerGuideStep = 'purpose' | 'subcore' | 'university' | 'capacity';
export type RequirementGuideStep = 'credits' | 'courses' | 'late-term';
export type StageIntro = 'core' | 'career' | 'requirement' | 'review' | null;
export type RequiredStage =
  { kind: 'core' | 'career' | 'review' } | { kind: 'requirement'; id: string };
export type SelectionSnapshot = {
  stage: RequiredStage;
  selected: Set<string>;
  locked: Set<string>;
};
