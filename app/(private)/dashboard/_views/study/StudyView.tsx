'use client';

import { Eye, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { CollectionHeader } from '@/components/patterns/collection';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { StudyActivityDetails } from './components/StudyActivityDetails';
import { StudyExamplesDialog } from './components/StudyExamplesDialog';
import { StudyFields } from './components/StudyFields';
import { StudyList } from './components/StudyList';
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
  } = useStudyStorage(userId);
  useEffect(() => {
    onEditorOpenChange?.(!!draft);
  }, [draft, onEditorOpenChange]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'mine' | 'others'>('mine');
  const [otherMode, setOtherMode] = useState<'all' | 'person'>('all');
  const [owner, setOwner] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const readOnly =
    (!!draft?.ownerId && draft.ownerId !== userId) ||
    (!!onSelect && draft?.status === 'confirmed');
  const canEdit = (activity: Activity) =>
    !activity.ownerId || activity.ownerId === userId;
  const existing = draft && draft.revision > 0;
  const showOthers = canViewOthers && scope === 'others';
  const mine = activities.filter(canEdit);
  const others = canViewOthers
    ? activities.filter((activity) => !canEdit(activity))
    : [];
  const people = Array.from(
    new Map(
      others.map((activity) => [
        activity.ownerId!,
        activity.ownerName?.trim() || '이름 비공개',
      ]),
    ).entries(),
  )
    .sort(
      ([idA, nameA], [idB, nameB]) =>
        nameA.localeCompare(nameB, 'ko') || idA.localeCompare(idB),
    )
    .map(([id, name], index, entries) => ({
      id,
      label:
        entries.filter(([, value]) => value === name).length > 1
          ? `${name} (${index + 1})`
          : name,
    }));
  const ownerLabel = (id?: string) =>
    people.find((person) => person.id === id)?.label ?? '이름 비공개';
  const scoped = showOthers
    ? others.filter(
        (activity) => otherMode === 'all' || activity.ownerId === owner,
      )
    : mine;
  const filtered = scoped.filter((activity) =>
    Object.values(activity.values)
      .filter((value): value is string => typeof value === 'string')
      .some((value) =>
        value.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );

  function returnToList() {
    if (busy) return;
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
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  create();
                }}
              >
                <Plus aria-hidden="true" />
                학습법 추가
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
          <DrawerTitle className="sr-only">
            {readOnly
              ? '학습법 상세'
              : existing
                ? '학습법 상세 · 수정'
                : '학습법 추가'}
          </DrawerTitle>
          <div className="h-12 shrink-0" aria-hidden="true" />
          {confirmDiscard && (
            <div role="alert" className="space-y-3 border-b bg-muted/50 p-6">
              <p className="font-medium">작성을 취소할까요?</p>
              <p className="text-sm text-muted-foreground">
                저장하지 않은 변경 내용이 사라집니다.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDiscard(false)}
                >
                  계속 작성
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setConfirmDiscard(false);
                    setDraft(null);
                  }}
                >
                  변경 내용 버리기
                </Button>
              </div>
            </div>
          )}
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
              className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-4 md:px-6 md:pt-6"
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              <fieldset
                disabled={busy || confirmDiscard}
                className="min-w-0 space-y-6"
              >
                <div className="flex justify-end">
                  <StudyExamplesDialog />
                </div>
                <StudyFields
                  key={draft.clientKey}
                  values={draft.values}
                  onChange={(values) => setDraft({ ...draft, values })}
                />
                <div className="sticky bottom-0 space-y-2 border-t bg-background py-4">
                  <p className="text-xs text-muted-foreground">
                    임시저장은 이 브라우저에 보관됩니다. 확정하면 계정에
                    저장되며 이후에도 수정할 수 있습니다.
                  </p>
                  <div className="flex justify-end gap-2">
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
        <StudyList
          canViewOthers={canViewOthers}
          scope={scope}
          setScope={setScope}
          query={query}
          setQuery={setQuery}
          mine={mine}
          others={others}
          showOthers={showOthers}
          otherMode={otherMode}
          setOtherMode={setOtherMode}
          owner={owner}
          setOwner={setOwner}
          ownerLabel={ownerLabel}
          people={people}
          filtered={filtered}
          busy={busy}
          ready={ready}
          isLoading={isLoading}
          remoteError={remoteError}
          localError={localError}
          canEdit={canEdit}
          onOpen={(activity, element) => {
            opener.current = element;
            open(activity);
          }}
          onDelete={setPendingDelete}
        />
      )}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingDelete(null);
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
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (pendingDelete && (await remove(pendingDelete)))
                  setPendingDelete(null);
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
