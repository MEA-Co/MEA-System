import type { GuidedConsultingScreen } from '@/features/guided-consulting/core/types';

// User → Agent

export type GuidedConsultingUserAction =
  | { type: 'user.next-explanation' }
  | { type: 'user.previous-explanation' }
  | { type: 'user.start-input' }
  | { type: 'user.review-explanation' }
  | { type: 'user.submit'; value: string }
  | { type: 'user.back' }
  | { type: 'user.reset' };

// Agent ↔ Renderer

export const GUIDED_CONSULTING_RENDERER_PROTOCOL =
  'guided-consulting.renderer/v1' as const;

export type GuidedConsultingRendererAction = GuidedConsultingUserAction['type'];

export type GuidedConsultingRendererRequest<Context extends object> = {
  protocol: typeof GUIDED_CONSULTING_RENDERER_PROTOCOL;
  type: 'render.request';
  screen: GuidedConsultingScreen<Context>;
  allowedActions: ReadonlyArray<GuidedConsultingRendererAction>;
};

type GuidedConsultingRendererResponseBase = {
  protocol: typeof GUIDED_CONSULTING_RENDERER_PROTOCOL;
  type: 'render.response';
  screenId: string;
  rendererId: string;
};

export type GuidedConsultingRendererSuccessResponse =
  GuidedConsultingRendererResponseBase & {
    status: 'rendered';
  };

export type GuidedConsultingRendererRejectedResponse =
  GuidedConsultingRendererResponseBase & {
    status: 'rejected';
    error: {
      code: 'RENDERER_NOT_FOUND' | 'INVALID_REQUEST' | 'RENDER_FAILED';
      message: string;
    };
  };

export type GuidedConsultingRendererResponse =
  | GuidedConsultingRendererSuccessResponse
  | GuidedConsultingRendererRejectedResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getAllowedActions<Context extends object>(
  screen: GuidedConsultingScreen<Context>,
): ReadonlyArray<GuidedConsultingRendererAction> {
  if (screen.kind === 'explanation') {
    return [
      ...(screen.canGoBack ? (['user.back'] as const) : []),
      ...(screen.explanationIndex > 0
        ? (['user.previous-explanation'] as const)
        : []),
      screen.explanationIndex === screen.explanationCount - 1
        ? 'user.start-input'
        : 'user.next-explanation',
    ];
  }

  if (screen.kind === 'input') {
    const running =
      screen.status === 'validating' || screen.status === 'running';
    if (running) return [];
    return [
      ...(screen.canGoBack ? (['user.back'] as const) : []),
      'user.review-explanation',
      'user.submit',
    ];
  }

  return [...(screen.canGoBack ? (['user.back'] as const) : []), 'user.reset'];
}

export function createGuidedConsultingRendererRequest<Context extends object>(
  screen: GuidedConsultingScreen<Context>,
): GuidedConsultingRendererRequest<Context> {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.request',
    screen,
    allowedActions: getAllowedActions(screen),
  };
}

export function parseGuidedConsultingRendererRequest<Context extends object>(
  value: unknown,
): GuidedConsultingRendererRequest<Context> {
  if (
    !isRecord(value) ||
    value.protocol !== GUIDED_CONSULTING_RENDERER_PROTOCOL ||
    value.type !== 'render.request' ||
    !isRecord(value.screen) ||
    typeof value.screen.id !== 'string' ||
    !isRecord(value.screen.main) ||
    typeof value.screen.main.id !== 'string' ||
    !isRecord(value.screen.prompter) ||
    !Array.isArray(value.allowedActions)
  ) {
    throw new Error('올바르지 않은 Renderer 요청입니다.');
  }

  return value as GuidedConsultingRendererRequest<Context>;
}

export function createGuidedConsultingRendererSuccessResponse<
  Context extends object,
>(
  request: GuidedConsultingRendererRequest<Context>,
): GuidedConsultingRendererSuccessResponse {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rendered',
    screenId: request.screen.id,
    rendererId: request.screen.main.id,
  };
}

export function createGuidedConsultingRendererRejectedResponse<
  Context extends object,
>(
  request: GuidedConsultingRendererRequest<Context>,
  error: GuidedConsultingRendererRejectedResponse['error'],
): GuidedConsultingRendererRejectedResponse {
  return {
    protocol: GUIDED_CONSULTING_RENDERER_PROTOCOL,
    type: 'render.response',
    status: 'rejected',
    screenId: request.screen.id,
    rendererId: request.screen.main.id,
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
    typeof value.screenId !== 'string' ||
    typeof value.rendererId !== 'string'
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
