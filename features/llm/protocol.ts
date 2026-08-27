export const LLM_MODELS = ['gpt-5-nano', 'gpt-5.4-nano'] as const;

export type LlmModel = (typeof LLM_MODELS)[number];

export type LlmJsonSchemaFormat = {
  type: 'json_schema';
  name: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type LlmRequest = {
  model: LlmModel;
  instructions: string;
  input: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  text?: {
    format?: LlmJsonSchemaFormat;
    verbosity?: 'low' | 'medium' | 'high';
  };
  webSearch?: {
    searchContextSize?: 'low' | 'medium' | 'high';
    required?: boolean;
  };
};

export type LlmResponse = {
  outputText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonSchemaFormat(value: unknown): value is LlmJsonSchemaFormat {
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

function isTextConfig(value: unknown): value is LlmRequest['text'] {
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

function isWebSearchConfig(value: unknown): value is LlmRequest['webSearch'] {
  if (!isRecord(value)) return false;

  const searchContextSize = value.searchContextSize;
  return (
    (searchContextSize === undefined ||
      searchContextSize === 'low' ||
      searchContextSize === 'medium' ||
      searchContextSize === 'high') &&
    (value.required === undefined || typeof value.required === 'boolean')
  );
}

export function isLlmRequest(value: unknown): value is LlmRequest {
  if (!isRecord(value)) return false;

  const reasoningEffort = value.reasoningEffort;
  return (
    typeof value.model === 'string' &&
    LLM_MODELS.includes(value.model as LlmModel) &&
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
        value.maxOutputTokens <= 16_000)) &&
    (value.text === undefined || isTextConfig(value.text)) &&
    (value.webSearch === undefined || isWebSearchConfig(value.webSearch))
  );
}

export function isLlmResponse(value: unknown): value is LlmResponse {
  return (
    isRecord(value) &&
    typeof value.outputText === 'string' &&
    value.outputText.length > 0 &&
    value.outputText.length <= 64_000
  );
}
