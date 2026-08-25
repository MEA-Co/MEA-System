// User → Agent

export type GuidedConsultingUserAction =
  | { type: 'user.next-explanation' }
  | { type: 'user.previous-explanation' }
  | { type: 'user.start-input' }
  | { type: 'user.review-explanation' }
  | { type: 'user.submit'; value: string }
  | { type: 'user.back' }
  | { type: 'user.reset' };

// Agent → Renderer

export const GUIDED_CONSULTING_RENDERER_PROTOCOL =
  'guided-consulting.renderer/v1' as const;

export type GuidedConsultingStaticRenderTarget = {
  screenId: string;
  mode: 'static';
};

export type GuidedConsultingDynamicRenderTarget = {
  screenId: string;
  mode: 'dynamic';
  data: unknown;
};

export type GuidedConsultingRenderTarget =
  GuidedConsultingStaticRenderTarget | GuidedConsultingDynamicRenderTarget;

type GuidedConsultingRendererRequestBase = {
  protocol: typeof GUIDED_CONSULTING_RENDERER_PROTOCOL;
  type: 'render.request';
};

export type GuidedConsultingRendererStaticRequest =
  GuidedConsultingRendererRequestBase & GuidedConsultingStaticRenderTarget;

export type GuidedConsultingRendererDynamicRequest =
  GuidedConsultingRendererRequestBase & GuidedConsultingDynamicRenderTarget;

export type GuidedConsultingRendererRequest =
  | GuidedConsultingRendererStaticRequest
  | GuidedConsultingRendererDynamicRequest;

// Renderer → Agent

export type GuidedConsultingRendererError = {
  code: 'RENDERER_NOT_FOUND' | 'INVALID_REQUEST' | 'RENDER_FAILED';
  message: string;
};

type GuidedConsultingRendererResponseBase = {
  protocol: typeof GUIDED_CONSULTING_RENDERER_PROTOCOL;
  type: 'render.response';
  screenId: string;
};

export type GuidedConsultingRendererSuccessResponse =
  GuidedConsultingRendererResponseBase & {
    status: 'rendered';
  };

export type GuidedConsultingRendererRejectedResponse =
  GuidedConsultingRendererResponseBase & {
    status: 'rejected';
    error: GuidedConsultingRendererError;
  };

export type GuidedConsultingRendererResponse =
  | GuidedConsultingRendererSuccessResponse
  | GuidedConsultingRendererRejectedResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createGuidedConsultingRendererRequest(
  target: GuidedConsultingRenderTarget,
): GuidedConsultingRendererRequest {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.request',
    ...target,
  };
}

export function parseGuidedConsultingRendererRequest(
  value: unknown,
): GuidedConsultingRendererRequest {
  if (
    !isRecord(value) ||
    value.protocol !== GUIDED_CONSULTING_RENDERER_PROTOCOL ||
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

  return value as GuidedConsultingRendererRequest;
}

export function createGuidedConsultingRendererSuccessResponse(
  request: GuidedConsultingRendererRequest,
): GuidedConsultingRendererSuccessResponse {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rendered',
    screenId: request.screenId,
  };
}

export function createGuidedConsultingRendererRejectedResponse(
  screenId: string,
  error: GuidedConsultingRendererError,
): GuidedConsultingRendererRejectedResponse {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rejected',
    screenId,
    error,
  };
}

export function parseGuidedConsultingRendererResponse(
  value: unknown,
): GuidedConsultingRendererResponse {
  if (
    !isRecord(value) ||
    value.protocol !== GUIDED_CONSULTING_RENDERER_PROTOCOL ||
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

  return value as GuidedConsultingRendererResponse;
}
