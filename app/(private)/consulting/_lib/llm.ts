export const CONSULTING_LLM_MODELS = ['gpt-5-nano'] as const;

export type ConsultingLlmModel = (typeof CONSULTING_LLM_MODELS)[number];

export type ConsultingLlmJsonSchemaFormat = {
  type: 'json_schema';
  name: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type ConsultingLlmRequest = {
  model: ConsultingLlmModel;
  instructions: string;
  input: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  text?: {
    format?: ConsultingLlmJsonSchemaFormat;
    verbosity?: 'low' | 'medium' | 'high';
  };
};

export type ConsultingLlmResponse = {
  outputText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonSchemaFormat(
  value: unknown,
): value is ConsultingLlmJsonSchemaFormat {
  if (
    !isRecord(value) ||
    value.type !== 'json_schema' ||
    typeof value.name !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(value.name) ||
    (value.description !== undefined &&
      (typeof value.description !== 'string' ||
        value.description.length > 500)) ||
    (value.strict !== undefined && typeof value.strict !== 'boolean') ||
    !isRecord(value.schema)
  ) {
    return false;
  }

  try {
    return JSON.stringify(value.schema).length <= 20_000;
  } catch {
    return false;
  }
}

function isTextConfig(value: unknown): value is ConsultingLlmRequest['text'] {
  if (!isRecord(value)) return false;

  const verbosity = value.verbosity;
  return (
    (value.format === undefined || isJsonSchemaFormat(value.format)) &&
    (verbosity === undefined ||
      verbosity === 'low' ||
      verbosity === 'medium' ||
      verbosity === 'high')
  );
}

export function isConsultingLlmRequest(
  value: unknown,
): value is ConsultingLlmRequest {
  if (!isRecord(value)) return false;

  const reasoningEffort = value.reasoningEffort;
  return (
    typeof value.model === 'string' &&
    CONSULTING_LLM_MODELS.includes(value.model as ConsultingLlmModel) &&
    typeof value.instructions === 'string' &&
    value.instructions.trim().length > 0 &&
    value.instructions.length <= 16_000 &&
    typeof value.input === 'string' &&
    value.input.length > 0 &&
    value.input.length <= 32_000 &&
    (reasoningEffort === undefined ||
      reasoningEffort === 'minimal' ||
      reasoningEffort === 'low' ||
      reasoningEffort === 'medium' ||
      reasoningEffort === 'high') &&
    (value.maxOutputTokens === undefined ||
      (Number.isInteger(value.maxOutputTokens) &&
        typeof value.maxOutputTokens === 'number' &&
        value.maxOutputTokens >= 1 &&
        value.maxOutputTokens <= 4_000)) &&
    (value.text === undefined || isTextConfig(value.text))
  );
}

export function isConsultingLlmResponse(
  value: unknown,
): value is ConsultingLlmResponse {
  return (
    isRecord(value) &&
    typeof value.outputText === 'string' &&
    value.outputText.length > 0 &&
    value.outputText.length <= 64_000
  );
}

function getResponseError(value: unknown) {
  if (isRecord(value) && typeof value.error === 'string') {
    return value.error;
  }

  return null;
}

export async function requestConsultingLlm(
  request: ConsultingLlmRequest,
  options: { signal: AbortSignal },
) {
  const response = await fetch('/api/consulting/llm', {
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

  if (!isConsultingLlmResponse(data)) {
    throw new Error('언어 모델 응답 형식이 올바르지 않습니다.');
  }

  return data;
}
