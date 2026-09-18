'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

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

import {
  distributeQuestionnaire,
  publishQuestionnaire,
} from '../actions/publish-questionnaire';

export function PublishQuestionnaireButton({
  versionId,
  revision,
  title,
  mode = 'publish',
}: {
  versionId: string;
  revision: number;
  title: string;
  mode?: 'publish' | 'distribute';
}) {
  const label = mode === 'publish' ? '게시' : '배포';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  async function publish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const id = toast.add({
      type: 'loading',
      title: `질문지를 ${label}하고 있어요.`,
      timeout: 0,
    });
    try {
      const action =
        mode === 'publish' ? publishQuestionnaire : distributeQuestionnaire;
      const result = await action({ versionId, revision });
      if (result.error) {
        toast.update(id, { type: 'error', title: result.error, timeout: 8000 });
        return;
      }
      toast.update(id, {
        type: 'success',
        title: `질문지를 ${label}했어요.`,
        timeout: 3000,
      });
      setOpen(false);
      router.refresh();
    } catch {
      toast.update(id, {
        type: 'error',
        title: `${label} 결과를 확인하지 못했어요. 목록을 새로고침해 주세요.`,
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send aria-hidden="true" />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>질문지를 {label}할까요?</DialogTitle>
            <DialogDescription>
              ‘{title || '제목 없는 질문지'}’의 저장된 내용을 {label}합니다.{' '}
              {mode === 'publish'
                ? '게시 후에도 작성자는 수정할 수 있고, 다른 리드와 관리자는 내용을 확인하고 검토 요청을 남길 수 있어요.'
                : '배포 후에는 수정할 수 없으며, 컨설턴트에게 질문과 공개 설명이 표시돼요.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button disabled={pending} onClick={() => void publish()}>
              {pending ? `${label} 중` : label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
