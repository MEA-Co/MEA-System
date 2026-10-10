'use client';

import { Eye, NotebookPen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { StudyActivityDetails } from './components/StudyActivityDetails';
import { StudyFields } from './components/StudyFields';
import { StudyReportInput } from './components/StudyReportInput';
import { useStudyStorage } from './hooks/useStudyStorage';
import { type Activity, studySummary, studyTitle } from './lib/fields';
import { hasInput, missingFields } from './lib/storage-model';

export function StudyView({
  userId,
  canViewOthers = false,
  onSelect,
  onEditorOpenChange,
}: {
  userId: string;
  canViewOthers?: boolean;
  onSelect?: (activity: Activity) => void;
  onEditorOpenChange?: (open: boolean) => void;
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
      aria-labelledby={onSelect ? undefined : 'study-management-title'}
      aria-label={onSelect ? '학습법 목록' : undefined}
      className={onSelect ? 'space-y-2' : 'space-y-6'}
    >
      {!onSelect && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {!onSelect && <DashboardPageCategory view="study" />}
            <h1
              id="study-management-title"
              className={
                onSelect
                  ? 'mt-1 text-lg font-semibold'
                  : 'mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl'
              }
            >
              {onSelect ? '첨부할 학습법 선택' : '학습법 관리'}
            </h1>
          </div>
          <Button
            type="button"
            disabled={!ready || busy}
            onClick={(event) => (
              (opener.current = event.currentTarget),
              create()
            )}
          >
            <Plus aria-hidden="true" />
            학습법 추가
          </Button>
        </div>
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
      {isLoading && (
        <p className="text-sm text-muted-foreground">
          확정된 학습법을 불러오는 중입니다.
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
                <StudyFields
                  values={draft.values}
                  onChange={(values) => setDraft({ ...draft, values })}
                />
                <StudyReportInput
                  activityId={draft.clientKey}
                  reports={draft.reports ?? []}
                  onChange={(reports) => setDraft({ ...draft, reports })}
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
      {onSelect ? (
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
        <div className="space-y-4">
          {canViewOthers && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="학습법 구분"
            >
              <Button
                type="button"
                variant={scope === 'mine' ? 'secondary' : 'ghost'}
                aria-pressed={scope === 'mine'}
                onClick={() => {
                  setScope('mine');
                  setQuery('');
                }}
              >
                내 학습법 <Badge variant="outline">{mine.length}</Badge>
              </Button>
              <Button
                type="button"
                variant={scope === 'others' ? 'secondary' : 'ghost'}
                aria-pressed={scope === 'others'}
                onClick={() => {
                  setScope('others');
                  setQuery('');
                }}
              >
                다른 사람의 학습법{' '}
                <Badge variant="outline">{others.length}</Badge>
              </Button>
            </div>
          )}
          {showOthers && (
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="flex gap-1 rounded-xl bg-muted/50 p-1"
                role="group"
                aria-label="다른 사람의 학습법 보기 방식"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={otherMode === 'all' ? 'secondary' : 'ghost'}
                  aria-pressed={otherMode === 'all'}
                  onClick={() => setOtherMode('all')}
                >
                  전체 보기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={otherMode === 'person' ? 'secondary' : 'ghost'}
                  aria-pressed={otherMode === 'person'}
                  onClick={() => setOtherMode('person')}
                >
                  사람별 보기
                </Button>
              </div>
              {otherMode === 'person' && (
                <Select
                  value={owner || null}
                  onValueChange={(value) => setOwner(value ?? '')}
                >
                  <SelectTrigger
                    className="min-w-48"
                    aria-label="학습법 작성자 선택"
                  >
                    <SelectValue placeholder="작성자를 선택해 주세요">
                      {owner ? ownerLabel(owner) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.label} (
                        {
                          others.filter(
                            (activity) => activity.ownerId === person.id,
                          ).length
                        }
                        개)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold">
              {showOthers
                ? otherMode === 'person' && owner
                  ? `${ownerLabel(owner)}님의 학습법`
                  : '다른 사람의 학습법'
                : '내 학습법'}{' '}
              <Badge variant="secondary">{filtered.length}</Badge>
            </h2>
            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label="학습법 검색"
                placeholder="과목, 문제 상황, 학습 전략 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="rounded-xl pl-9"
              />
            </div>
          </div>
          {filtered.length ? (
            <ul className="divide-y rounded-2xl border">
              {filtered.map((activity) => (
                <li
                  key={activity.clientKey}
                  className="flex flex-wrap items-center gap-4 p-5"
                >
                  <div className="min-w-0 flex-1 basis-60">
                    <button
                      type="button"
                      disabled={busy || !ready}
                      className="rounded-sm text-left font-semibold wrap-break-word hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={(event) => {
                        opener.current = event.currentTarget;
                        open(activity);
                      }}
                    >
                      {studyTitle(activity.values)}
                    </button>
                    <Badge
                      variant={
                        activity.status === 'draft' ? 'secondary' : 'outline'
                      }
                      className="ml-2"
                    >
                      {activity.status === 'draft'
                        ? activity.revision > 0
                          ? '수정 중 · 임시저장'
                          : '임시저장'
                        : '확정'}
                    </Badge>
                    {showOthers && (
                      <p className="mt-2 text-sm font-medium">
                        작성자: {ownerLabel(activity.ownerId)}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {studySummary(activity.values) || '기본 정보 미입력'}
                    </p>
                    {activity.values.problem && (
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {activity.values.problem}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy || !ready}
                      title={
                        !onSelect && canEdit(activity)
                          ? '상세 · 수정'
                          : '상세 보기'
                      }
                      aria-label={`${studyTitle(activity.values)} ${!onSelect && canEdit(activity) ? '상세 · 수정' : '상세 보기'}`}
                      onClick={(event) => (
                        (opener.current = event.currentTarget),
                        open(activity)
                      )}
                    >
                      {!onSelect && canEdit(activity) ? (
                        <Pencil aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                    </Button>
                    {!onSelect && canEdit(activity) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        title="삭제"
                        aria-label={`${studyTitle(activity.values)} 삭제`}
                        onClick={() => setPendingDelete(activity)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
              <NotebookPen
                aria-hidden="true"
                className="mb-4 size-8 text-muted-foreground"
              />
              <h3 className="font-normal">
                {showOthers && otherMode === 'person' && !owner
                  ? '작성자를 선택해 주세요'
                  : query.trim()
                    ? '검색 결과가 없습니다'
                    : '등록된 학습법이 없어요.'}
              </h3>
            </div>
          )}
        </div>
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
