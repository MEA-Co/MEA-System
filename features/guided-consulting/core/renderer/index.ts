import type {
  GuidedConsultingRendererError,
  GuidedConsultingRenderTarget,
} from '@/features/guided-consulting/core/renderer/protocol';
import type {
  GuidedConsultingRenderer,
  GuidedConsultingRendererEntry,
} from '@/features/guided-consulting/core/renderer/types';

export * from '@/features/guided-consulting/core/renderer/protocol';
export type * from '@/features/guided-consulting/core/renderer/types';

export function createGuidedConsultingRenderer<Environment, Output>(
  entries: Readonly<
    Record<string, GuidedConsultingRendererEntry<Environment, Output>>
  >,
): GuidedConsultingRenderer<Environment, Output> {
  const registry = new Map(Object.entries(entries));
  const ids = Object.freeze([...registry.keys()]);

  const validate = (
    request: GuidedConsultingRenderTarget,
  ): GuidedConsultingRendererError | null => {
    const entry = registry.get(request.screenId);
    if (!entry) {
      return {
        code: 'RENDERER_NOT_FOUND',
        message: `Renderer ID를 찾을 수 없습니다: ${request.screenId}`,
      };
    }

    if (entry.mode !== request.mode) {
      return {
        code: 'INVALID_REQUEST',
        message: `${request.screenId} Renderer는 ${entry.mode} 요청만 처리할 수 있습니다.`,
      };
    }

    if (request.mode === 'dynamic' && request.data === undefined) {
      return {
        code: 'INVALID_REQUEST',
        message: `Dynamic Renderer 요청에는 data가 필요합니다: ${request.screenId}`,
      };
    }

    if (
      entry.mode === 'dynamic' &&
      request.mode === 'dynamic' &&
      entry.validateData &&
      !entry.validateData(request.data)
    ) {
      return {
        code: 'INVALID_REQUEST',
        message: `Dynamic Renderer에 필요한 data 형식이 올바르지 않습니다: ${request.screenId}`,
      };
    }

    return null;
  };

  return {
    ids,
    has: (screenId) => registry.has(screenId),
    validate,
    render: (request, environment) => {
      const error = validate(request);
      if (error) throw new Error(error.message);

      const entry = registry.get(request.screenId);
      if (!entry) {
        throw new Error(`Renderer ID를 찾을 수 없습니다: ${request.screenId}`);
      }

      if (entry.mode === 'static' && request.mode === 'static') {
        return entry.render(request, environment);
      }

      if (entry.mode === 'dynamic' && request.mode === 'dynamic') {
        return entry.render(request, environment);
      }

      throw new Error(
        `Renderer 요청 형식이 올바르지 않습니다: ${request.screenId}`,
      );
    },
  };
}
