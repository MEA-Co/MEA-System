'use client';
import { Eye, Plus, Search } from 'lucide-react';
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
import { Input } from '@/components/ui/input';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { StudyActivityDetails } from './components/StudyActivityDetails';
import { StudyExamplesDialog } from './components/StudyExamplesDialog';
import { StudyFields } from './components/StudyFields';
import { StudyTable } from './components/StudyTable';
import { useStudyStorage } from './hooks/useStudyStorage';
import { type Activity, studySummary, studyTitle } from './lib/fields';
import { hasInput, missingFields } from './lib/storage-model';

export function StudyView({
  userId,
  canViewOthers = false,
  onSelect,
  onEditorOpenChange,
  registrationOnly = false,
  registrationLabel = '학습법 추가',
}: {
  userId: string;
  canViewOthers?: boolean;
  onSelect?: (activity: Activity) => void;
  onEditorOpenChange?: (open: boolean) => void;
  registrationOnly?: boolean;
  registrationLabel?: string;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const {
    activities,
    draft,
    setDraft,
    busy,
    dirty,
    ready,
    localError,
    remoteError,
    isLoading,
    refresh,
    create,
    open,
    saveLocal,
    confirm,
    remove,
  } = useStudyStorage(userId, !!onSelect, !onSelect && !registrationOnly);
  useEffect(() => {
    onEditorOpenChange?.(!!draft);
  }, [draft, onEditorOpenChange]);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const continueWritingRef = useRef<HTMLButtonElement>(null);
  const readOnly =
    (!!draft?.ownerId && draft.ownerId !== userId) ||
    (!!onSelect && draft?.status === 'confirmed');
  const canEdit = (activity: Activity) =>
    !activity.ownerId || activity.ownerId === userId;
  const existing = draft && draft.revision > 0;
  const scoped = activities.filter(canEdit);
  const filtered = scoped.filter((activity) =>
    Object.values(activity.values)
      .filter((value): value is string => typeof value === 'string')
      .some((value) =>
        value.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );

  function returnToList() {
    if (busy || confirmDiscard || examplesOpen) return;
    if (dirty) setConfirmDiscard(true);
    else {
      setConfirmDiscard(false);
      setDraft(null);
    }
  }

  return (
    <section
      aria-labelledby={
        registrationOnly || onSelect ? undefined : 'study-management-title'
      }
      aria-label={
        registrationOnly ? '학습법 등록' : onSelect ? '학습법 목록' : undefined
      }
      className={
        registrationOnly ? 'space-y-3' : onSelect ? 'space-y-2' : 'space-y-6'
      }
    >
      {registrationOnly ? (
        <Button
          type="button"
          disabled={!ready || busy}
          className="h-auto min-h-9 max-w-full text-left whitespace-normal wrap-anywhere"
          onClick={(event) => {
            opener.current = event.currentTarget;
            create();
          }}
        >
          <Plus aria-hidden="true" />
          {registrationLabel}
        </Button>
      ) : (
        !onSelect && (
          <CollectionHeader
            id="study-management-title"
            category={<DashboardPageCategory view="study" />}
            title="학습법 관리"
            description="나만의 학습 전략을 기록하고, 필요한 답변에 연결하세요."
            action={
              <Button
                type="button"
                disabled={!ready || busy}
                aria-label="학습법 추가"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  create();
                }}
              >
                <Plus aria-hidden="true" />
                <span className="hidden sm:inline">학습법 추가</span>
                <span className="sm:hidden">추가</span>
              </Button>
            }
          />
        )
      )}
      {localError && (
        <p role="alert" className="text-sm text-destructive">
          {localError}
        </p>
      )}
      {remoteError && (
        <div
          role="alert"
          className="flex items-center gap-3 text-sm text-destructive"
        >
          <span>
            확정 목록을 불러오지 못했습니다. 임시저장은 계속 사용할 수 있습니다.
          </span>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            다시 불러오기
          </Button>
        </div>
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
                ? '학습법 상세'
                : existing
                  ? '학습법 상세 · 수정'
                  : '학습법 추가'}
            </DrawerTitle>
            <DrawerDescription>
              {readOnly
                ? '문제 상황과 학습 전략을 확인하세요.'
                : '문제 상황부터 실천과 점검까지, 학습 전략을 구체적으로 기록하세요.'}
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
            <StudyActivityDetails
              activity={draft}
              notice={
                draft.ownerId && draft.ownerId !== userId
                  ? '다른 작성자의 학습법입니다. 읽기 전용으로 표시됩니다.'
                  : '첨부할 학습법을 미리 보고 있습니다. 읽기 전용으로 표시됩니다.'
              }
              onClose={returnToList}
            />
          )}
          {draft && !readOnly && (
            <form
              noValidate
              inert={confirmDiscard || examplesOpen}
              style={
                confirmDiscard || examplesOpen
                  ? { overflow: 'hidden' }
                  : undefined
              }
              className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pt-4 md:px-6 md:pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    * 표시된 항목은 필수입니다.
                  </p>
                  <StudyExamplesDialog onOpenChange={setExamplesOpen} />
                </div>
                <StudyFields
                  key={draft.clientKey}
                  values={draft.values}
                  onChange={(values) => setDraft({ ...draft, values })}
                />
                <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t bg-background px-4 py-3 md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
                  <p className="max-w-lg text-xs leading-5 text-muted-foreground">
                    임시저장은 이 브라우저에 보관됩니다. 확정하면 계정에
                    저장되며 이후에도 수정할 수 있습니다.
                  </p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
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
      {registrationOnly ? null : onSelect ? (
        <div className="space-y-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-2.5 size-4 text-muted-foreground"
            />
            <Input
              aria-label="학습법 검색"
              placeholder="학습법 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
          <ul className="divide-y">
            {filtered
              .filter((activity) => activity.status === 'confirmed')
              .map((activity) => (
                <li
                  key={activity.clientKey}
                  className="flex items-center gap-1"
                >
                  <button
                    type="button"
                    disabled={busy || !ready}
                    onClick={() => onSelect(activity)}
                    aria-label={`${studyTitle(activity.values)} 첨부하기`}
                    className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {studyTitle(activity.values)}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {studySummary(activity.values)}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      첨부하기
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mr-2 shrink-0 cursor-pointer disabled:cursor-default"
                    disabled={busy || !ready}
                    title="상세 보기"
                    aria-label={`${studyTitle(activity.values)} 상세 보기`}
                    onClick={(event) => {
                      opener.current = event.currentTarget;
                      open(activity);
                    }}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            {!isLoading &&
              !filtered.some((activity) => activity.status === 'confirmed') && (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  {query.trim()
                    ? '검색 결과가 없어요.'
                    : '첨부할 확정 학습법이 없어요.'}
                </li>
              )}
            <li>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  create();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-50"
              >
                <Plus className="size-4" aria-hidden="true" />
                학습법 추가
              </button>
            </li>
          </ul>
        </div>
      ) : (
        <StudyTable
          userId={userId}
          canViewOthers={canViewOthers}
          local={activities.filter((activity) => activity.status === 'draft')}
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
            <DialogTitle>학습법을 삭제할까요?</DialogTitle>
            <DialogDescription className="wrap-break-word">
              ‘{pendingDelete ? studyTitle(pendingDelete.values) : '학습법'}’
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
