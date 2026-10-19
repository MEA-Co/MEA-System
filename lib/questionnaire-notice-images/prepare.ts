import { NOTICE_IMAGE_MAX_BYTES } from './model';

/** Compress before sending so large camera photos do not fill the request body. */
export async function prepareNoticeImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.');
  if (file.size > 15 * 1024 * 1024)
    throw new Error('사진 한 장은 15MB 이하로 선택해 주세요.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000)
      throw new Error(
        '사진 해상도가 너무 커요. 크기를 줄여 다시 첨부해 주세요.',
      );
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('사진을 처리하지 못했어요. 다시 시도해 주세요.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error('사진을 처리하지 못했어요.')),
        'image/webp',
        0.85,
      ),
    );
    if (blob.size > NOTICE_IMAGE_MAX_BYTES || blob.type !== 'image/webp')
      throw new Error('사진 용량을 더 줄인 뒤 다시 첨부해 주세요.');
    return blob;
  } finally {
    bitmap.close();
  }
}
