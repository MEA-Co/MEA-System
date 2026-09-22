'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
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

import { useQuestionnaireApi } from '../lib/api-client';
import type { QuestionDetail } from '../lib/types';

import { QuestionExplanationForm } from './QuestionExplanationForm';
import { RichTextContent } from './RichTextContent';

export function PublishedExplanation({
  detail,
  versionId,
  questionId,
  revision,
  canManage,
  staff,
}: {
  detail: QuestionDetail;
  versionId: string;
  questionId: string;
  revision: number;
  canManage: boolean;
  staff: boolean;
}) {
  const { command } = useQuestionnaireApi();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [deleteRevision, setDeleteRevision] = useState(revision);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const id = toast.add({
      type: 'loading',
      title: '설명을 삭제하고 있어요.',
      timeout: 0,
    });
    try {
      const result = await command(
        `/${versionId}/explanations/${detail.id}`,
        'DELETE',
        { revision: deleteRevision },
      );
      if (result.error) {
        toast.update(id, { type: 'error', title: result.error, timeout: 8000 });
        return;
      }
      setOpen(false);
      toast.update(id, {
        type: 'success',
        title: '설명을 삭제했어요.',
        timeout: 3000,
      });
    } catch {
      toast.update(id, {
        type: 'error',
        title: '삭제 결과를 확인하지 못했어요. 다시 확인해 주세요.',
        timeout: 8000,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 flex-1 whitespace-pre-wrap break-words font-medium">
          {detail.title || '설명'}
        </h4>
        {staff && (
          <Badge
            variant="outline"
            className={`shrink-0 ${detail.visibleToConsultants ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300' : ''}`}
          >
            {detail.visibleToConsultants
              ? '컨설턴트 공개 항목'
              : '컨설턴트 비공개 항목'}
          </Badge>
        )}
      </div>
      {canManage && editing ? (
        <QuestionExplanationForm
          versionId={versionId}
          questionId={questionId}
          count={0}
          detail={detail}
          revision={revision}
          defaultEditing
          onClose={() => setEditing(false)}
        />
      ) : (
        <RichTextContent value={detail.text} className="mt-3 text-sm" />
      )}
      {canManage && !editing && (
        <div className="mt-4 flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={editing || pending}
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden="true" />
            수정
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={editing || pending}
            onClick={() => {
              setDeleteRevision(revision);
              setOpen(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            삭제
          </Button>
        </div>
      )}
      {canManage && (
        <>
          <Dialog
            open={open}
            onOpenChange={(next) => {
              if (!pending) setOpen(next);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>설명을 삭제할까요?</DialogTitle>
                <DialogDescription>
                  ‘{detail.title || '제목 없는 설명'}’의 제목과 내용이 영구
                  삭제됩니다.
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
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => void remove()}
                >
                  {pending ? '삭제 중' : '삭제'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
