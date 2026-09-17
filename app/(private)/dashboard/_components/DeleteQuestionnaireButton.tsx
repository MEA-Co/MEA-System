'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';

import { deleteQuestionnaire } from '../_actions/delete-questionnaire';

export function DeleteQuestionnaireButton({
  versionId,
  revision,
  title,
  hasPublished,
}: {
  versionId: string;
  revision: number;
  title: string;
  hasPublished: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = title || '제목 없는 질문지';

  function remove() {
    if (pending) return;
    setError(null);
    const toastId = toast.add({
      type: 'loading',
      title: '질문지를 삭제하고 있어요.',
      timeout: 0,
    });
    startTransition(async () => {
      try {
        const result = await deleteQuestionnaire({ versionId, revision });
        if (result.error) {
          setError(result.error);
          toast.update(toastId, {
            type: 'error',
            title: result.error,
            timeout: 7000,
          });
          return;
        }
        setOpen(false);
        toast.update(toastId, {
          type: 'success',
          title:
            result.mode === 'archived'
              ? '질문지를 목록에서 삭제했어요. 발행된 내용과 답변은 보존됩니다.'
              : '질문지를 완전히 삭제했어요.',
          timeout: 3000,
        });
      } catch {
        const message =
          '삭제 결과를 확인하지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요.';
        setError(message);
        toast.update(toastId, { type: 'error', title: message, timeout: 7000 });
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="mr-4 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`${label} 삭제`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>질문지를 삭제할까요?</DialogTitle>
            <DialogDescription className="wrap-break-word">
              {hasPublished
                ? `‘${label}’ 질문지를 목록에서 제거합니다.`
                : `삭제 후 복구할 수 없습니다.`}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              {pending ? '삭제 중' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
