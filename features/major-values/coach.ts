import { Agent, Runner } from '@openai/agents';

import {
  applyValuesReply,
  valuesReplySchema,
  type ValuesState,
} from './domain';
import { metadataReferences, type ValuesMetadata } from './metadata';
import { MAJOR_VALUES_INSTRUCTIONS } from './prompts';

import 'server-only';

export async function generateValuesTurn(
  state: ValuesState,
  metadata: ValuesMetadata,
): Promise<ValuesState> {
  const coach = new Agent({
    name: 'Major Values Exploration Coach',
    model: process.env.OPENAI_MAJOR_VALUES_MODEL ?? 'gpt-5.6-luna',
    instructions: MAJOR_VALUES_INSTRUCTIONS,
    outputType: valuesReplySchema,
    modelSettings: { reasoning: { effort: 'medium' }, maxTokens: 12_000 },
  });
  const runner = new Runner({
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
    modelSettings: { store: false, timeoutMs: 90_000 },
  });
  const allowedReferences = metadataReferences(metadata);
  let correction: { invalidOutput: unknown; error: string } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result: { finalOutput: unknown } = await runner.run(
      coach,
      JSON.stringify({ state, metadata, allowedReferences, correction }),
      { maxTurns: 1 },
    );
    try {
      const reply = valuesReplySchema.parse(result.finalOutput);
      return applyValuesReply(state, reply, allowedReferences);
    } catch (error) {
      if (attempt === 1) throw error;
      correction = {
        invalidOutput: result.finalOutput,
        error:
          error instanceof Error ? error.message : '출력 형식을 확인해주세요.',
      };
    }
  }
  throw new Error('가치관 응답을 확인하지 못했습니다.');
}
