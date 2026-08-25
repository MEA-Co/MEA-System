// Agent → Tools

export const CONSULTING_TOOLS_PROTOCOL = 'consulting.tools/v1' as const;

export type ConsultingToolRequest<
  ToolId extends string = string,
  Input = unknown,
> = {
  protocol: typeof CONSULTING_TOOLS_PROTOCOL;
  type: 'tool.request';
  toolId: ToolId;
  input: Input;
};

// Tools → Agent

export type ConsultingToolError = {
  code:
    | 'TOOL_NOT_FOUND'
    | 'INVALID_INPUT'
    | 'INVALID_OUTPUT'
    | 'EXECUTION_FAILED'
    | 'CANCELLED'
    | 'TIMEOUT';
  message: string;
};

type ConsultingToolResponseBase<ToolId extends string> = {
  protocol: typeof CONSULTING_TOOLS_PROTOCOL;
  type: 'tool.response';
  toolId: ToolId;
};

export type ConsultingToolSuccessResponse<
  ToolId extends string = string,
  Output = unknown,
> = ConsultingToolResponseBase<ToolId> & {
  status: 'completed';
  output: Output;
};

export type ConsultingToolRejectedResponse<ToolId extends string = string> =
  ConsultingToolResponseBase<ToolId> & {
    status: 'rejected';
    error: ConsultingToolError;
  };

export type ConsultingToolResponse<
  ToolId extends string = string,
  Output = unknown,
> =
  | ConsultingToolSuccessResponse<ToolId, Output>
  | ConsultingToolRejectedResponse<ToolId>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createConsultingToolRequest<ToolId extends string, Input>(
  toolId: ToolId,
  input: Input,
): ConsultingToolRequest<ToolId, Input> {
  if (input === undefined) {
    throw new Error('Tool 요청에는 input이 필요합니다.');
  }

  return {
    protocol: CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.request',
    toolId,
    input,
  };
}

export function parseConsultingToolRequest(
  value: unknown,
): ConsultingToolRequest {
  if (
    !isRecord(value) ||
    value.protocol !== CONSULTING_TOOLS_PROTOCOL ||
    value.type !== 'tool.request' ||
    typeof value.toolId !== 'string' ||
    value.toolId.length === 0 ||
    value.input === undefined
  ) {
    throw new Error('올바르지 않은 Tool 요청입니다.');
  }

  return value as ConsultingToolRequest;
}

export function createConsultingToolSuccessResponse<
  ToolId extends string,
  Output,
>(
  request: ConsultingToolRequest<ToolId>,
  output: Output,
): ConsultingToolSuccessResponse<ToolId, Output> {
  if (output === undefined) {
    throw new Error('Tool 응답에는 output이 필요합니다.');
  }

  return {
    protocol: CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.response',
    status: 'completed',
    toolId: request.toolId,
    output,
  };
}

export function createConsultingToolRejectedResponse<ToolId extends string>(
  toolId: ToolId,
  error: ConsultingToolError,
): ConsultingToolRejectedResponse<ToolId> {
  return {
    protocol: CONSULTING_TOOLS_PROTOCOL,
    type: 'tool.response',
    status: 'rejected',
    toolId,
    error,
  };
}

export function parseConsultingToolResponse(
  value: unknown,
): ConsultingToolResponse {
  if (
    !isRecord(value) ||
    value.protocol !== CONSULTING_TOOLS_PROTOCOL ||
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

  return value as ConsultingToolResponse;
}
