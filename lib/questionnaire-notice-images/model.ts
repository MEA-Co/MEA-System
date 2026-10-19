import { z } from 'zod';

export const NOTICE_IMAGE_BUCKET = 'questionnaire-notice-images';
export const NOTICE_IMAGE_LIMIT = 10;
export const NOTICE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const noticeImageSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(200),
});
export const noticeImagesSchema = z
  .array(noticeImageSchema)
  .max(NOTICE_IMAGE_LIMIT)
  .refine(
    (images) => new Set(images.map((image) => image.id)).size === images.length,
    '같은 사진을 중복 첨부할 수 없어요.',
  );
export type NoticeImage = z.infer<typeof noticeImageSchema>;
export function noticeImagePath(
  questionnaireId: string,
  noticeId: string,
  imageId: string,
) {
  return `${questionnaireId}/${noticeId}/${imageId}.webp`;
}
export function noticeImageUrl(
  questionnaireId: string,
  noticeId: string,
  imageId: string,
) {
  return `/api/questionnaire-notice-images/${questionnaireId}/${noticeId}/${imageId}`;
}
