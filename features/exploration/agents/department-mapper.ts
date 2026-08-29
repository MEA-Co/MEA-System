import { Agent } from '@openai/agents';

import { EXPLORATION_MODELS } from '@/features/exploration/config';
import { DEPARTMENT_MAPPER_INSTRUCTIONS } from '@/features/exploration/prompts/department-mapper';
import { explorationRunner } from '@/features/exploration/runner';
import {
  type DepartmentMap,
  DepartmentMapSchema,
} from '@/features/exploration/schemas/exploration';

import 'server-only';

const departmentMapper = new Agent({
  name: 'Department Mapper',
  model: EXPLORATION_MODELS.departmentMapper,
  instructions: DEPARTMENT_MAPPER_INSTRUCTIONS,
  outputType: DepartmentMapSchema,
  modelSettings: {
    reasoning: { effort: 'low' },
    maxTokens: 4_000,
  },
});

export async function mapDepartment(department: string): Promise<DepartmentMap> {
  const result = await explorationRunner.run(
    departmentMapper,
    JSON.stringify({ department }),
    { maxTurns: 2 },
  );

  return DepartmentMapSchema.parse(result.finalOutput);
}
