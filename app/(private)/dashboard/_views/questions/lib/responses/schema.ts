import { z } from 'zod';

export const questionResponseSaveSchema = z
  .object({
    answers: z.record(
      z.uuid(),
      z
        .array(
          z
            .object({
              id: z.number().int().safe(),
              answers: z.record(z.uuid(), z.string().max(20000)),
              flowIndex: z.number().int().min(1).max(20).optional(),
              flowAfter: z.number().int().min(1).max(20).optional(),
              label: z.string().max(100).optional(),
            })
            .strict()
            .refine(
              (row) =>
                !(row.flowIndex !== undefined && row.flowAfter !== undefined) &&
                (row.label === undefined || row.flowAfter !== undefined),
            ),
        )
        .max(20),
    ),
    revision: z.number().int().nonnegative(),
    saveId: z.uuid(),
    complete: z.boolean(),
    definitionToken: z.string().length(32),
  })
  .strict();
