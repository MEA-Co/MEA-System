import { z } from 'zod';

export const announcementInput = z
  .object({
    title: z.string().trim().max(100),
    body: z.string().trim().max(1000),
    enabled: z.boolean(),
    color: z.enum(['red', 'yellow', 'green']).optional(),
    starts_at: z.iso.datetime({ offset: true }).nullable(),
    ends_at: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.enabled && (!value.title || !value.body)) {
      ctx.addIssue({ code: 'custom', message: '제목과 내용을 입력해 주세요.' });
    }
    if (
      value.starts_at &&
      value.ends_at &&
      Date.parse(value.ends_at) <= Date.parse(value.starts_at)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '종료 시간은 시작 시간보다 늦어야 합니다.',
      });
    }
  });

export type Announcement = z.infer<typeof announcementInput> & {
  id: number;
  updated_at: string;
};

export function isAnnouncementActive(notice: Announcement, now: number) {
  return (
    notice.enabled &&
    (!notice.starts_at || Date.parse(notice.starts_at) <= now) &&
    (!notice.ends_at || Date.parse(notice.ends_at) > now)
  );
}
