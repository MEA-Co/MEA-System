// Agent → Tools

export const GUIDED_CONSULTING_TOOLS_PROTOCOL =
  'guided-consulting.tools/v1' as const;

export type GuidedConsultingToolRequest<
  ToolId extends string = string,
  Input = unknown,
> = {
  protocol: typeof GUIDED_CONSULTING_TOOLS_PROTOCOL;
  type: 'tool.request';
  toolId: ToolId;
  input: Input;
};

// Tools → Agent

export type GuidedConsultingToolError = {
  code:
    | 'TOOL_NOT_FOUND'
    | 'INVALID_INPUT'
    | 'INVALID_OUTPUT'
    | 'EXECUTION_FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';
  message: string;
};

type GuidedConsultingToolResponseBase<ToolId extends string> = {
  protocol: typeof GUIDED_CONSULTING_TOOLS_PROTOCOL;
  type: 'tool.response';
  toolId: ToolId;
};

export type GuidedConsultingToolSuccessResponse<
  ToolId extends string = string,
  Output = unknown,
> = GuidedConsultingToolResponseBase<ToolId> & {
  status: 'completed';
  output: Output;
};

export type GuidedConsultingToolRejectedResponse<
  ToolId extends string = string,
> = GuidedConsultingToolResponseBase<ToolId> & {
  status: 'rejected';
  error: GuidedConsultingToolError;
};

export type GuidedConsultingToolResponse<
  ToolId extends string = string,
  Output = unknown,
> =
  | GuidedConsultingToolSuccessResponse<ToolId, Output>
  | GuidedConsultingToolRejectedResponse<ToolId>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createGuidedConsultingToolRequest<ToolId extends string, Input>(
  toolId: ToolId,
  input: Input,
): GuidedConsultingToolRequest<ToolId, Input> {
  if (input === undefined) {
    throw new Error('Tool 요청에는 input이 필요합니다.');
  }

  return {
    protocol: GUIDED_CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.request',
    toolId,
    input,
  };
}

export function parseGuidedConsultingToolRequest(
  value: unknown,
): GuidedConsultingToolRequest {
  if (
    !isRecord(value) ||
    value.protocol !== GUIDED_CONSULTING_TOOLS_PROTOCOL ||
    value.type !== 'tool.request' ||
    typeof value.toolId !== 'string' ||
    value.toolId.length === 0 ||
    value.input === undefined
  ) {
    throw new Error('올바르지 않은 Tool 요청입니다.');
  }

  return value as GuidedConsultingToolRequest;
}

export function createGuidedConsultingToolSuccessResponse<
  ToolId extends string,
  Output,
>(
  request: GuidedConsultingToolRequest<ToolId>,
  output: Output,
): GuidedConsultingToolSuccessResponse<ToolId, Output> {
  if (output === undefined) {
    throw new Error('Tool 응답에는 output이 필요합니다.');
  }

  return {
    protocol: GUIDED_CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.response',
    status: 'completed',
    toolId: request.toolId,
    output,
  };
}

export function createGuidedConsultingToolRejectedResponse<
  ToolId extends string,
>(
  toolId: ToolId,
  error: GuidedConsultingToolError,
): GuidedConsultingToolRejectedResponse<ToolId> {
  return {
    protocol: GUIDED_CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.response',
    status: 'rejected',
    toolId,
    error,
  };
}

export function parseGuidedConsultingToolResponse(
  value: unknown,
): GuidedConsultingToolResponse {
  if (
    !isRecord(value) ||
    value.protocol !== GUIDED_CONSULTING_TOOLS_PROTOCOL ||
    value.type !== 'tool.response' ||
    typeof value.toolId !== 'string' ||
    (value.status !== 'completed' && value.status !== 'rejected')
  ) {
    throw new Error('올바르지 않은 Tool 응답입니다.');
  }

  if (value.status === 'completed' && value.output === undefined) {
    throw new Error('Tool 완료 응답에는 output이 필요합니다.');
  }

  if (
    value.status === 'rejected' &&
    (!isRecord(value.error) ||
      typeof value.error.code !== 'string' ||
      typeof value.error.message !== 'string')
  ) {
    throw new Error('Tool 오류 응답 형식이 올바르지 않습니다.');
  }

  return value as GuidedConsultingToolResponse;
}
