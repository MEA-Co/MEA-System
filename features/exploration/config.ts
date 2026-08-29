import 'server-only';

const defaultModel = process.env.OPENAI_EXPLORATION_MODEL ?? 'gpt-5.6-luna';

export const EXPLORATION_MODELS = {
  departmentMapper: process.env.OPENAI_DEPARTMENT_MAPPER_MODEL ?? defaultModel,
  goalEvaluator: process.env.OPENAI_GOAL_EVALUATOR_MODEL ?? defaultModel,
  issueResearcher: process.env.OPENAI_ISSUE_RESEARCHER_MODEL ?? defaultModel,
  profileExtractor: process.env.OPENAI_PROFILE_EXTRACTOR_MODEL ?? defaultModel,
  coach: process.env.OPENAI_EXPLORATION_COACH_MODEL ?? defaultModel,
} as const;
