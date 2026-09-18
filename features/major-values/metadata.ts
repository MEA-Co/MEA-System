import { z } from 'zod';

const uuid = z.string().uuid();
const base = z.object({ id: uuid, name: z.string(), description: z.string() });
const coreValue = base.extend({
  code: z.string(),
  lens_type: z.string(),
  synonyms: z.array(z.string()),
  distinction_notes: z.string(),
});
const item = base.extend({ content_version: z.string() });
const effective = item.extend({
  major_id: uuid,
  source_scope: z.enum(['field', 'major']),
  relation: z.enum(['inherit', 'refine', 'add']),
  parent_id: uuid.nullable(),
});
export const metadataSchema = z.object({
  metadata_version: z.string(),
  purpose: z.literal('dialogue_material_not_student_classification'),
  majors: z
    .array(
      z.object({
        major: base,
        field: base,
        disciplinary_perspective: z.object({
          id: uuid,
          description: z.string(),
          content_version: z.string(),
        }),
        inquiry_dimensions: z.array(
          item.extend({ usage_guidance: z.string() }),
        ),
        thinking_modes: z.array(effective),
        value_lenses: z.array(
          effective.extend({
            lens_type: z.string(),
            applies_to: z.string(),
            question_guidance: z.string(),
            interpretation_caution: z.string(),
            core_value_references: z.array(coreValue),
          }),
        ),
        value_tensions: z.array(
          z.object({
            id: uuid,
            major_id: uuid,
            source_scope: z.enum(['field', 'major']),
            relation: z.enum(['inherit', 'refine', 'add']),
            parent_id: uuid.nullable(),
            side_a: z.string(),
            side_b: z.string(),
            description: z.string(),
            context: z.string(),
            content_version: z.string(),
          }),
        ),
        keywords: z.array(
          base.extend({
            examples: z.array(z.object({ id: uuid, label: z.string() })),
          }),
        ),
      }),
    )
    .min(1)
    .max(3),
});
export type ValuesMetadata = z.infer<typeof metadataSchema>;
export function metadataReferences(metadata: ValuesMetadata) {
  return {
    version: metadata.metadata_version,
    coreValueIds: [
      ...new Set(
        metadata.majors.flatMap((m) =>
          m.value_lenses.flatMap((l) =>
            l.core_value_references.map((c) => c.id),
          ),
        ),
      ),
    ],
    metadataIds: [
      ...new Set(
        metadata.majors.flatMap((m) => [
          m.disciplinary_perspective.id,
          ...[
            ...m.inquiry_dimensions,
            ...m.thinking_modes,
            ...m.value_lenses,
            ...m.value_tensions,
          ].map((i) => i.id),
        ]),
      ),
    ],
  };
}
