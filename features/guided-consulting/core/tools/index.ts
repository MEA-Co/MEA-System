import {
  createGuidedConsultingToolRejectedResponse,
  createGuidedConsultingToolSuccessResponse,
  parseGuidedConsultingToolRequest,
} from '@/features/guided-consulting/core/tools/protocol';
import type {
  GuidedConsultingToolEntries,
  GuidedConsultingTools,
  GuidedConsultingToolSchema,
} from '@/features/guided-consulting/core/tools/types';

export * from '@/features/guided-consulting/core/tools/protocol';
export type * from '@/features/guided-consulting/core/tools/types';

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

      const inputValidation = entry.validateInput?.(request.input) ?? true;
      if (inputValidation !== true) {
        return createGuidedConsultingToolRejectedResponse(request.toolId, {
          code: 'INVALID_INPUT',
          message:
            typeof inputValidation === 'string'
              ? inputValidation
              : `Tool input 형식이 올바르지 않습니다: ${request.toolId}`,
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

        const outputValidation = entry.validateOutput?.(output) ?? true;
        if (outputValidation !== true) {
          return createGuidedConsultingToolRejectedResponse(request.toolId, {
            code: 'INVALID_OUTPUT',
            message:
              typeof outputValidation === 'string'
                ? outputValidation
                : `Tool output 형식이 올바르지 않습니다: ${request.toolId}`,
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
