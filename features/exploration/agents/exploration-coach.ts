import { Agent } from '@openai/agents';

import { EXPLORATION_MODELS } from '@/features/exploration/config';
import { EXPLORATION_COACH_INSTRUCTIONS } from '@/features/exploration/prompts/exploration-coach';
import { explorationRunner } from '@/features/exploration/runner';
import type { ExplorationState } from '@/features/exploration/schemas/exploration';

import 'server-only';

const explorationCoach = new Agent({
  name: 'Exploration Coach',
  model: EXPLORATION_MODELS.coach,
  instructions: EXPLORATION_COACH_INSTRUCTIONS,
  modelSettings: {
    reasoning: { effort: 'low' },
    maxTokens: 3_000,
    text: { verbosity: 'low' },
  },
});

export async function generateCoachResponse(input: {
  phase: 'introduction' | 'conversation';
  state: ExplorationState;
}): Promise<string> {
  const result = await explorationRunner.run(
    explorationCoach,
    JSON.stringify({
      phase: input.phase,
      department: input.state.department,
      conversation: input.state.conversation,
      goal: input.state.goal,
      departmentMap: input.state.departmentMap,
      latestResearch: input.state.latestResearch,
      outputRequirement:
        input.phase === 'introduction'
          ? '학과의 분야와 키워드를 쉽게 소개한 뒤 관심 키워드 하나를 고르도록 질문한다.'
          : '현재 nextTarget 하나를 구체화한다. ready이면 최종 목표만 정리한다.',
    }),
    { maxTurns: 2 },
  );

  const message = result.finalOutput?.trim();
  if (!message) throw new Error('COACH_EMPTY_RESPONSE');

  return message;
}
