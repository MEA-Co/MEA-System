'use client';

import { BookOpen, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { CollectionHeader } from '@/components/patterns/collection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { type Exploration } from '@/lib/exploration/fields';
import { hasInput, missingFields } from '@/lib/exploration/storage-model';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { ExplorationDetails } from './components/ExplorationDetails';
import { ExplorationFields } from './components/ExplorationFields';
import { ExplorationReferencesInput } from './components/ExplorationReferencesInput';
import { ExplorationReportInput } from './components/ExplorationReportInput';
import { ExplorationSelectList } from './components/ExplorationSelectList';
import { ExplorationTable } from './components/ExplorationTable';
import { useExplorationStorage } from './hooks/useExplorationStorage';
import { exampleExplorationValues } from './lib/example-exploration';

export function ExplorationView({
  userId,
  canViewOthers = false,
  onSelect,
  onEditorOpenChange,
}: {
  userId: string;
  canViewOthers?: boolean;
  onSelect?: (activity: Exploration) => void;
  onEditorOpenChange?: (open: boolean) => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const continueWritingRef = useRef<HTMLButtonElement | null>(null);
  const {
    local,
    draft,
    setDraft,
    busy,
    dirty,
    ready,
    localError,
    create,
    open,
    saveLocal,
    confirm,
    remove,
  } = useExplorationStorage(userId, !onSelect);
  useEffect(() => {
    onEditorOpenChange?.(!!draft);
  }, [draft, onEditorOpenChange]);
  const [pendingDelete, setPendingDelete] = useState<Exploration | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const readOnly =
    (!!draft?.ownerId && draft.ownerId !== userId) ||
    (!!onSelect && draft?.status === 'confirmed');
  const existing = draft && draft.revision > 0;
  function returnToList() {
    if (busy || confirmDiscard) return;
    if (dirty) setConfirmDiscard(true);
    else {
      setConfirmDiscard(false);
      setDraft(null);
    }
  }

  return (
    <section
      aria-labelledby={onSelect ? undefined : 'exploration-management-title'}
      aria-label={onSelect ? '탐구활동 목록' : undefined}
      className={onSelect ? 'space-y-2' : 'space-y-6'}
    >
      {!onSelect && (
        <CollectionHeader
          id="exploration-management-title"
          category={<DashboardPageCategory view="exploration" />}
          title="탐구활동 관리"
          description="나의 탐구 경험을 기록하고, 필요한 답변에 연결하세요."
          action={
            <Button
              type="button"
              disabled={!ready || busy}
              aria-label="탐구활동 추가"
              onClick={(event) => {
                opener.current = event.currentTarget;
                create();
              }}
            >
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">탐구활동 추가</span>
              <span className="sm:hidden">추가</span>
            </Button>
          }
        />
      )}
      {localError && (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      )}
      <Drawer
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) returnToList();
        }}
      >
        <DrawerContent
          className="h-dvh max-h-dvh rounded-none md:w-[min(1200px,94vw)] md:max-w-none"
          finalFocus={() => opener.current}
        >
          <DrawerHeader className="shrink-0 border-b px-4 py-5 pr-14 md:px-6 md:pr-14">
            <DrawerTitle className="text-xl font-extrabold">
              {readOnly
                ? '탐구활동 상세'
                : existing
                  ? '탐구활동 상세 · 수정'
                  : '탐구활동 추가'}
            </DrawerTitle>
            <DrawerDescription>
              탐구의 맥락부터 과정과 성장까지, 나의 탐구 경험을 기록하세요.
            </DrawerDescription>
          </DrawerHeader>
          <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
            <AlertDialogContent initialFocus={continueWritingRef}>
              <AlertDialogHeader>
                <AlertDialogTitle>작성을 취소할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  저장하지 않은 변경 내용이 사라집니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel ref={continueWritingRef}>
                  계속 작성
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setConfirmDiscard(false);
                    setDraft(null);
                  }}
                >
                  변경 내용 버리기
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {draft && readOnly && (
            <ExplorationDetails
              activity={draft}
              notice={
                draft.ownerId && draft.ownerId !== userId
                  ? '다른 작성자의 탐구활동입니다. 읽기 전용으로 표시됩니다.'
                  : '첨부할 탐구활동을 미리 보고 있습니다. 읽기 전용으로 표시됩니다.'
              }
              onClose={returnToList}
            />
          )}
          {draft && !readOnly && (
            <form
              noValidate
              inert={confirmDiscard}
              style={confirmDiscard ? { overflow: 'hidden' } : undefined}
              className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4 md:px-6 md:pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              <fieldset
                disabled={busy || confirmDiscard}
                className="min-w-0 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    * 표시된 항목은 필수입니다.
                  </p>
                  {!existing && (
                    <Button
                      type="button"
                      size="lg"
                      title="입력 항목을 예시 탐구 내용으로 채웁니다."
                      onClick={() =>
                        setDraft({
                          ...draft,
                          values: {
                            ...draft.values,
                            ...exampleExplorationValues,
                          },
                        })
                      }
                    >
                      <BookOpen aria-hidden="true" />
                      예시 탐구 채우기
                    </Button>
                  )}
                </div>
                <ExplorationFields
                  values={draft.values}
                  onChange={(values) => setDraft({ ...draft, values })}
                />
                <ExplorationReportInput
                  activityId={draft.clientKey}
                  reports={draft.reports ?? []}
                  onChange={(reports) => setDraft({ ...draft, reports })}
                />
                <ExplorationReferencesInput
                  references={draft.values.references}
                  onChange={(references) =>
                    setDraft({
                      ...draft,
                      values: { ...draft.values, references },
                    })
                  }
                />
                <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background px-4 py-3 md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
                  <p className="max-w-lg text-xs leading-5 text-muted-foreground">
                    임시저장은 이 브라우저에 보관됩니다. 확정하면 계정에
                    저장되며 이후에도 수정할 수 있습니다.
                  </p>
                  <div className="flex shrink-0 justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={returnToList}
                    >
                      닫기
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!ready || !!localError || !hasInput(draft)}
                      onClick={saveLocal}
                    >
                      임시저장
                    </Button>
                    <Button
                      type="submit"
                      disabled={missingFields(draft.values).length > 0}
                    >
                      {busy ? '저장 중…' : existing ? '수정 내용 확정' : '확정'}
                    </Button>
                  </div>
                </div>
              </fieldset>
            </form>
          )}
        </DrawerContent>
      </Drawer>
      {onSelect ? (
        <ExplorationSelectList
          busy={busy || !ready}
          onSelect={onSelect}
          onOpen={(activity, element) => {
            opener.current = element;
            open(activity);
          }}
          onCreate={(element) => {
            opener.current = element;
            create();
          }}
        />
      ) : (
        <ExplorationTable
          userId={userId}
          canViewOthers={canViewOthers}
          local={local}
          ready={ready}
          busy={busy}
          localError={localError}
          onOpen={(activity, element) => {
            opener.current = element;
            open(activity);
          }}
          onDelete={(activity) => {
            setPendingDelete(activity);
            setDeleteOpen(true);
          }}
        />
      )}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>탐구활동을 삭제할까요?</DialogTitle>
            <DialogDescription className="wrap-break-word">
              ‘
              {pendingDelete?.values.topic.trim() ||
                pendingDelete?.values.recordArea.trim() ||
                '탐구활동'}
              ’
              {pendingDelete?.status === 'draft'
                ? pendingDelete.revision > 0
                  ? '의 임시 수정본만 삭제합니다. 기존 확정본은 유지됩니다.'
                  : '의 브라우저 임시저장을 삭제합니다.'
                : '의 확정본과 첨부 파일을 삭제합니다. 삭제한 내용은 되돌릴 수 없습니다.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (pendingDelete && (await remove(pendingDelete)))
                  setDeleteOpen(false);
              }}
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
