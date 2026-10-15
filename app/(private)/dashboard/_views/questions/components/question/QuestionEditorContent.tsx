'use client';
import { Copy, Eye, LoaderCircle, PencilLine, Plus, Save } from 'lucide-react';
import { useState } from 'react';

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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs as CollectionTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { useQuestionEditorSession } from '../../hooks/useQuestionEditorSession';
import type { QuestionLibraryProps } from '../../lib/question-editor-types';

import {
  questionCanvasClass,
  questionNumberClass,
  questionPromptClass,
  questionSurfaceClass,
} from './question-styles';
import { QuestionBlockFieldEditor } from './QuestionBlockFieldEditor';
import { QuestionBlockPreview } from './QuestionBlockPreview';
import { QuestionConditionEditor } from './QuestionConditionEditor';
import { QuestionDetailsEditor } from './QuestionDetailsEditor';
import {
  QuestionEditorSkeleton,
  QuestionRelationshipsSkeleton,
} from './QuestionEditorSkeleton';
import { QuestionImportDialog } from './QuestionImportDialog';
import { QuestionReviews } from './QuestionReviews';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
function MaxItemsInput({
  value,
  disabled,
  ariaLabel = '최대 항목 수',
  onChange,
}: {
  value: number;
  disabled: boolean;
  ariaLabel?: string;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Input
      id="max-rows"
      type="number"
      min={1}
      max={20}
      step={1}
      aria-label={ariaLabel}
      aria-describedby="max-rows-description"
      className="h-9 w-20 text-center"
      disabled={disabled}
      value={editing ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setEditing(text);
        const count = Number(text);
        if (text && Number.isInteger(count) && count >= 1 && count <= 20)
          onChange(count);
      }}
      onBlur={() => {
        const count = Number(editing ?? value);
        onChange(
          Number.isFinite(count)
            ? Math.max(1, Math.min(20, Math.floor(count)))
            : value,
        );
        setEditing(null);
      }}
    />
  );
}

export function QuestionEditorContent({
  editor,
  embedded,
}: {
  editor: ReturnType<typeof useQuestionEditorSession>;
  embedded: QuestionLibraryProps['embedded'];
}) {
  const {
    unchangedImport,
    importOpen,
    setImportOpen,
    openImport,
    importQuestion,
    requestedId,
    savedRow,
    userId,
    draft,
    revision,
    savedAt,
    saveError,
    conflicted,
    busy,
    loadError,
    confirmDiscard,
    setConfirmDiscard,
    continueWritingRef,
    guideDialog,
    guideCancelRef,
    editorBlocked,
    loadBlocks,
    unsaved,
    editorData,
    relatedQuestions,
    candidates,
    dirty,
    valid,
    resolveGuideConfirmation,
    changeAnswerField,
    updateDraft,
    changeAnswerLayout,
    changeFlowInsertAfter,
    updateField,
    leaveEditor,
    discardDraft,
    save,
  } = editor;
  return (
    <>
      {importOpen && (
        <QuestionImportDialog
          onClose={() => setImportOpen(false)}
          onImport={importQuestion}
          hasChanges={dirty}
        />
      )}
      <AlertDialog
        open={guideDialog.open}
        onOpenChange={(open) => {
          if (!open) resolveGuideConfirmation(false);
        }}
      >
        <AlertDialogContent initialFocus={guideCancelRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              가이드 응답을 삭제하고 변경할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {guideDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              ref={guideCancelRef}
              onClick={() => resolveGuideConfirmation(false)}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => resolveGuideConfirmation(true)}
            >
              삭제하고 계속
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmDiscard}
        onOpenChange={(open) => {
          if (!busy) setConfirmDiscard(open);
        }}
      >
        <AlertDialogContent initialFocus={continueWritingRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>작성을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경 내용이 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={continueWritingRef} disabled={busy}>
              계속 작성
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={discardDraft}
            >
              변경 내용 버리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!embedded && (
        <DrawerHeader
          inert={editorBlocked}
          className="shrink-0 border-b bg-background text-left"
        >
          <>
            <DrawerTitle className="pr-8 text-xl font-extrabold">
              {requestedId !== 'new' && !unsaved
                ? '질문 수정'
                : '새 질문 만들기'}
            </DrawerTitle>
            <DrawerDescription>
              질문 내용과 답변 방식, 조건을 설정하세요.
            </DrawerDescription>
          </>
        </DrawerHeader>
      )}
      <div
        className={cn(
          questionCanvasClass,
          !embedded && 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
        )}
        inert={editorBlocked}
        style={editorBlocked ? { overflow: 'hidden' } : undefined}
        data-question-editor={embedded ? undefined : true}
      >
        {!userId && loadError ? (
          <div role="alert">
            <p>질문 편집 정보를 불러오지 못했어요.</p>
            <Button variant="outline" onClick={() => void loadBlocks()}>
              다시 시도
            </Button>
          </div>
        ) : editorData.detail.error ? (
          <div role="alert">
            <p>{editorData.detail.error.message}</p>
            <Button
              variant="outline"
              onClick={() => void editorData.detail.mutate()}
            >
              다시 시도
            </Button>
          </div>
        ) : draft && draft.id === requestedId ? (
          <div className="space-y-6">
            {editorData.detail.data?.publication_locked_at && (
              <p
                role="status"
                className="rounded-lg border bg-muted p-4 text-sm"
              >
                배포된 질문지에 사용된 질문입니다. 질문 내용·설명·답변 설정을
                수정하거나 삭제할 수 없습니다.
              </p>
            )}
            {revision === 0 && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  disabled={busy || !!saveError || conflicted}
                  onClick={openImport}
                >
                  <Copy aria-hidden="true" />
                  다른 질문 내용 가져오기
                </Button>
              </div>
            )}
            {revision > 0 && <QuestionReviews questionId={draft.id} />}
            <CollectionTabs defaultValue="edit">
              <TabsList aria-label="질문 보기 방식">
                {[
                  { value: 'edit', label: '편집', icon: PencilLine },
                  { value: 'preview', label: '미리보기', icon: Eye },
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-2 px-4">
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="preview">
                {draft.purpose !== 'study_registration' &&
                editorData.relationships.error ? (
                  <p role="alert">
                    참조 질문을 불러오지 못했어요. 조건 설정의 다시 시도를 눌러
                    주세요.
                  </p>
                ) : draft.purpose !== 'study_registration' &&
                  editorData.relationships.isLoading ? (
                  <QuestionRelationshipsSkeleton />
                ) : (
                  <QuestionBlockPreview
                    key={`${draft.id}:${draft.sourceBlockId ?? draft.condition?.clauses[0]?.blockId ?? ''}`}
                    document={draft}
                    questions={relatedQuestions}
                  />
                )}
              </TabsContent>
              <TabsContent
                value="edit"
                inert={!!editorData.detail.data?.publication_locked_at}
                keepMounted
                className="space-y-6 data-hidden:hidden"
              >
                <Card variant="accent">
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="block-title">
                        {draft.purpose === 'study_registration'
                          ? '카드 제목'
                          : '관리용 이름 (선택)'}
                      </Label>
                      <Input
                        id="block-title"
                        maxLength={200}
                        value={draft.title}
                        onChange={(event) =>
                          updateDraft({ title: event.target.value })
                        }
                        placeholder={
                          draft.purpose === 'study_registration'
                            ? '학습법 등록 안내'
                            : '입력하지 않으면 질문 내용이 이름으로 표시됩니다.'
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className={questionSurfaceClass}>
                  <h3 className="sr-only">
                    {draft.purpose === 'study_registration'
                      ? '안내 내용'
                      : '질문'}
                  </h3>
                  <div className={questionPromptClass}>
                    <span aria-hidden="true" className={questionNumberClass}>
                      #
                    </span>
                    <QuestionRichTextEditor
                      id={`question-prompt-${draft.id}`}
                      value={draft.prompt}
                      onChange={(prompt) => updateDraft({ prompt })}
                      placeholder={
                        draft.purpose === 'study_registration'
                          ? '추가할 학습법과 작성 방법을 안내해 주세요'
                          : '질문을 입력하세요'
                      }
                      ariaLabel={
                        draft.purpose === 'study_registration'
                          ? '안내 내용'
                          : '질문'
                      }
                      maxLength={10000}
                      compact
                      className="min-w-0 flex-1 rounded-lg"
                    />
                  </div>
                  <QuestionDetailsEditor
                    details={draft.details ?? []}
                    onChange={(details) => updateDraft({ details })}
                  />

                  {draft.purpose === 'study_registration' ? (
                    <Card variant="accent" className="gap-0 py-0">
                      <CardContent className="space-y-2 p-4 sm:p-6">
                        <Label htmlFor="study-registration-button">
                          버튼 이름
                        </Label>
                        <Input
                          id="study-registration-button"
                          maxLength={100}
                          value={draft.buttonLabel ?? '학습법 추가'}
                          placeholder="학습법 추가"
                          onChange={(event) =>
                            updateDraft({ buttonLabel: event.target.value })
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          이 카드는 질문지 답변을 받지 않습니다. 등록한 학습법은
                          학습법 목록에 저장됩니다.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card variant="accent" className="gap-0 py-0">
                        <CardContent className="space-y-3 p-4 sm:p-6">
                          <Label htmlFor="answer-layout">답변 표시 방식</Label>
                          <Select
                            value={draft.answerLayout ?? 'cards'}
                            onValueChange={(layout) => {
                              if (
                                layout === 'cards' ||
                                layout === 'table' ||
                                layout === 'flow'
                              )
                                changeAnswerLayout(layout);
                            }}
                          >
                            <SelectTrigger
                              id="answer-layout"
                              className="w-full sm:w-64"
                            >
                              <SelectValue>
                                {draft.answerLayout === 'table'
                                  ? '표'
                                  : draft.answerLayout === 'flow'
                                    ? '흐름표'
                                    : '카드'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>기본</SelectLabel>
                                <SelectItem value="cards">카드</SelectItem>
                                <SelectItem value="table">표</SelectItem>
                              </SelectGroup>
                              <SelectSeparator />
                              <SelectGroup>
                                <SelectLabel>프리셋</SelectLabel>
                                <SelectItem
                                  value="flow"
                                  disabled={draft.rowMode === 'reference'}
                                >
                                  흐름표
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">
                            {draft.answerLayout === 'flow'
                              ? '기본 시기를 가로로, 답변 항목을 세로로 배치합니다. 시기 추가를 허용한 위치에서는 응답자가 이름을 정해 시기를 추가할 수 있습니다.'
                              : draft.answerLayout === 'table'
                                ? '열 제목 아래의 칸에 바로 입력합니다. 처음 표시할 행 수와 최소 작성 행 수를 따로 설정할 수 있습니다.'
                                : '항목별로 답변을 펼쳐 입력합니다.'}
                          </p>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <h3 className="font-semibold">
                          {draft.answerLayout === 'flow'
                            ? '답변 항목 (세로)'
                            : '답변 열'}
                        </h3>
                        {draft.fields.map((field, index) => (
                          <QuestionBlockFieldEditor
                            key={field.id}
                            field={field}
                            index={index}
                            fieldCount={draft.fields.length}
                            answerLayout={draft.answerLayout}
                            onChange={(updated) =>
                              updateField(field.id, updated)
                            }
                            onRemove={() => void changeAnswerField(field)}
                          />
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-11 w-full"
                          disabled={draft.fields.length >= 20}
                          onClick={() =>
                            updateDraft({
                              fields: [
                                ...draft.fields,
                                {
                                  id: crypto.randomUUID(),
                                  label: `답변 ${draft.fields.length + 1}`,
                                  kind: 'text',
                                },
                              ],
                            })
                          }
                        >
                          <Plus aria-hidden="true" />
                          {draft.answerLayout === 'flow'
                            ? '답변 항목 추가'
                            : '답변 열 추가'}
                        </Button>
                      </div>

                      <Card variant="accent" className="gap-0 py-0">
                        <CardContent className="space-y-2 p-4 sm:p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            {draft.rowMode === 'reference' ? (
                              <p className="text-sm text-muted-foreground">
                                앞선 질문의 응답 항목 수에 맞춰 반복됩니다.
                              </p>
                            ) : (
                              <>
                                <Label htmlFor="min-rows">
                                  {draft.answerLayout === 'flow'
                                    ? '최소 작성 시기 수'
                                    : '최소 작성 행 수'}
                                </Label>
                                <Input
                                  id="min-rows"
                                  type="number"
                                  min={1}
                                  max={draft.maxRows ?? 1}
                                  className="w-20"
                                  value={draft.minRows ?? 1}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    if (
                                      Number.isInteger(value) &&
                                      value >= 1 &&
                                      value <= (draft.maxRows ?? 1)
                                    )
                                      updateDraft({
                                        minRows: value,
                                        initialRows: Math.max(
                                          draft.initialRows ?? 1,
                                          value,
                                        ),
                                      });
                                  }}
                                />
                                <Label htmlFor="max-rows">
                                  {draft.answerLayout === 'flow'
                                    ? '기본 시기 수'
                                    : '최대 행 수'}
                                </Label>
                                <MaxItemsInput
                                  value={
                                    draft.rowMode === 'repeatable'
                                      ? (draft.maxRows ?? 1)
                                      : 1
                                  }
                                  disabled={false}
                                  ariaLabel={
                                    draft.answerLayout === 'flow'
                                      ? '기본 시기 수'
                                      : '최대 행 수'
                                  }
                                  onChange={(count) => {
                                    if (draft.rowMode === 'reference') return;
                                    updateDraft({
                                      rowMode:
                                        count > 1 ? 'repeatable' : 'single',
                                      maxRows: count > 1 ? count : null,
                                      minRows: Math.min(
                                        draft.minRows ?? 1,
                                        count,
                                      ),
                                      flowInsertAfter:
                                        draft.answerLayout === 'flow' &&
                                        count < 20
                                          ? (
                                              draft.flowInsertAfter ?? []
                                            ).filter(
                                              (position) => position <= count,
                                            )
                                          : [],
                                      initialRows:
                                        draft.answerLayout === 'flow'
                                          ? count
                                          : Math.min(
                                              Math.max(
                                                draft.initialRows ?? 1,
                                                draft.minRows ?? 1,
                                              ),
                                              count,
                                            ),
                                    });
                                  }}
                                />
                                {draft.answerLayout === 'table' && (
                                  <>
                                    <Label htmlFor="initial-rows">
                                      처음 표시할 행 수
                                    </Label>
                                    <Input
                                      id="initial-rows"
                                      type="number"
                                      min={draft.minRows ?? 1}
                                      max={draft.maxRows ?? 1}
                                      className="w-20"
                                      value={Math.max(
                                        draft.initialRows ?? 1,
                                        draft.minRows ?? 1,
                                      )}
                                      onChange={(event) => {
                                        const value = Number(
                                          event.target.value,
                                        );
                                        if (
                                          Number.isInteger(value) &&
                                          value >= (draft.minRows ?? 1) &&
                                          value <= (draft.maxRows ?? 1)
                                        )
                                          updateDraft({ initialRows: value });
                                      }}
                                    />
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          <p
                            id="max-rows-description"
                            className="text-sm text-muted-foreground"
                          >
                            {draft.rowMode === 'reference'
                              ? '행 개수는 참조한 질문의 응답을 따릅니다. 흐름표를 사용하려면 조건 설정에서 앞선 질문의 응답 참조를 꺼 주세요.'
                              : draft.answerLayout === 'flow'
                                ? '기본 시기는 항상 표시합니다. 아래에서 추가를 허용할 위치를 정할 수 있으며, 추가한 시기를 포함해 총 20개까지 작성할 수 있습니다. 최소 작성 시기 수만큼 한 칸 이상 입력해야 합니다.'
                                : draft.answerLayout === 'table'
                                  ? '처음 표시된 빈 여분 행은 작성 필수가 아닙니다. 최소 작성 행 수만큼 입력하면 됩니다.'
                                  : '최소 작성 행 수만큼 입력해야 하며 최대 행 수까지 추가할 수 있습니다.'}
                          </p>
                          {draft.rowMode !== 'reference' && (
                            <div className="mt-3 overflow-hidden rounded-xl border">
                              <Table
                                aria-label={
                                  draft.answerLayout === 'flow'
                                    ? '시기 이름 설정'
                                    : '행 이름 설정'
                                }
                              >
                                <TableHeader>
                                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="w-24 text-center">
                                      {draft.answerLayout === 'flow'
                                        ? '시기 번호'
                                        : '행 번호'}
                                    </TableHead>
                                    <TableHead>
                                      {draft.answerLayout === 'flow'
                                        ? '시기 이름 (가로)'
                                        : '행 이름'}
                                    </TableHead>
                                    {draft.answerLayout === 'flow' && (
                                      <TableHead>시기 추가 허용</TableHead>
                                    )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Array.from(
                                    { length: draft.maxRows ?? 1 },
                                    (_, index) => (
                                      <TableRow key={index}>
                                        <TableCell className="text-center text-muted-foreground">
                                          {index + 1}
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            id={`row-label-${index}`}
                                            aria-label={`${index + 1}${draft.answerLayout === 'flow' ? '번째 시기 이름' : '행 이름'}`}
                                            maxLength={100}
                                            placeholder={String(index + 1)}
                                            value={
                                              draft.rowLabels?.[index] ?? ''
                                            }
                                            onChange={(event) => {
                                              const labels = Array.from(
                                                { length: draft.maxRows ?? 1 },
                                                (_, i) =>
                                                  draft.rowLabels?.[i] ?? '',
                                              );
                                              labels[index] =
                                                event.target.value;
                                              updateDraft({
                                                rowLabels: labels,
                                              });
                                            }}
                                          />
                                        </TableCell>
                                        {draft.answerLayout === 'flow' && (
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`flow-insert-after-${index + 1}`}
                                                aria-label={`${draft.rowLabels?.[index]?.trim() || `시기 ${index + 1}`} 다음에 시기 추가 허용`}
                                                checked={(
                                                  draft.flowInsertAfter ?? []
                                                ).includes(index + 1)}
                                                disabled={
                                                  (draft.maxRows ?? 1) >= 20
                                                }
                                                onCheckedChange={(checked) => {
                                                  changeFlowInsertAfter(
                                                    index + 1,
                                                    checked,
                                                  );
                                                }}
                                              />
                                              <Label
                                                htmlFor={`flow-insert-after-${index + 1}`}
                                                className="cursor-pointer text-xs"
                                              >
                                                이 시기 다음에 추가
                                              </Label>
                                            </div>
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    ),
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                          {draft.answerLayout === 'flow' &&
                            (draft.maxRows ?? 1) >= 20 && (
                              <p className="text-xs text-muted-foreground">
                                기본 시기가 20개이면 응답자가 추가할 공간이
                                없습니다. 추가를 허용하려면 기본 시기 수를 줄여
                                주세요.
                              </p>
                            )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
                {draft.purpose !== 'study_registration' && (
                  <Card variant="accent">
                    <CardHeader variant="emphasis">
                      <h2 className="font-semibold">조건 설정</h2>
                      <p className="text-sm text-muted-foreground">
                        질문들간의 관계를 설정합니다.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {editorData.relationships.error ? (
                        <div role="alert">
                          <p>참조 질문을 불러오지 못했어요.</p>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void editorData.relationships.mutate()
                            }
                          >
                            다시 시도
                          </Button>
                        </div>
                      ) : editorData.relationships.isLoading ? (
                        <QuestionRelationshipsSkeleton />
                      ) : (
                        <QuestionConditionEditor
                          key={draft.id}
                          questions={candidates}
                          document={draft}
                          onChange={updateDraft}
                        />
                      )}
                    </CardContent>
                  </Card>
                )}

                {embedded && (
                  <p className="text-sm text-muted-foreground">
                    {draft.purpose === 'study_registration'
                      ? '저장한 안내 카드는 질문 관리에서도 다시 불러올 수 있습니다.'
                      : '저장한 질문은 질문 관리에도 등록됩니다.'}
                  </p>
                )}
              </TabsContent>
            </CollectionTabs>
          </div>
        ) : (
          <QuestionEditorSkeleton />
        )}
      </div>
      <div
        inert={editorBlocked}
        className={cn(
          'shrink-0 border-t bg-background px-4 py-3 md:px-6',
          'flex flex-col gap-3 md:flex-row md:items-center md:justify-between',
          embedded && 'sticky bottom-0 z-10',
        )}
      >
        <div className="min-h-5 min-w-0">
          {draft?.id === requestedId &&
            (busy || conflicted || saveError || valid) && (
              <p
                className="max-w-lg text-xs leading-5 text-muted-foreground"
                role="status"
              >
                {busy
                  ? '저장 중…'
                  : conflicted
                    ? '다른 곳에서 수정됐어요. 작성 내용은 유지됩니다.'
                    : saveError
                      ? saveError
                      : unchangedImport
                        ? '불러온 내용을 수정하면 새 질문으로 저장됩니다.'
                        : dirty
                          ? '변경 사항이 있어요 · 10초마다 자동 저장'
                          : savedAt
                            ? '모든 변경 사항을 저장했어요 · 10초마다 자동 저장'
                            : '내용을 입력하면 10초마다 자동 저장됩니다.'}
              </p>
            )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={leaveEditor}
          >
            닫기
          </Button>
          <Button
            disabled={
              !!editorData.detail.data?.publication_locked_at ||
              !draft ||
              draft.id !== requestedId ||
              busy ||
              conflicted ||
              !dirty
            }
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {busy ? '저장 중…' : '저장'}
          </Button>
          {embedded && (
            <Button
              disabled={
                busy || dirty || !savedRow || conflicted || !!embedded.paused
              }
              onClick={() => {
                if (savedRow) void embedded.onPlace(savedRow);
              }}
            >
              {embedded.actionLabel ?? '질문지에 배치'}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
