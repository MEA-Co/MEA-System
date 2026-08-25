import type {
  ConsultingDynamicRenderTarget,
  ConsultingRendererError,
  ConsultingRenderTarget,
  ConsultingStaticRenderTarget,
} from '@/features/consulting/core/renderer/protocol';

export type ConsultingRenderHandler<
  Environment,
  Output,
  Target extends ConsultingRenderTarget = ConsultingRenderTarget,
> = (request: Target, environment: Environment) => Output;

export type ConsultingStaticRendererEntry<Environment, Output> = {
  mode: 'static';
  render: ConsultingRenderHandler<
    Environment,
    Output,
    ConsultingStaticRenderTarget
  >;
};

export type ConsultingDynamicRendererEntry<Environment, Output> = {
  mode: 'dynamic';
  validateData?: (data: unknown) => boolean;
  render: ConsultingRenderHandler<
    Environment,
    Output,
    ConsultingDynamicRenderTarget
  >;
};

export type ConsultingRendererEntry<Environment, Output> =
  | ConsultingStaticRendererEntry<Environment, Output>
  | ConsultingDynamicRendererEntry<Environment, Output>;

export type ConsultingRenderer<Environment, Output> = {
  ids: ReadonlyArray<string>;
  has: (screenId: string) => boolean;
  validate: (request: ConsultingRenderTarget) => ConsultingRendererError | null;
  render: (request: ConsultingRenderTarget, environment: Environment) => Output;
};
