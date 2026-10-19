'use client';

import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ImageGallery } from '@/components/ui/image-gallery';
import { toast } from '@/components/ui/toast';
import {
  NOTICE_IMAGE_LIMIT,
  type NoticeImage,
  noticeImageUrl,
} from '@/lib/questionnaire-notice-images/model';
import { prepareNoticeImage } from '@/lib/questionnaire-notice-images/prepare';

import { QUESTIONNAIRE_HEADERS } from '../../lib/questionnaire/api-client';

export function QuestionnaireNoticeImages({
  questionnaireId,
  noticeId,
  images,
  disabled,
  beforeUpload,
  onChange,
  onBusyChange,
}: {
  questionnaireId: string;
  noticeId: string;
  images: NoticeImage[];
  disabled: boolean;
  beforeUpload: () => Promise<boolean>;
  onChange: (images: NoticeImage[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  async function upload(files: File[]) {
    if (!files.length || disabled || lock.current) return;
    if (images.length + files.length > NOTICE_IMAGE_LIMIT) {
      toast.add({
        type: 'error',
        title: `안내 하나에 사진은 ${NOTICE_IMAGE_LIMIT}장까지 첨부할 수 있어요.`,
      });
      return;
    }
    lock.current = true;
    setUploading(true);
    onBusyChange(true);
    const added: NoticeImage[] = [];
    try {
      if (!(await beforeUpload())) {
        toast.add({
          type: 'error',
          title: '사진을 첨부하려면 질문지를 먼저 저장해야 해요.',
          description: '질문지 제목과 저장 상태를 확인해 주세요.',
        });
        return;
      }
      for (const file of files) {
        if (!mounted.current) break;
        const blob = await prepareNoticeImage(file);
        if (!mounted.current) break;
        const id = crypto.randomUUID();
        const controller = new AbortController();
        abort.current = controller;
        const timer = setTimeout(() => controller.abort(), 60_000);
        try {
          const response = await fetch(
            noticeImageUrl(questionnaireId, noticeId, id),
            {
              method: 'PUT',
              headers: {
                ...QUESTIONNAIRE_HEADERS,
                'Content-Type': 'image/webp',
              },
              body: blob,
              signal: controller.signal,
            },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error ?? '사진을 첨부하지 못했어요.');
          added.push({ id, name: file.name.slice(0, 200) || '첨부 사진' });
        } finally {
          clearTimeout(timer);
          abort.current = null;
        }
      }
    } catch (error) {
      if (mounted.current)
        toast.add({
          type: 'error',
          title:
            error instanceof Error && error.name !== 'AbortError'
              ? error.message
              : '사진 첨부 시간이 초과되었어요. 다시 시도해 주세요.',
        });
    } finally {
      if (mounted.current) {
        if (added.length) onChange([...images, ...added]);
        setUploading(false);
        onBusyChange(false);
      }
      lock.current = false;
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">
          사진{' '}
          <span className="text-muted-foreground">
            {images.length}/{NOTICE_IMAGE_LIMIT}
          </span>
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={
            disabled || uploading || images.length >= NOTICE_IMAGE_LIMIT
          }
          onClick={() => input.current?.click()}
        >
          {uploading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ImagePlus />
          )}
          {uploading ? '사진 첨부 중…' : '사진 첨부'}
        </Button>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label="안내 사진 선택"
          disabled={disabled || uploading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void upload(files);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP · 장당 15MB 이하 · 여러 장은 넘겨 볼 수 있어요.
      </p>
      {images.length > 0 && (
        <>
          <ImageGallery
            images={images.map((image) => ({
              id: image.id,
              src: noticeImageUrl(questionnaireId, noticeId, image.id),
              alt: image.name,
            }))}
            label="안내 사진"
          />
          <ol className="space-y-1">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs">
                  {index + 1}. {image.name}
                </span>
                {[-1, 1].map((direction) => (
                  <Button
                    key={direction}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${index + 1}번째 사진 ${direction < 0 ? '앞으로' : '뒤로'} 이동`}
                    disabled={
                      disabled ||
                      uploading ||
                      index + direction < 0 ||
                      index + direction >= images.length
                    }
                    onClick={() => {
                      const next = [...images];
                      [next[index], next[index + direction]] = [
                        next[index + direction],
                        next[index],
                      ];
                      onChange(next);
                    }}
                  >
                    {direction < 0 ? <ArrowLeft /> : <ArrowRight />}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${index + 1}번째 사진 제거`}
                  disabled={disabled || uploading}
                  onClick={() =>
                    onChange(images.filter((item) => item.id !== image.id))
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
