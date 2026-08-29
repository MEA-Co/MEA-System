import { getMaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/plan';
import {
  isMaterialBoxProgressScreenData,
  type MaterialBoxContext,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { MATERIAL_BOX_CONSULTING_ID } from '@/features/consulting/completion';
import type { ConsultingMemory } from '@/features/consulting/core/agent';

type MaterialBoxCompletionRequest = {
  planId: typeof MATERIAL_BOX_CONSULTING_ID;
  memory: ConsultingMemory<MaterialBoxContext>;
};

const USER_ACTION_TYPES = new Set([
  'user.next-explanation',
  'user.previous-explanation',
  'user.start-input',
  'user.review-explanation',
  'user.submit',
  'user.retry',
  'user.back',
  'user.reset',
]);

const TOOL_ERROR_CODES = new Set([
  'TOOL_NOT_FOUND',
  'INVALID_INPUT',
  'INVALID_OUTPUT',
  'EXECUTION_FAILED',
  'CANCELLED',
  'TIMEOUT',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserAction(value: unknown) {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (!USER_ACTION_TYPES.has(value.type)) return false;

  return value.type === 'user.submit'
    ? typeof value.value === 'string'
    : !('value' in value);
}

function isToolError(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    TOOL_ERROR_CODES.has(value.code) &&
    typeof value.message === 'string'
  );
}

function isMaterialBoxMemory(
  value: unknown,
): value is ConsultingMemory<MaterialBoxContext> {
  return (
    isRecord(value) &&
    isRecord(value.context) &&
    Object.keys(value.context).length === 0 &&
    isRecord(value.actions) &&
    Object.values(value.actions).every(isUserAction) &&
    isRecord(value.toolResults) &&
    isRecord(value.toolErrors) &&
    Object.values(value.toolErrors).every(isToolError) &&
    (value.lastAction === null || isUserAction(value.lastAction)) &&
    (value.lastToolError === null || isToolError(value.lastToolError))
  );
}

export function parseMaterialBoxCompletionRequest(
  value: unknown,
): MaterialBoxCompletionRequest {
  if (
    !isRecord(value) ||
    value.planId !== MATERIAL_BOX_CONSULTING_ID ||
    !isMaterialBoxMemory(value.memory)
  ) {
    throw new Error('MATERIAL_BOX_COMPLETION_INVALID_REQUEST');
  }

  return value as MaterialBoxCompletionRequest;
}

export function createMaterialBoxCompletionResult(
  request: MaterialBoxCompletionRequest,
) {
  const resultData = getMaterialBoxProgressScreenData(request.memory);
  if (!isMaterialBoxProgressScreenData(resultData)) {
    throw new Error('MATERIAL_BOX_COMPLETION_INVALID_RESULT');
  }

  return {
    agentMemory: request.memory,
    resultData,
  };
}
