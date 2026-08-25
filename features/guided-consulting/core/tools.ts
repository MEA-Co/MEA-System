import type {
  GuidedConsultingToolRequest,
  GuidedConsultingToolResponse,
} from '@/features/guided-consulting/core/protocol';
import {
  createGuidedConsultingToolRejectedResponse,
  createGuidedConsultingToolSuccessResponse,
  parseGuidedConsultingToolRequest,
} from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingToolContract = {
  input: unknown;
  output: unknown;
};

export type GuidedConsultingToolSchema<Schema> = {
  [Name in keyof Schema]: GuidedConsultingToolContract;
};

type ToolInput<Schema, Name extends keyof Schema> = Schema[Name] extends {
  input: infer Input;
}
  ? Input
  : never;

type ToolOutput<Schema, Name extends keyof Schema> = Schema[Name] extends {
  output: infer Output;
}
  ? Output
  : never;

export type GuidedConsultingToolEntry<Input, Output> = {
  validateInput?: (input: unknown) => boolean;
  validateOutput?: (output: unknown) => boolean;
  execute: (
    input: Input,
    options: { signal: AbortSignal },
  ) => Output | Promise<Output>;
};

type GuidedConsultingToolEntries<Schema> = {
  [Name in keyof Schema]: GuidedConsultingToolEntry<
    ToolInput<Schema, Name>,
    ToolOutput<Schema, Name>
  >;
};

export type GuidedConsultingToolsRuntime = {
  execute: (
    request: GuidedConsultingToolRequest,
    options: { signal: AbortSignal },
  ) => Promise<GuidedConsultingToolResponse>;
};

export type GuidedConsultingTools<Schema> = GuidedConsultingToolsRuntime & {
  ids: ReadonlyArray<Extract<keyof Schema, string>>;
  has: (id: string) => id is Extract<keyof Schema, string>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createGuidedConsultingTools<
  Schema extends GuidedConsultingToolSchema<Schema>,
>(entries: GuidedConsultingToolEntries<Schema>): GuidedConsultingTools<Schema> {
  type RegisteredEntry = GuidedConsultingToolEntries<Schema>[keyof Schema];

  const registry = new Map(
    Object.entries(entries) as Array<[string, RegisteredEntry]>,
  );
  const ids = Object.freeze([...registry.keys()]) as ReadonlyArray<
    Extract<keyof Schema, string>
  >;

  return {
    ids,
    has: (id): id is Extract<keyof Schema, string> => registry.has(id),
    execute: async (request, options) => {
      try {
        parseGuidedConsultingToolRequest(request);
      } catch (error) {
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: 'INVALID_INPUT',
          message: getErrorMessage(error, '올바르지 않은 Tool 요청입니다.'),
        });
      }

      if (options.signal.aborted) {
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: 'CANCELLED',
          message: 'Tool 요청이 취소되었습니다.',
        });
      }

      const entry = registry.get(request.toolId);
      if (!entry) {
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: 'TOOL_NOT_FOUND',
          message: `Tool을 찾을 수 없습니다: ${request.toolId}`,
        });
      }

      if (entry.validateInput && !entry.validateInput(request.input)) {
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: 'INVALID_INPUT',
          message: `Tool input 형식이 올바르지 않습니다: ${request.toolId}`,
        });
      }

      try {
        const output = await entry.execute(request.input as never, options);

        if (options.signal.aborted) {
          return createGuidedConsultingToolRejectedResponse(request.toolId, {
            code: 'CANCELLED',
            message: 'Tool 요청이 취소되었습니다.',
          });
        }

        if (output === undefined) {
          return createGuidedConsultingToolRejectedResponse(request.toolId, {
            code: 'INVALID_OUTPUT',
            message: `Tool output이 없습니다: ${request.toolId}`,
          });
        }

        if (entry.validateOutput && !entry.validateOutput(output)) {
          return createGuidedConsultingToolRejectedResponse(request.toolId, {
            code: 'INVALID_OUTPUT',
            message: `Tool output 형식이 올바르지 않습니다: ${request.toolId}`,
          });
        }

        return createGuidedConsultingToolSuccessResponse(request, output);
      } catch (error) {
        const cancelled =
          options.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError');
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: cancelled ? 'CANCELLED' : 'EXECUTION_FAILED',
          message: cancelled
            ? 'Tool 요청이 취소되었습니다.'
            : getErrorMessage(
                error,
                `Tool 실행에 실패했습니다: ${request.toolId}`,
              ),
        });
      }
    },
  };
}
