import type {
  ConsultingToolRequest,
  ConsultingToolResponse,
} from '@/features/consulting/core/tools/protocol';

export type ConsultingToolContract = {
  input: unknown;
  output: unknown;
};

export type ConsultingToolSchema<Schema> = {
  [Name in keyof Schema]: ConsultingToolContract;
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

export type ConsultingToolEntry<Input, Output> = {
  validateInput?: (input: unknown) => boolean | string;
  validateOutput?: (output: unknown) => boolean | string;
  execute: (
    input: Input,
    options: { signal: AbortSignal },
  ) => Output | Promise<Output>;
};

export type ConsultingToolEntries<Schema> = {
  [Name in keyof Schema]: ConsultingToolEntry<
    ToolInput<Schema, Name>,
    ToolOutput<Schema, Name>
  >;
};

export type ConsultingToolsRuntime = {
  execute: (
    request: ConsultingToolRequest,
    options: { signal: AbortSignal },
  ) => Promise<ConsultingToolResponse>;
};

export type ConsultingTools<Schema> = ConsultingToolsRuntime & {
  ids: ReadonlyArray<Extract<keyof Schema, string>>;
  has: (id: string) => id is Extract<keyof Schema, string>;
};
