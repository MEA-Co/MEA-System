import { Agent, webSearchTool } from '@openai/agents';

import { EXPLORATION_MODELS } from '@/features/exploration/config';
import { ISSUE_RESEARCHER_INSTRUCTIONS } from '@/features/exploration/prompts/issue-researcher';
import { explorationRunner } from '@/features/exploration/runner';
import {
  type IssueResearch,
  IssueResearchSchema,
} from '@/features/exploration/schemas/exploration';

import 'server-only';

const issueResearcher = new Agent({
  name: 'Issue Researcher',
  model: EXPLORATION_MODELS.issueResearcher,
  instructions: ISSUE_RESEARCHER_INSTRUCTIONS,
  outputType: IssueResearchSchema,
  tools: [
    webSearchTool({
      searchContextSize: 'medium',
      userLocation: {
        type: 'approximate',
        country: 'KR',
        timezone: 'Asia/Seoul',
      },
    }),
  ],
  modelSettings: {
    reasoning: { effort: 'medium' },
    maxTokens: 6_000,
    toolChoice: 'required',
  },
});

export async function researchIssues(input: {
  department: string;
  keyword: string;
}): Promise<IssueResearch> {
  const result = await explorationRunner.run(
    issueResearcher,
    JSON.stringify(input),
    { maxTurns: 4 },
  );

  return IssueResearchSchema.parse(result.finalOutput);
}
