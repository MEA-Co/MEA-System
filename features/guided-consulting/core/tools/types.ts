import type {
  GuidedConsultingToolRequest,
  GuidedConsultingToolResponse,
} from '@/features/guided-consulting/core/tools/protocol';

export type GuidedConsultingToolContract = {
  input: unknown;
  output: unknown;
};

export type GuidedConsultingToolSchema<Schema> = {
  [Name in keyof Schema]: GuidedConsultingToolContract;
};

type ToolInput<Schema, Name extends keyof Schema> = Schema[Name] extends {
  input: infer Input;
}
  ? Input
  : never;

type ToolOutput<Schema, Name extends keyof Schema> = Schema[Name] extends {
  output: infer Output;
}
  ? Output
  : never;

export type GuidedConsultingToolEntry<Input, Output> = {
  validateInput?: (input: unknown) => boolean | string;
  validateOutput?: (output: unknown) => boolean | string;
  execute: (
    input: Input,
    options: { signal: AbortSignal },
  ) => Output | Promise<Output>;
};

export type GuidedConsultingToolEntries<Schema> = {
  [Name in keyof Schema]: GuidedConsultingToolEntry<
    ToolInput<Schema, Name>,
    ToolOutput<Schema, Name>
  >;
};

export type GuidedConsultingToolsRuntime = {
  execute: (
    request: GuidedConsultingToolRequest,
    options: { signal: AbortSignal },
  ) => Promise<GuidedConsultingToolResponse>;
};

export type GuidedConsultingTools<Schema> = GuidedConsultingToolsRuntime & {
  ids: ReadonlyArray<Extract<keyof Schema, string>>;
  has: (id: string) => id is Extract<keyof Schema, string>;
};
