import sharp from 'sharp';

import { NOTICE_IMAGE_MAX_BYTES } from './model';

export async function processNoticeImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > NOTICE_IMAGE_MAX_BYTES)
    throw new Error('Invalid image size');
  const image = sharp(bytes, {
    limitInputPixels: 40_000_000,
    failOn: 'warning',
  });
  const metadata = await image.metadata();
  if (
    !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
    (metadata.pages ?? 1) > 1
  )
    throw new Error('Invalid image format');
  const output = await image
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  if (output.length > NOTICE_IMAGE_MAX_BYTES)
    throw new Error('Image too large');
  return output;
}
