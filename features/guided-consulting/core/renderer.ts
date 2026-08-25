export type GuidedConsultingRenderRequest = {
  id: string;
  data?: unknown;
};

export type GuidedConsultingRenderHandler<Environment, Output> = (
  request: GuidedConsultingRenderRequest,
  environment: Environment,
) => Output;

export type GuidedConsultingRenderer<Environment, Output> = {
  ids: ReadonlyArray<string>;
  has: (id: string) => boolean;
  render: (
    request: GuidedConsultingRenderRequest,
    environment: Environment,
  ) => Output;
};

type GuidedConsultingRendererOptions<Environment, Output> = {
  fallback?: GuidedConsultingRenderHandler<Environment, Output>;
};

export function createGuidedConsultingRenderer<Environment, Output>(
  handlers: Readonly<
    Record<string, GuidedConsultingRenderHandler<Environment, Output>>
  >,
  options: GuidedConsultingRendererOptions<Environment, Output> = {},
): GuidedConsultingRenderer<Environment, Output> {
  const registry = new Map(Object.entries(handlers));
  const ids = Object.freeze([...registry.keys()]);

  return {
    ids,
    has: (id) => registry.has(id),
    render: (request, environment) => {
      const handler = registry.get(request.id) ?? options.fallback;
      if (!handler) {
        throw new Error(
          `Renderer ID를 찾을 수 없습니다: ${request.id}. 등록된 ID: ${ids.join(', ')}`,
        );
      }
      return handler(request, environment);
    },
  };
}
