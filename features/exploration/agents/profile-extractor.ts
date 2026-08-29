import { Agent } from '@openai/agents';

import { EXPLORATION_MODELS } from '@/features/exploration/config';
import { PROFILE_EXTRACTOR_INSTRUCTIONS } from '@/features/exploration/prompts/profile-extractor';
import { explorationRunner } from '@/features/exploration/runner';
import {
  type ConversationTurn,
  type ExplorationGoal,
  type StudentExplorationProfile,
  StudentExplorationProfileSchema,
} from '@/features/exploration/schemas/exploration';

import 'server-only';

const profileExtractor = new Agent({
  name: 'Student Profile Extractor',
  model: EXPLORATION_MODELS.profileExtractor,
  instructions: PROFILE_EXTRACTOR_INSTRUCTIONS,
  outputType: StudentExplorationProfileSchema,
  modelSettings: {
    reasoning: { effort: 'medium' },
    maxTokens: 3_000,
  },
});

export async function extractProfile(input: {
  department: string;
  goal: ExplorationGoal;
  conversation: ReadonlyArray<ConversationTurn>;
}): Promise<StudentExplorationProfile> {
  if (!input.goal.ready) {
    throw new Error('PROFILE_REQUIRES_READY_GOAL');
  }

  const result = await explorationRunner.run(
    profileExtractor,
    JSON.stringify(input),
    { maxTurns: 2 },
  );

  return StudentExplorationProfileSchema.parse(result.finalOutput);
}
