export type GuidedConsultingToolContract = {
  input: unknown;
  output: unknown;
};

export type GuidedConsultingToolSchema<Schema> = {
  [Name in keyof Schema]: GuidedConsultingToolContract;
};

type GuidedConsultingToolHandlers<Schema> = {
  [Name in keyof Schema]: (
    input: Schema[Name] extends { input: infer Input } ? Input : never,
    options: { signal: AbortSignal },
  ) =>
    | (Schema[Name] extends { output: infer Output } ? Output : never)
    | Promise<Schema[Name] extends { output: infer Output } ? Output : never>;
};

export type GuidedConsultingTools<Schema> = {
  ids: ReadonlyArray<Extract<keyof Schema, string>>;
  has: (id: string) => id is Extract<keyof Schema, string>;
  execute: <Name extends Extract<keyof Schema, string>>(
    name: Name,
    input: Schema[Name] extends { input: infer Input } ? Input : never,
    options: { signal: AbortSignal },
  ) => Promise<Schema[Name] extends { output: infer Output } ? Output : never>;
};

export function createGuidedConsultingTools<
  Schema extends GuidedConsultingToolSchema<Schema>,
>(
  handlers: GuidedConsultingToolHandlers<Schema>,
): GuidedConsultingTools<Schema> {
  const registry = new Map(
    Object.entries(handlers) as Array<
      [string, GuidedConsultingToolHandlers<Schema>[keyof Schema]]
    >,
  );
  const ids = Object.freeze([...registry.keys()]) as ReadonlyArray<
    Extract<keyof Schema, string>
  >;

  return {
    ids,
    has: (id): id is Extract<keyof Schema, string> => registry.has(id),
    execute: async (name, input, options) => {
      if (options.signal.aborted) {
        throw new DOMException('요청이 취소되었습니다.', 'AbortError');
      }

      const handler = registry.get(name);
      if (!handler) throw new Error(`Tool을 찾을 수 없습니다: ${name}`);

      return handler(input, options) as Promise<
        Schema[typeof name] extends { output: infer Output } ? Output : never
      >;
    },
  };
}
