import { z } from 'zod';

import { richTextPlainText } from './rich-text';

const optionSchema = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(500),
  isOther: z.boolean().optional(),
});

const scaleConfigSchema = z.object({
  max: z.number().int().min(2).max(9),
  low: z.string().max(500),
  middle: z.string().max(500),
  high: z.string().max(500),
  allowText: z.boolean(),
});

export const fieldSchema = z
  .object({
    id: z.uuid(),
    label: z.string().trim().min(1).max(100),
    kind: z.enum(['text', 'scale', 'single', 'multiple']),
    options: z.array(optionSchema).max(20).optional(),
    scaleMax: z.number().int().min(2).max(9).optional(),
    scaleConfig: scaleConfigSchema.optional(),
    choiceStyle: z.enum(['list', 'chip']).optional(),
    choiceAllowText: z.boolean().optional(),
  })
  .superRefine((field, context) => {
    if (field.kind === 'single' || field.kind === 'multiple') {
      if (!field.options || field.options.length < 2) {
        context.addIssue({
          code: 'custom',
          message: '선택지는 두 개 이상 필요해요.',
        });
      }
      const ids = field.options?.map((option) => option.id) ?? [];
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: 'custom',
          message: '선택지 ID가 중복됐어요.',
        });
      }
      const labels =
        field.options?.map((option) =>
          option.label.trim().toLocaleLowerCase(),
        ) ?? [];
      if (new Set(labels).size !== labels.length) {
        context.addIssue({
          code: 'custom',
          message: '서로 다른 선택지 이름을 써 주세요.',
        });
      }
      if (
        field.kind === 'single' &&
        (field.options?.filter((option) => option.isOther).length ?? 0) > 1
      ) {
        context.addIssue({
          code: 'custom',
          message: '단일선택형의 직접 입력 항목은 하나만 둘 수 있어요.',
        });
      }
    }
    if (field.kind === 'scale' && !field.scaleMax) {
      context.addIssue({ code: 'custom', message: '척도 점수를 정해 주세요.' });
    }
    if (
      field.kind === 'scale' &&
      field.scaleConfig &&
      field.scaleConfig.max !== field.scaleMax
    ) {
      context.addIssue({
        code: 'custom',
        message: '척도 설정을 확인해 주세요.',
      });
    }
  });

export const clauseSchema = z
  .object({
    blockId: z.uuid(),
    fieldId: z.uuid().optional(),
    op: z.enum(['answered', 'equals', 'includes', 'gte', 'lte']),
    value: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine((clause, context) => {
    if (
      clause.op !== 'answered' &&
      (!clause.fieldId || clause.value === undefined || clause.value === '')
    ) {
      context.addIssue({
        code: 'custom',
        message: '조건의 비교값을 정해 주세요.',
      });
    }
  });

export const questionBlockSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().max(200).default(''),
    prompt: z.string().max(10000),
    details: z
      .array(
        z.object({
          id: z.uuid(),
          title: z.string().max(200),
          text: z.string().max(10000),
          visibleToConsultants: z.boolean(),
        }),
      )
      .max(20)
      .optional(),
    fields: z.array(fieldSchema).min(1).max(20),
    rowMode: z.enum(['single', 'repeatable', 'reference']),
    maxRows: z.number().int().min(1).max(20).nullable(),
    sourceBlockId: z.uuid().nullable(),
    sourceFieldId: z.uuid().nullable(),
    afterBlockId: z.uuid().nullable(),
    condition: z
      .object({
        mode: z.enum(['all', 'any']),
        clauses: z.array(clauseSchema).min(1).max(10),
      })
      .nullable(),
  })
  .superRefine((block, context) => {
    if (!richTextPlainText(block.prompt).trim()) {
      context.addIssue({ code: 'custom', message: '질문을 입력해 주세요.' });
    }
    const ids = block.fields.map((field) => field.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: '답변 열 ID가 중복됐어요.' });
    }
    if (block.rowMode === 'repeatable' && block.maxRows === null) {
      context.addIssue({
        code: 'custom',
        message: '최대 행 수를 정해 주세요.',
      });
    }
    if (block.rowMode === 'reference' && !block.sourceBlockId) {
      context.addIssue({
        code: 'custom',
        message: '참조할 질문을 정해 주세요.',
      });
    }
    if (
      block.rowMode === 'reference' &&
      !block.sourceFieldId &&
      !block.condition?.clauses.some(
        (clause) =>
          clause.blockId === block.sourceBlockId &&
          (clause.op === 'answered' ||
            ((clause.op === 'equals' || clause.op === 'includes') &&
              !!clause.fieldId &&
              typeof clause.value === 'string')),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: '참조할 질문의 응답 조건을 설정해 주세요.',
      });
    }
    if (
      block.rowMode !== 'reference' &&
      (block.sourceBlockId || block.sourceFieldId)
    ) {
      context.addIssue({
        code: 'custom',
        message: '참조 설정을 확인해 주세요.',
      });
    }
    if (block.rowMode !== 'repeatable' && block.maxRows !== null) {
      context.addIssue({ code: 'custom', message: '행 설정을 확인해 주세요.' });
    }
    if (block.afterBlockId === block.id || block.sourceBlockId === block.id) {
      context.addIssue({
        code: 'custom',
        message: '자기 자신은 참조할 수 없어요.',
      });
    }
    if (
      block.condition?.clauses.some((clause) => clause.blockId === block.id)
    ) {
      context.addIssue({
        code: 'custom',
        message: '자기 자신으로 조건을 만들 수 없어요.',
      });
    }
  });

export type QuestionBlockDocument = z.infer<typeof questionBlockSchema>;
export type QuestionBlockField = QuestionBlockDocument['fields'][number];
export type QuestionBlockClause = NonNullable<
  QuestionBlockDocument['condition']
>['clauses'][number];

export type QuestionBlockRow = {
  id: string;
  created_by: string;
  title: string;
  prompt: string;
  details?: {
    id: string;
    title: string;
    text: string;
    visibleToConsultants: boolean;
    position?: number;
  }[];
  fields: QuestionBlockField[];
  row_mode: QuestionBlockDocument['rowMode'];
  max_rows: number | null;
  source_block_id: string | null;
  source_field_id: string | null;
  after_block_id: string | null;
  condition: QuestionBlockDocument['condition'];
  revision: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export function questionName(question: {
  title: string;
  prompt: string;
}): string {
  return (
    question.title.trim() ||
    richTextPlainText(question.prompt).trim() ||
    '제목 없는 질문'
  );
}

export function documentFromRow(row: QuestionBlockRow): QuestionBlockDocument {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    details: [...(row.details ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map(({ id, title, text, visibleToConsultants }) => ({
        id,
        title,
        text,
        visibleToConsultants,
      })),
    fields: row.fields,
    rowMode: row.row_mode,
    maxRows: row.max_rows,
    sourceBlockId: row.source_block_id,
    sourceFieldId: row.source_field_id,
    afterBlockId: row.after_block_id,
    condition: row.condition,
  };
}

export function emptyQuestionBlock(): QuestionBlockDocument {
  return {
    id: crypto.randomUUID(),
    title: '',
    prompt: '',
    details: [],
    fields: [{ id: crypto.randomUUID(), label: '답변', kind: 'text' }],
    rowMode: 'single',
    maxRows: null,
    sourceBlockId: null,
    sourceFieldId: null,
    afterBlockId: null,
    condition: null,
  };
}
