'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

import { useQuestionnaireApi } from '../../lib/questionnaire/api-client';
import type { QuestionnaireListItem } from '../../lib/questionnaire/types';

import { questionnaireStatusColors } from './questionnaire-styles';

export const questionnaireStatusLabels = {
  draft: '수정 중',
  published: '게시',
  distributed: '배포',
  archived: '보관',
} as const;
type Status = keyof typeof questionnaireStatusLabels;
export function QuestionnaireStatusSelect({
  item,
}: {
  item: QuestionnaireListItem;
}) {
  const { command, refresh } = useQuestionnaireApi();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [change, setChange] = useState<{
    status: Status;
    requestId: string;
    item: QuestionnaireListItem;
  } | null>(null);
  const current = item.archivedAt ? 'archived' : item.status;
  const canChange = item.isOwner || (item.canDelete && !item.archivedAt);
  async function apply() {
    if (!change || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const id = toast.add({
      type: 'loading',
      title: '상태를 변경하고 있어요.',
      timeout: 0,
    });
    try {
      const result = await command(`/${item.id}/status`, 'PATCH', {
        revision: change.item.revision,
        expectedStatus: change.item.status,
        archivedAt: change.item.archivedAt ?? null,
        status: change.status,
        requestId: change.requestId,
      });
      if (result.error) {
        toast.update(id, { type: 'error', title: result.error, timeout: 8000 });
        setChange(null);
        void refresh().catch(() => {});
        return;
      }
      toast.update(id, {
        type: 'success',
        title: result.copied
          ? '기존 배포본을 유지하고 수정용 초안을 만들었어요.'
          : '질문지 상태를 변경했어요.',
        timeout: 3000,
      });
      setChange(null);
      if (result.copied && result.versionId)
        router.push(
          `/dashboard?view=questions&tab=questionnaires&draft=${result.versionId}`,
        );
    } catch {
      // Keep the request ID for a retry after an uncertain network result.
      toast.update(id, {
        type: 'error',
        title: '변경 결과를 확인하지 못했어요. 다시 시도해 주세요.',
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <Select
        value={current}
        disabled={!canChange || pending}
        onValueChange={(value) => {
          if (value === 'draft' && value !== current)
            setChange({
              status: value as Status,
              requestId: crypto.randomUUID(),
              item,
            });
        }}
      >
        <SelectTrigger
          size="sm"
          className={`min-w-28 ${questionnaireStatusColors[current]}`}
          aria-label={`${item.title || '제목 없는 질문지'} 상태`}
        >
          <SelectValue>{questionnaireStatusLabels[current]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(questionnaireStatusLabels).map(([value, label]) => (
            <SelectItem
              key={value}
              value={value}
              disabled={value !== 'draft' || !item.isOwner}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={!!change}
        onOpenChange={(open) => {
          if (!open && !pending) setChange(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {change?.status === 'draft' &&
              change.item.status === 'distributed'
                ? '수정용 초안을 만들까요?'
                : `질문지를 ‘${change ? questionnaireStatusLabels[change.status] : ''}’ 상태로 변경할까요?`}
            </DialogTitle>
            <DialogDescription>
              {change?.status === 'archived'
                ? '내용과 기존 답변을 보존하고 컨설턴트 목록에서 숨깁니다. 보관 목록에서 다시 복원할 수 있어요.'
                : change?.status === 'draft' &&
                    change.item.status === 'distributed'
                  ? '기존 배포본과 답변은 그대로 유지합니다. 같은 질문과 설명으로 새 초안을 만들고 편집 화면을 엽니다.'
                  : change?.status === 'distributed'
                    ? '컨설턴트에게 질문지가 표시됩니다. 배포된 내용은 고정되며 이후 수정은 새 초안에서 진행합니다.'
                    : change?.status === 'published'
                      ? '다른 리드와 관리자가 내용을 확인하고 검토 요청을 남길 수 있습니다.'
                      : '작성자의 수정 중 목록으로 이동합니다. 기존 질문과 설명은 유지됩니다.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setChange(null)}
            >
              취소
            </Button>
            <Button disabled={pending} onClick={() => void apply()}>
              {pending ? '변경 중…' : '변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
