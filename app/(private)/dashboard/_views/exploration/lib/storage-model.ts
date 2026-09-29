import { z } from 'zod';

import type { Activity } from './fields';

export const REPORT_BUCKET = 'exploration-reports';
export const MAX_REPORT_SIZE = 20 * 1024 * 1024;
export const MAX_REPORTS = 10;
export const reportExtension = /\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$/i;
const text = z.string().max(50000);
export const valuesSchema = z
  .object({
    grade: z.enum(['', '1', '2', '3']),
    semester: z.enum(['', '1', '2']),
    recordType: z.enum(['', '창체', '세특']),
    recordArea: text,
    schoolContext: text,
    topic: text,
    record: text,
    competencies: text,
    motivation: text,
    story: text,
    result: text,
    followup: text,
    references: z
      .array(
        z.object({
          clientKey: z.uuid(),
          title: text,
          selection: text,
          usage: text,
        }),
      )
      .max(100),
  })
  .strict();
export const reportSchema = z
  .object({
    clientKey: z.uuid(),
    name: z.string().min(1).max(255).regex(reportExtension),
    size: z.number().int().min(1).max(MAX_REPORT_SIZE),
    type: z.string().max(200),
    lastModified: z.number().int().nonnegative(),
    path: z.string().max(300).optional(),
  })
  .strict();
export const localActivitySchema = z
  .object({
    clientKey: z.uuid(),
    revision: z.number().int().nonnegative(),
    status: z.literal('draft'),
    ownerId: z.uuid().optional(),
    ownerName: z.string().optional(),
    updatedAt: z.iso.datetime(),
    localVersion: z.uuid(),
    values: valuesSchema,
    reports: z.array(reportSchema).max(MAX_REPORTS),
  })
  .strict();
export const requiredFields = {
  grade: '학년',
  semester: '학기',
  recordType: '기재 유형',
  recordArea: '활동 영역 또는 과목명',
  schoolContext: '교내/과목 맥락',
  topic: '탐구 주제',
  record: '탐구 내용',
  competencies: '탐구의 주안점',
  motivation: '기획',
  story: '수행',
  result: '결과',
} as const;
export function missingFields(values: Activity['values']) {
  return Object.entries(requiredFields).filter(
    ([key]) => !values[key as keyof typeof requiredFields].trim(),
  );
}
export function hasInput(activity: Activity) {
  return (
    Object.entries(activity.values).some(([key, value]) =>
      key === 'references'
        ? activity.values.references.some((item) =>
            [item.title, item.selection, item.usage].some((s) => s.trim()),
          )
        : typeof value === 'string' && !!value.trim(),
    ) || !!activity.reports?.length
  );
}
export function activityFingerprint(activity: Activity) {
  return JSON.stringify({
    values: activity.values,
    reports: (activity.reports ?? []).map(
      ({ file: _file, ...report }) => report,
    ),
  });
}
export const confirmRequestSchema = z
  .object({
    id: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    saveId: z.uuid(),
    values: valuesSchema,
    reports: z
      .array(reportSchema.extend({ path: z.string().min(1).max(300) }))
      .max(MAX_REPORTS),
  })
  .strict()
  .superRefine(({ values, reports }, ctx) => {
    for (const [key, label] of missingFields(values))
      ctx.addIssue({
        code: 'custom',
        path: ['values', key],
        message: `${label}을 입력해 주세요.`,
      });
    if (
      values.recordType === '창체' &&
      !['자율·자치활동', '동아리활동', '진로활동'].includes(values.recordArea)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['values', 'recordArea'],
        message: '활동 영역을 선택해 주세요.',
      });
    if (new Set(reports.map((r) => r.path)).size !== reports.length)
      ctx.addIssue({
        code: 'custom',
        path: ['reports'],
        message: '첨부 파일이 중복되었습니다.',
      });
  });
export type ActivityRow = {
  id: string;
  owner_id: string;
  owner?: { name: string } | null;
  values: Activity['values'];
  reports: z.infer<typeof reportSchema>[];
  revision: number;
  updated_at: string;
  save_id: string;
  deleted_at: string | null;
};
export function fromRow(row: ActivityRow): Activity {
  return {
    clientKey: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner?.name ?? undefined,
    values: row.values,
    reports: row.reports,
    revision: row.revision,
    updatedAt: row.updated_at,
    status: 'confirmed',
  };
}
