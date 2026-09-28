'use client';

import {
  ArrowRight,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
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
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { ExplorationFieldIcon } from './components/ExplorationFieldIcon';
import { ExplorationRecordFields } from './components/ExplorationRecordFields';
import { ExplorationReferencesInput } from './components/ExplorationReferencesInput';
import { ExplorationReportInput } from './components/ExplorationReportInput';
import { ExplorationRequiredMark } from './components/ExplorationRequiredMark';
import { ExplorationWritingGuide } from './components/ExplorationWritingGuide';
import { useExplorationStorage } from './hooks/useExplorationStorage';
import { type Activity, groups } from './lib/fields';
import { hasInput, missingFields } from './lib/storage-model';

export function ExplorationView({ userId }: { userId: string }) {
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
  } = useExplorationStorage(userId);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const existing = draft && draft.revision > 0;
  const filtered = activities.filter((activity) =>
    Object.values(activity.values)
      .flatMap((value) =>
        typeof value === 'string'
          ? [value]
          : value.flatMap(({ title, selection, usage }) => [
              title,
              selection,
              usage,
            ]),
      )
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
      aria-labelledby="exploration-management-title"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DashboardPageCategory view="exploration" />
          <h1
            id="exploration-management-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl"
          >
            탐구활동 관리
          </h1>
        </div>
        <Button
          disabled={!ready || busy}
          onClick={(event) => (
            (opener.current = event.currentTarget),
            create()
          )}
        >
          <Plus aria-hidden="true" />
          탐구활동 추가
        </Button>
      </div>
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
          확정된 탐구활동을 불러오는 중입니다.
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
            {existing ? '탐구활동 상세 · 수정' : '탐구활동 추가'}
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
                  variant="outline"
                  onClick={() => setConfirmDiscard(false)}
                >
                  계속 작성
                </Button>
                <Button
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
          {draft && (
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
                {groups.map((group, index) => (
                  <section
                    key={group.title}
                    aria-label={
                      'hideHeading' in group ? group.title : undefined
                    }
                    aria-labelledby={
                      'hideHeading' in group
                        ? undefined
                        : `activity-group-${index}`
                    }
                    className="rounded-2xl border p-5 md:p-6"
                  >
                    {!('hideHeading' in group) && (
                      <>
                        <h2
                          id={`activity-group-${index}`}
                          className="flex items-center gap-2 font-semibold"
                        >
                          <ExplorationFieldIcon field="process" />
                          <span>{group.title}</span>
                        </h2>
                        <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                          {group.description}
                        </p>
                      </>
                    )}
                    <div
                      className={`grid gap-5 ${'columns' in group ? 'gap-y-12 md:grid-cols-3 md:gap-x-10 md:gap-y-5' : 'md:grid-cols-2'} ${'hideHeading' in group ? '' : 'mt-5'}`}
                    >
                      {group.fields.map((field, fieldIndex) => {
                        if (
                          field.key === 'semester' ||
                          field.key === 'recordArea'
                        )
                          return null;
                        if (
                          field.key === 'grade' ||
                          field.key === 'recordType'
                        ) {
                          return (
                            <ExplorationRecordFields
                              key={field.key}
                              section={field.key}
                              values={draft.values}
                              onChange={(values) =>
                                setDraft({ ...draft, values })
                              }
                            />
                          );
                        }
                        const multiline =
                          'multiline' in field && field.multiline;
                        const fullWidth =
                          'fullWidth' in field ? field.fullWidth : multiline;
                        const required =
                          'required' in field && field.required === true;
                        const props = {
                          id: `activity-${field.key}`,
                          name: field.key,
                          value: draft.values[field.key],
                          placeholder: field.placeholder,
                          required,
                          'aria-describedby':
                            'description' in field || 'example' in field
                              ? `activity-${field.key}-help`
                              : undefined,
                          onChange: (
                            event: React.ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement
                            >,
                          ) =>
                            setDraft({
                              ...draft,
                              values: {
                                ...draft.values,
                                [field.key]: event.target.value,
                              },
                            }),
                        };
                        return (
                          <div
                            key={field.key}
                            className={
                              fullWidth
                                ? 'relative min-w-0 space-y-2 md:col-span-2'
                                : 'relative min-w-0 space-y-2'
                            }
                          >
                            {'columns' in group && fieldIndex > 0 && (
                              <ArrowRight
                                aria-hidden="true"
                                className="absolute -top-9 left-1/2 size-5 -translate-x-1/2 rotate-90 text-muted-foreground md:top-40 md:-left-7.5 md:translate-x-0 md:rotate-0"
                              />
                            )}
                            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                              <Label
                                htmlFor={props.id}
                                className="min-h-5 gap-2"
                              >
                                <ExplorationFieldIcon field={field.key} />
                                <span>
                                  {field.label}
                                  {'optional' in field && (
                                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                                      (선택)
                                    </span>
                                  )}
                                  {required && <ExplorationRequiredMark />}
                                </span>
                              </Label>
                              {'guide' in field && (
                                <ExplorationWritingGuide
                                  title={field.label}
                                  guide={field.guide}
                                />
                              )}
                            </div>
                            {multiline ? (
                              <Textarea
                                {...props}
                                className={
                                  'columns' in group
                                    ? 'h-72 min-h-72 field-sizing-fixed resize-y rounded-xl leading-relaxed'
                                    : field.key === 'record' ||
                                        field.key === 'competencies'
                                      ? 'h-32 min-h-32 field-sizing-fixed resize-y rounded-xl'
                                      : 'min-h-32 resize-y rounded-xl'
                                }
                              />
                            ) : (
                              <Input {...props} className="rounded-xl" />
                            )}
                            {'description' in field && (
                              <p
                                id={`activity-${field.key}-help`}
                                className="text-sm whitespace-pre-line text-muted-foreground"
                              >
                                {field.description}
                              </p>
                            )}
                            {'example' in field && (
                              <p
                                id={`activity-${field.key}-help`}
                                className="text-sm text-muted-foreground"
                              >
                                {field.example}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <ExplorationReportInput
                  activityId={draft.clientKey}
                  reports={draft.reports ?? []}
                  onChange={(reports) => setDraft({ ...draft, reports })}
                />
                <div className="rounded-2xl border p-5 md:p-6">
                  <ExplorationReferencesInput
                    references={draft.values.references}
                    onChange={(references) =>
                      setDraft({
                        ...draft,
                        values: { ...draft.values, references },
                      })
                    }
                  />
                </div>
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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            탐구활동 목록 <Badge variant="secondary">{activities.length}</Badge>
          </h2>
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="absolute top-2.5 left-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="탐구활동 검색"
              placeholder="주제, 교과명, 활동 내용 검색"
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
                    disabled={busy || !ready}
                    className="rounded-sm text-left font-semibold wrap-break-word hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={(event) => (
                      (opener.current = event.currentTarget),
                      open(activity)
                    )}
                  >
                    {activity.values.topic.trim() ||
                      activity.values.recordArea.trim() ||
                      '탐구활동'}
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      [
                        activity.values.grade && `${activity.values.grade}학년`,
                        activity.values.semester &&
                          `${activity.values.semester}학기`,
                      ]
                        .filter(Boolean)
                        .join(' '),
                      [activity.values.recordType, activity.values.recordArea]
                        .filter(Boolean)
                        .join(' 영역 '),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '기재 영역 미입력'}
                  </p>
                  {activity.values.record && (
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {activity.values.record}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy || !ready}
                    title="상세 · 수정"
                    aria-label={`${activity.values.topic.trim() || '탐구활동'} 상세 · 수정`}
                    onClick={(event) => (
                      (opener.current = event.currentTarget),
                      open(activity)
                    )}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    title="삭제"
                    aria-label={`${activity.values.topic.trim() || activity.values.recordArea.trim() || '탐구활동'} 삭제`}
                    onClick={() => setPendingDelete(activity)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-16 text-center">
            <NotebookPen
              aria-hidden="true"
              className="mb-4 size-8 text-muted-foreground"
            />
            <h3 className="font-medium">
              {activities.length
                ? '검색 결과가 없습니다'
                : '아직 등록한 탐구활동이 없습니다'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {activities.length
                ? '다른 검색어로 찾아보세요.'
                : '첫 탐구활동을 추가하고 내용을 작성해 보세요.'}
            </p>
            {!activities.length && (
              <Button
                variant="outline"
                className="mt-5"
                onClick={(event) => (
                  (opener.current = event.currentTarget),
                  create()
                )}
              >
                <Plus aria-hidden="true" />
                탐구활동 추가
              </Button>
            )}
          </div>
        )}
      </div>
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingDelete(null);
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
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button
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
