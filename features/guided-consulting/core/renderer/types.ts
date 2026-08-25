import type {
  GuidedConsultingDynamicRenderTarget,
  GuidedConsultingRendererError,
  GuidedConsultingRenderTarget,
  GuidedConsultingStaticRenderTarget,
} from '@/features/guided-consulting/core/renderer/protocol';

export type GuidedConsultingRenderHandler<
  Environment,
  Output,
  Target extends GuidedConsultingRenderTarget = GuidedConsultingRenderTarget,
> = (request: Target, environment: Environment) => Output;

export type GuidedConsultingStaticRendererEntry<Environment, Output> = {
  mode: 'static';
  render: GuidedConsultingRenderHandler<
    Environment,
    Output,
    GuidedConsultingStaticRenderTarget
  >;
};

export type GuidedConsultingDynamicRendererEntry<Environment, Output> = {
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
