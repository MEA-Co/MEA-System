import {
  createConsultingToolRejectedResponse,
  createConsultingToolSuccessResponse,
  parseConsultingToolRequest,
} from '@/features/consulting/core/tools/protocol';
import type {
  ConsultingToolEntries,
  ConsultingTools,
  ConsultingToolSchema,
} from '@/features/consulting/core/tools/types';

export * from '@/features/consulting/core/tools/protocol';
export * from '@/features/consulting/core/tools/runtime';
export type * from '@/features/consulting/core/tools/types';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createConsultingTools<
  Schema extends ConsultingToolSchema<Schema>,
>(entries: ConsultingToolEntries<Schema>): ConsultingTools<Schema> {
  type RegisteredEntry = ConsultingToolEntries<Schema>[keyof Schema];

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
        parseConsultingToolRequest(request);
      } catch (error) {
        return createConsultingToolRejectedResponse(request.toolId, {
          code: 'INVALID_INPUT',
          message: getErrorMessage(error, '올바르지 않은 Tool 요청입니다.'),
        });
      }

      if (options.signal.aborted) {
        return createConsultingToolRejectedResponse(request.toolId, {
          code: 'CANCELLED',
          message: 'Tool 요청이 취소되었습니다.',
        });
      }

      const entry = registry.get(request.toolId);
      if (!entry) {
        return createConsultingToolRejectedResponse(request.toolId, {
          code: 'TOOL_NOT_FOUND',
          message: `Tool을 찾을 수 없습니다: ${request.toolId}`,
        });
      }

      const inputValidation = entry.validateInput?.(request.input) ?? true;
      if (inputValidation !== true) {
        return createConsultingToolRejectedResponse(request.toolId, {
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
          return createConsultingToolRejectedResponse(request.toolId, {
            code: 'CANCELLED',
            message: 'Tool 요청이 취소되었습니다.',
          });
        }

        if (output === undefined) {
          return createConsultingToolRejectedResponse(request.toolId, {
            code: 'INVALID_OUTPUT',
            message: `Tool output이 없습니다: ${request.toolId}`,
          });
        }

        const outputValidation = entry.validateOutput?.(output) ?? true;
        if (outputValidation !== true) {
          return createConsultingToolRejectedResponse(request.toolId, {
            code: 'INVALID_OUTPUT',
            message:
              typeof outputValidation === 'string'
                ? outputValidation
                : `Tool output 형식이 올바르지 않습니다: ${request.toolId}`,
          });
        }

        return createConsultingToolSuccessResponse(request, output);
      } catch (error) {
        const cancelled =
          options.signal.aborted ||
          (error instanceof DOMException && error.name === 'AbortError');
        return createConsultingToolRejectedResponse(request.toolId, {
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
