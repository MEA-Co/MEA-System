import type {
  ValidateTenNumbersToolInput,
  ValidateTenNumbersToolOutput,
} from '@/app/(private)/consulting/guided-demo/_lib/types';
import type { GuidedConsultingToolEntry } from '@/features/guided-consulting/core/tools';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseTenNumbers(value: string) {
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const numbers = tokens.map(Number);

  if (
    numbers.length !== 10 ||
    numbers.some((number) => !Number.isFinite(number))
  ) {
    throw new Error('쉼표나 공백으로 구분한 숫자 10개를 입력해 주세요.');
  }

  return numbers;
}

function validateInput(value: unknown) {
  if (!isRecord(value) || typeof value.value !== 'string') {
    return '검증할 문자열이 필요합니다.';
  }

  try {
    parseTenNumbers(value.value);
    return true;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : '숫자 10개를 입력해 주세요.';
  }
}

function validateOutput(value: unknown): value is ValidateTenNumbersToolOutput {
  return isRecord(value) && typeof value.normalized === 'string';
}

export const validateTenNumbersTool = {
  validateInput,
  validateOutput,
  execute: ({ value }) => ({
    normalized: parseTenNumbers(value).join(', '),
  }),
} satisfies GuidedConsultingToolEntry<
  ValidateTenNumbersToolInput,
  ValidateTenNumbersToolOutput
>;
