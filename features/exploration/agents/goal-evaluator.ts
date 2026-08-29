import { Agent } from '@openai/agents';

import { EXPLORATION_MODELS } from '@/features/exploration/config';
import { GOAL_EVALUATOR_INSTRUCTIONS } from '@/features/exploration/prompts/goal-evaluator';
import { explorationRunner } from '@/features/exploration/runner';
import {
  type ConversationTurn,
  type ExplorationGoal,
  ExplorationGoalSchema,
} from '@/features/exploration/schemas/exploration';

import 'server-only';

const goalEvaluator = new Agent({
  name: 'Goal Evaluator',
  model: EXPLORATION_MODELS.goalEvaluator,
  instructions: GOAL_EVALUATOR_INSTRUCTIONS,
  outputType: ExplorationGoalSchema,
  modelSettings: {
    reasoning: { effort: 'medium' },
    maxTokens: 3_000,
  },
});

export async function evaluateGoal(input: {
  department: string;
  conversation: ReadonlyArray<ConversationTurn>;
  previousGoal: ExplorationGoal;
}): Promise<ExplorationGoal> {
  const result = await explorationRunner.run(
    goalEvaluator,
    JSON.stringify(input),
    { maxTurns: 2 },
  );

  return ExplorationGoalSchema.parse(result.finalOutput);
}
