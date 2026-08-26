import type { LlmRequest } from '@/features/llm/protocol';
import { isLlmResponse } from '@/features/llm/protocol';

function getResponseError(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { error?: unknown }).error === 'string'
  ) {
    return (value as { error: string }).error;
  }

  return null;
}

export async function requestLlm(
  request: LlmRequest,
  options: { signal: AbortSignal },
) {
  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    signal: options.signal,
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getResponseError(data) ??
        '언어 모델 호출에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  if (!isLlmResponse(data)) {
    throw new Error('언어 모델 응답 형식이 올바르지 않습니다.');
  }

  return data;
}
