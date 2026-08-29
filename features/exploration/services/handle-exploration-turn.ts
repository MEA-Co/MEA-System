import { mapDepartment } from '@/features/exploration/agents/department-mapper';
import { generateCoachResponse } from '@/features/exploration/agents/exploration-coach';
import { evaluateGoal } from '@/features/exploration/agents/goal-evaluator';
import { researchIssues } from '@/features/exploration/agents/issue-researcher';
import { extractProfile } from '@/features/exploration/agents/profile-extractor';
import {
  createEmptyGoal,
  enforceGoalReadiness,
  shouldResearchIssues,
} from '@/features/exploration/domain';
import {
  type ExplorationResponse,
  ExplorationResponseSchema,
  type ExplorationState,
  ExplorationStateSchema,
} from '@/features/exploration/schemas/exploration';

import 'server-only';

export async function startExploration(
  department: string,
): Promise<ExplorationResponse> {
  const departmentMap = await mapDepartment(department);
  const initialState: ExplorationState = {
    department,
    conversation: [
      { role: 'student', content: `${department}에 진학하고 싶어요.` },
    ],
    goal: createEmptyGoal(),
    profile: null,
    departmentMap,
    latestResearch: null,
  };
  const message = await generateCoachResponse({
    phase: 'introduction',
    state: initialState,
  });

  return ExplorationResponseSchema.parse({
    message,
    state: {
      ...initialState,
      conversation: [
        ...initialState.conversation,
        { role: 'coach' as const, content: message },
      ],
    },
  });
}

export async function handleExplorationTurn(input: {
  state: ExplorationState;
  userMessage: string;
}): Promise<ExplorationResponse> {
  const currentState = ExplorationStateSchema.parse(input.state);
  if (currentState.conversation.length > 38) {
    throw new Error('EXPLORATION_CONVERSATION_LIMIT');
  }

  const conversation = [
    ...currentState.conversation,
    { role: 'student' as const, content: input.userMessage },
  ];
  const goal = enforceGoalReadiness(
    await evaluateGoal({
      department: currentState.department,
      conversation,
      previousGoal: currentState.goal,
    }),
  );

  const latestResearch = shouldResearchIssues(currentState.goal, goal)
    ? await researchIssues({
        department: currentState.department,
        keyword: goal.keyword.value ?? '',
      })
    : null;

  const profile = goal.ready
    ? await extractProfile({
        department: currentState.department,
        goal,
        conversation,
      })
    : null;

  const stateBeforeCoach: ExplorationState = {
    department: currentState.department,
    conversation,
    goal,
    profile,
    departmentMap: currentState.departmentMap,
    latestResearch,
  };
  const message = await generateCoachResponse({
    phase: 'conversation',
    state: stateBeforeCoach,
  });

  return ExplorationResponseSchema.parse({
    message,
    state: {
      ...stateBeforeCoach,
      conversation: [
        ...conversation,
        { role: 'coach' as const, content: message },
      ],
    },
  });
}
