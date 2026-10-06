'use client';

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
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [change, setChange] = useState<{
    status: Status;
    requestId: string;
    item: QuestionnaireListItem;
  } | null>(null);
  const current = item.archivedAt ? 'archived' : item.status;
  const canChange = item.isOwner || (item.canDelete && !item.archivedAt);
  const restoring = !!change?.item.archivedAt;
  function canSelect(value: string) {
    if (value === current) return false;
    if (value === 'archived') return canChange && !item.archivedAt;
    if (!item.isOwner) return false;
    if (item.archivedAt) return value === item.status;
    return (
      value === 'draft' ||
      (value === 'published' &&
        (current === 'draft' || current === 'distributed')) ||
      (value === 'distributed' && current === 'published')
    );
  }
  async function apply() {
    if (!change || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const id = toast.add({
      type: 'loading',
      title:
        !restoring && change.status === 'distributed'
          ? '질문지를 배포하고 있어요.'
          : '상태를 변경하고 있어요.',
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
        title:
          !restoring && change.status === 'distributed'
            ? '질문지를 배포했어요.'
            : '질문지 상태를 변경했어요.',
        timeout: 3000,
      });
      setChange(null);
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
          if (value && canSelect(value))
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
            <SelectItem key={value} value={value} disabled={!canSelect(value)}>
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
              {restoring
                ? '질문지 보관을 해제할까요?'
                : change?.status === 'distributed'
                  ? '질문지를 배포할까요?'
                  : change?.item.status === 'distributed' &&
                      (change.status === 'draft' ||
                        change.status === 'published')
                    ? '배포를 취소하고 상태를 되돌릴까요?'
                    : `질문지를 ‘${change ? questionnaireStatusLabels[change.status] : ''}’ 상태로 변경할까요?`}
            </DialogTitle>
            <DialogDescription>
              {restoring
                ? `보관 전 ‘${change ? questionnaireStatusLabels[change.item.status] : ''}’ 상태로 복원합니다.${change?.item.status === 'distributed' ? ' 컨설턴트에게 다시 표시되며 기존 답변을 이어서 작성할 수 있어요.' : ''}`
                : change?.status === 'archived'
                  ? '내용과 기존 답변을 보존하고 컨설턴트에게 숨깁니다. 컨설턴트는 열람하거나 답변을 저장할 수 없으며, 보관 목록에서 다시 복원할 수 있어요.'
                  : change?.item.status === 'distributed' &&
                      (change.status === 'draft' ||
                        change.status === 'published')
                    ? '저장된 응답이 없을 때만 되돌릴 수 있습니다. 컨설턴트 목록에서 숨겨지고 다시 수정할 수 있습니다. 다른 배포본에서 사용 중인 질문은 잠금이 유지됩니다.'
                    : change?.status === 'distributed'
                      ? '배포하면 컨설턴트에게 질문지가 공개됩니다. 배포 이후에는 배포된 질문과 질문지를 수정하거나 삭제할 수 없습니다.'
                      : change?.status === 'published'
                        ? '다른 컨설턴트 리드와 관리자의 대시보드에 표시되며 질문지 내용을 확인할 수 있습니다.'
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
              {restoring
                ? pending
                  ? '복원 중…'
                  : '복원'
                : change?.status === 'distributed'
                  ? pending
                    ? '배포 중…'
                    : '배포'
                  : pending
                    ? '변경 중…'
                    : '변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
