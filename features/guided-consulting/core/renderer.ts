import type {
  GuidedConsultingDynamicRenderTarget,
  GuidedConsultingRendererError,
  GuidedConsultingRenderTarget,
  GuidedConsultingStaticRenderTarget,
} from '@/features/guided-consulting/core/protocol';

export type GuidedConsultingRenderHandler<
  Environment,
  Output,
  Target extends GuidedConsultingRenderTarget = GuidedConsultingRenderTarget,
> = (request: Target, environment: Environment) => Output;

type GuidedConsultingStaticRendererEntry<Environment, Output> = {
  mode: 'static';
  render: GuidedConsultingRenderHandler<
    Environment,
    Output,
    GuidedConsultingStaticRenderTarget
  >;
};

type GuidedConsultingDynamicRendererEntry<Environment, Output> = {
  mode: 'dynamic';
  validateData?: (data: unknown) => boolean;
  render: GuidedConsultingRenderHandler<
    Environment,
    Output,
    GuidedConsultingDynamicRenderTarget
  >;
};

export type GuidedConsultingRendererEntry<Environment, Output> =
  | GuidedConsultingStaticRendererEntry<Environment, Output>
  | GuidedConsultingDynamicRendererEntry<Environment, Output>;

export type GuidedConsultingRenderer<Environment, Output> = {
  ids: ReadonlyArray<string>;
  has: (screenId: string) => boolean;
  validate: (
    request: GuidedConsultingRenderTarget,
  ) => GuidedConsultingRendererError | null;
  render: (
    request: GuidedConsultingRenderTarget,
    environment: Environment,
  ) => Output;
};

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
