// Agent → Renderer

export const CONSULTING_RENDERER_PROTOCOL = 'consulting.renderer/v1' as const;

export type ConsultingStaticRenderTarget = {
  screenId: string;
  mode: 'static';
};

export type ConsultingDynamicRenderTarget = {
  screenId: string;
  mode: 'dynamic';
  data: unknown;
};

export type ConsultingRenderTarget =
  ConsultingStaticRenderTarget | ConsultingDynamicRenderTarget;

type ConsultingRendererRequestBase = {
  protocol: typeof CONSULTING_RENDERER_PROTOCOL;
  type: 'render.request';
};

export type ConsultingRendererStaticRequest = ConsultingRendererRequestBase &
  ConsultingStaticRenderTarget;

export type ConsultingRendererDynamicRequest = ConsultingRendererRequestBase &
  ConsultingDynamicRenderTarget;

export type ConsultingRendererRequest =
  ConsultingRendererStaticRequest | ConsultingRendererDynamicRequest;

// Renderer → Agent

export type ConsultingRendererError = {
  code: 'RENDERER_NOT_FOUND' | 'INVALID_REQUEST' | 'RENDER_FAILED';
  message: string;
};

type ConsultingRendererResponseBase = {
  protocol: typeof CONSULTING_RENDERER_PROTOCOL;
  type: 'render.response';
  screenId: string;
};

export type ConsultingRendererSuccessResponse =
  ConsultingRendererResponseBase & {
    status: 'rendered';
  };

export type ConsultingRendererRejectedResponse =
  ConsultingRendererResponseBase & {
    status: 'rejected';
    error: ConsultingRendererError;
  };

export type ConsultingRendererResponse =
  ConsultingRendererSuccessResponse | ConsultingRendererRejectedResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createConsultingRendererRequest(
  target: ConsultingRenderTarget,
): ConsultingRendererRequest {
  return {
    protocol: CONSULTING_RENDERER_PROTOCOL,
    type: 'render.request',
    ...target,
  };
}

export function parseConsultingRendererRequest(
  value: unknown,
): ConsultingRendererRequest {
  if (
    !isRecord(value) ||
    value.protocol !== CONSULTING_RENDERER_PROTOCOL ||
    value.type !== 'render.request' ||
    typeof value.screenId !== 'string' ||
    value.screenId.length === 0 ||
    (value.mode !== 'static' && value.mode !== 'dynamic')
  ) {
    throw new Error('올바르지 않은 Renderer 요청입니다.');
  }

  if (value.mode === 'static' && 'data' in value) {
    throw new Error('Static Renderer 요청에는 data를 전달할 수 없습니다.');
  }

  if (value.mode === 'dynamic' && value.data === undefined) {
    throw new Error('Dynamic Renderer 요청에는 data가 필요합니다.');
  }

  return value as ConsultingRendererRequest;
}

export function createConsultingRendererSuccessResponse(
  request: ConsultingRendererRequest,
): ConsultingRendererSuccessResponse {
  return {
    protocol: CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rendered',
    screenId: request.screenId,
  };
}

export function createConsultingRendererRejectedResponse(
  screenId: string,
  error: ConsultingRendererError,
): ConsultingRendererRejectedResponse {
  return {
    protocol: CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rejected',
    screenId,
    error,
  };
}

export function parseConsultingRendererResponse(
  value: unknown,
): ConsultingRendererResponse {
  if (
    !isRecord(value) ||
    value.protocol !== CONSULTING_RENDERER_PROTOCOL ||
    value.type !== 'render.response' ||
    (value.status !== 'rendered' && value.status !== 'rejected') ||
    typeof value.screenId !== 'string'
  ) {
    throw new Error('올바르지 않은 Renderer 응답입니다.');
  }

  if (
    value.status === 'rejected' &&
    (!isRecord(value.error) ||
      typeof value.error.code !== 'string' ||
      typeof value.error.message !== 'string')
  ) {
    throw new Error('Renderer 오류 응답 형식이 올바르지 않습니다.');
  }

  return value as ConsultingRendererResponse;
}
