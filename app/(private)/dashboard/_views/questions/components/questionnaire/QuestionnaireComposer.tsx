'use client';

import { Tabs } from '@base-ui/react/tabs';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LoaderCircle,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

import { useQuestionLibrary } from '../../hooks/questionnaire/useQuestionLibrary';
import { useQuestionnaireSave } from '../../hooks/questionnaire/useQuestionnaireSave';
import type { QuestionBlockRow } from '../../lib/question-blocks';
import {
  createPlacement,
  placementError,
  questionsToPlace,
} from '../../lib/questionnaire/question-placement';
import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
  QuestionnaireSection,
} from '../../lib/questionnaire/types';
import { QuestionLibraryView } from '../question/QuestionLibraryView';

import { QuestionLibraryPicker } from './QuestionLibraryPicker';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import type { QuestionnaireEditorState } from './QuestionnaireView';
import { QuestionPlacementCard } from './QuestionPlacementCard';

export function QuestionnaireComposer({
  initialDraft,
  remoteUnavailable = false,
  reviewContext,
  onEditorState,
  paused = false,
}: {
  onEditorState?: (state: QuestionnaireEditorState) => void;
  paused?: boolean;
  initialDraft: QuestionnaireDraft;
  remoteUnavailable?: boolean;
  reviewContext?: QuestionnaireReviewContext;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [sections, setSections] = useState(initialDraft.sections);
  const [pickerSection, setPickerSection] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<
    string | undefined
  >();
  const [editorInstance, setEditorInstance] = useState(0);
  const [addMode, setAddMode] = useState<'new' | 'existing'>('new');
  const [questionState, setQuestionState] = useState({
    dirty: false,
    saving: false,
  });
  const [placing, setPlacing] = useState(false);
  const questionStateRef = useRef(questionState);
  const placementLock = useRef(false);
  const addHeading = useRef<HTMLHeadingElement | null>(null);
  const addTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (pickerSection) addHeading.current?.focus();
    else addTrigger.current?.focus();
  }, [pickerSection]);
  const reportQuestion = useCallback(
    (state: { dirty: boolean; saving: boolean }) => {
      questionStateRef.current = state;
      setQuestionState(state);
    },
    [],
  );
  const library = useQuestionLibrary();
  const questions = library.data ?? [];
  const hasPlacements = sections.some((s) =>
    s.questions.some((q) => q.sourceQuestionId),
  );
  const validation = library.data ? placementError(sections, questions) : null;
  const saveState = useQuestionnaireSave(
    {
      questionnaireId: initialDraft.questionnaireId,
      versionId: initialDraft.versionId,
      title,
      sections,
    },
    initialDraft,
    (draft) => {
      setTitle(draft.title);
      setSections(draft.sections);
    },
    remoteUnavailable,
    !title.trim()
      ? '질문지 제목이 비어 있어 저장할 수 없어요. 제목을 입력해 주세요.'
      : (validation ??
          (hasPlacements && (!library.data || library.error)
            ? '배치한 질문을 확인할 수 없어요. 질문 목록을 다시 불러와 주세요.'
            : null)),
    paused || pickerSection !== null,
    pickerSection !== null,
  );
  const { save, saving, dirty, savedAt, blocked, error } = saveState;
  useEffect(() => {
    onEditorState?.({
      dirty: dirty || questionState.dirty,
      saving: saving || questionState.saving || placing,
      emptyTitle: !title.trim(),
      childEditorOpen: pickerSection !== null,
    });
  }, [
    onEditorState,
    dirty,
    saving,
    title,
    questionState,
    placing,
    pickerSection,
  ]);
  const placedIds = new Set(
    sections.flatMap((s) =>
      s.questions.flatMap((q) =>
        q.sourceQuestionId ? [q.sourceQuestionId] : [],
      ),
    ),
  );
  const count = sections.reduce((sum, s) => sum + s.questions.length, 0);

  function commit(
    next: QuestionnaireSection[],
    availableQuestions = questions,
  ) {
    const issue = library.data
      ? placementError(next, availableQuestions)
      : hasPlacements
        ? '질문 목록을 불러온 뒤 배치를 변경해 주세요.'
        : null;
    if (issue && !validation) {
      toast.add({ type: 'error', title: issue, timeout: 5000 });
      return false;
    }
    setSections(next);
    return true;
  }
  function moveQuestion(
    sectionId: string,
    questionId: string,
    direction: number,
  ) {
    const next = structuredClone(sections);
    const si = next.findIndex((s) => s.id === sectionId);
    const qi = next[si].questions.findIndex((q) => q.id === questionId);
    const ni = qi + direction;
    if (ni >= 0 && ni < next[si].questions.length) {
      [next[si].questions[qi], next[si].questions[ni]] = [
        next[si].questions[ni],
        next[si].questions[qi],
      ];
    } else {
      const target = next[si + direction];
      if (!target || target.questions.length >= 100) return;
      const [question] = next[si].questions.splice(qi, 1);
      if (direction < 0) target.questions.push(question);
      else target.questions.unshift(question);
    }
    commit(next);
  }
  function add(id: string, availableQuestions = questions) {
    if (!pickerSection || blocked) return;
    try {
      const additions = questionsToPlace(id, sections, availableQuestions).map(
        createPlacement,
      );
      const target = sections.find((s) => s.id === pickerSection);
      if (!target || target.questions.length + additions.length > 100)
        throw new Error('한 섹션에는 질문을 100개까지 배치할 수 있어요.');
      if (
        commit(
          sections.map((s) =>
            s.id === pickerSection
              ? { ...s, questions: [...s.questions, ...additions] }
              : s,
          ),
          availableQuestions,
        )
      ) {
        closeQuestionAdder();
        toast.add({
          type: 'success',
          title: `질문 ${additions.length}개를 배치했어요.`,
          timeout: 2500,
        });
      }
    } catch (cause) {
      toast.add({
        type: 'error',
        title:
          cause instanceof Error ? cause.message : '질문을 배치하지 못했어요.',
        timeout: 5000,
      });
    }
  }

  function closeQuestionAdder() {
    setPickerSection(null);
    setEditingQuestionId(undefined);
    setQuestionState({ dirty: false, saving: false });
    questionStateRef.current = { dirty: false, saving: false };
  }
  function openQuestionAdder(sectionId: string, trigger: HTMLButtonElement) {
    addTrigger.current = trigger;
    setEditingQuestionId(undefined);
    setAddMode('new');
    setPickerSection(sectionId);
  }
  async function placeCreated(question: QuestionBlockRow) {
    if (placementLock.current) return;
    placementLock.current = true;
    setPlacing(true);
    try {
      const refreshed = await library.mutate();
      if (!refreshed)
        throw new Error('질문 목록을 불러오지 못했어요. 다시 시도해 주세요.');
      const available = [
        question,
        ...refreshed.filter((q) => q.id !== question.id),
      ];
      if (placedIds.has(question.id)) closeQuestionAdder();
      else add(question.id, available);
    } catch (error) {
      toast.add({
        type: 'error',
        title:
          error instanceof Error ? error.message : '질문을 배치하지 못했어요.',
      });
    } finally {
      placementLock.current = false;
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-end gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              섹션 {sections.length}개 · 질문 {count}개
            </span>
            <Button
              onClick={() => void save()}
              disabled={
                saving ||
                blocked ||
                !!validation ||
                (hasPlacements && (!library.data || !!library.error)) ||
                !dirty
              }
            >
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              저장
            </Button>
          </div>
        </header>
        <p className="text-xs text-muted-foreground" role="status">
          {saving
            ? '저장 중…'
            : dirty
              ? '변경 사항이 있어요 · 10초마다 자동 저장'
              : savedAt
                ? '모든 변경 사항을 저장했어요'
                : '질문을 배치하면 10초마다 자동 저장됩니다.'}
        </p>
        {(error || validation) && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
          >
            {validation || error}
          </p>
        )}
        <Tabs.Root defaultValue="edit">
          <Tabs.List
            className="mb-4 inline-flex gap-1 rounded-full bg-muted p-1"
            aria-label="질문지 보기 방식"
          >
            <Tabs.Tab
              value="edit"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm data-active:bg-background"
            >
              <PencilLine className="size-4" />
              배치
            </Tabs.Tab>
            <Tabs.Tab
              value="preview"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm data-active:bg-background"
            >
              <Eye className="size-4" />
              미리보기
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="preview" className="rounded-2xl border">
            <QuestionnairePreview
              title={title}
              sections={sections}
              library={questions}
            />
          </Tabs.Panel>
          <Tabs.Panel
            value="edit"
            keepMounted
            className="space-y-8 rounded-2xl border bg-background p-5 sm:p-8 data-[hidden]:hidden"
          >
            <div>
              <label
                htmlFor="questionnaire-title"
                className="text-sm font-medium"
              >
                질문지 제목
              </label>
              <Input
                id="questionnaire-title"
                value={title}
                disabled={blocked}
                maxLength={500}
                placeholder="제목을 입력하세요"
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 h-12 text-lg"
              />
            </div>
            {sections.map((section, si) => (
              <section
                key={section.id}
                className="space-y-4 border-t pt-6"
                aria-label={`섹션 ${si + 1}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={`section-${section.id}`}
                    className="text-sm font-medium"
                  >
                    섹션 {si + 1}
                  </label>
                  <Input
                    id={`section-${section.id}`}
                    value={section.title}
                    disabled={blocked}
                    maxLength={500}
                    placeholder="섹션 제목"
                    className="min-w-40 flex-1"
                    onChange={(event) =>
                      setSections(
                        sections.map((s) =>
                          s.id === section.id
                            ? { ...s, title: event.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                  {[-1, 1].map((direction) => (
                    <Button
                      key={direction}
                      variant="ghost"
                      size="icon-sm"
                      disabled={
                        blocked ||
                        si + direction < 0 ||
                        si + direction >= sections.length
                      }
                      aria-label={`섹션 ${si + 1} ${direction < 0 ? '위로' : '아래로'} 이동`}
                      onClick={() => {
                        const next = [...sections];
                        [next[si], next[si + direction]] = [
                          next[si + direction],
                          next[si],
                        ];
                        commit(next);
                      }}
                    >
                      {direction < 0 ? <ArrowUp /> : <ArrowDown />}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={blocked}
                    aria-label={`섹션 ${si + 1} 삭제`}
                    onClick={() => {
                      if (
                        !section.questions.length ||
                        window.confirm(
                          '이 섹션과 배치된 질문을 질문지에서 제거할까요? 원본 질문은 유지됩니다.',
                        )
                      )
                        commit(sections.filter((s) => s.id !== section.id));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {section.questions.length === 0 && (
                  <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    이 섹션에 질문을 배치해 주세요.
                  </p>
                )}
                {section.questions.map((question, qi) => {
                  const source = questions.find(
                    (q) => q.id === question.sourceQuestionId,
                  );
                  return (
                    <div
                      key={question.id}
                      className="space-y-3 rounded-xl border p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          질문 {qi + 1}
                        </span>
                        <div className="flex gap-1">
                          {[-1, 1].map((direction) => (
                            <Button
                              key={direction}
                              variant="ghost"
                              size="icon-sm"
                              disabled={
                                blocked ||
                                (direction < 0
                                  ? si === 0 && qi === 0
                                  : si === sections.length - 1 &&
                                    qi === section.questions.length - 1)
                              }
                              aria-label={`섹션 ${si + 1} 질문 ${qi + 1} ${direction < 0 ? '위로' : '아래로'} 이동`}
                              onClick={() =>
                                moveQuestion(section.id, question.id, direction)
                              }
                            >
                              {direction < 0 ? <ArrowUp /> : <ArrowDown />}
                            </Button>
                          ))}
                          {source && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={blocked}
                              aria-label={`섹션 ${si + 1} 질문 ${qi + 1} 수정`}
                              title="질문 수정"
                              onClick={(event) => {
                                addTrigger.current = event.currentTarget;
                                setEditingQuestionId(source.id);
                                setAddMode('new');
                                setPickerSection(section.id);
                              }}
                            >
                              <PencilLine aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={blocked}
                            aria-label={`섹션 ${si + 1} 질문 ${qi + 1} 배치 제거`}
                            onClick={() => {
                              commit(
                                sections.map((s) =>
                                  s.id === section.id
                                    ? {
                                        ...s,
                                        questions: s.questions.filter(
                                          (q) => q.id !== question.id,
                                        ),
                                      }
                                    : s,
                                ),
                              );
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      {source ? (
                        <QuestionPlacementCard
                          question={source}
                          showSourceLink={false}
                        />
                      ) : (
                        <p
                          role="alert"
                          className="text-sm text-muted-foreground"
                        >
                          {library.error
                            ? '질문을 불러오지 못했어요.'
                            : library.isLoading
                              ? '질문을 불러오고 있어요.'
                              : '원본 질문을 찾을 수 없어요. 원본 질문을 저장한 뒤 다시 배치해 주세요.'}
                        </p>
                      )}
                      {reviewContext && (
                        <QuestionnaireReviews
                          {...reviewContext}
                          questionId={question.id}
                          initialReviews={reviewContext.initialReviews.filter(
                            (review) => review.question_id === question.id,
                          )}
                        />
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  disabled={blocked || section.questions.length >= 100}
                  onClick={(event) =>
                    openQuestionAdder(section.id, event.currentTarget)
                  }
                >
                  <Plus />
                  질문 추가하기
                </Button>
              </section>
            ))}
            <Button
              variant="outline"
              className="w-full border-dashed"
              disabled={blocked || sections.length >= 50}
              onClick={() =>
                setSections([
                  ...sections,
                  { id: crypto.randomUUID(), title: '', questions: [] },
                ])
              }
            >
              <Plus />
              섹션 추가
            </Button>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
      <Drawer
        open={pickerSection !== null}
        onOpenChange={(open) => {
          if (open || placing || questionStateRef.current.saving) return;
          if (
            !questionStateRef.current.dirty ||
            window.confirm('저장하지 않은 질문 변경 내용을 버릴까요?')
          )
            closeQuestionAdder();
        }}
      >
        <DrawerContent
          className="h-dvh max-h-dvh rounded-none md:w-[min(960px,95vw)] md:max-w-none"
          finalFocus={() => addTrigger.current}
        >
          <DrawerHeader>
            <DrawerTitle className="sr-only">질문 추가 및 수정</DrawerTitle>
            <DrawerDescription className="sr-only">
              새 질문을 만들거나 저장된 질문을 불러와 원본을 수정하고
              배치합니다.
            </DrawerDescription>
          </DrawerHeader>
          {pickerSection && (
            <section
              aria-label="질문 추가하기"
              className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-8 sm:px-8"
              aria-busy={placing}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  ref={addHeading}
                  tabIndex={-1}
                  className="text-xl font-semibold"
                >
                  {editingQuestionId ? '질문 수정' : '질문 추가하기'}
                </h2>
              </div>
              <Tabs.Root
                value={addMode}
                onValueChange={(value) => {
                  if (placing || questionStateRef.current.saving) return;
                  setAddMode(value as 'new' | 'existing');
                }}
              >
                <Tabs.List
                  aria-label="질문 추가 방식"
                  className="mb-5 inline-flex gap-1 rounded-full bg-muted p-1"
                >
                  <Tabs.Tab
                    value="new"
                    disabled={placing || questionState.saving}
                    className="rounded-full px-4 py-2 text-sm data-active:bg-background"
                  >
                    새 질문 만들기
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="existing"
                    disabled={placing || questionState.saving}
                    className="rounded-full px-4 py-2 text-sm data-active:bg-background"
                  >
                    저장된 질문 불러오기
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel
                  value="new"
                  keepMounted
                  className="data-[hidden]:hidden"
                >
                  {editingQuestionId && addMode === 'new' && (
                    <p className="text-sm text-muted-foreground">
                      저장하면 원본 질문이 수정됩니다.
                    </p>
                  )}

                  <QuestionLibraryView
                    key={`${editingQuestionId ?? 'new'}:${editorInstance}`}
                    embedded={{
                      questionId: editingQuestionId,
                      actionLabel:
                        editingQuestionId && placedIds.has(editingQuestionId)
                          ? '완료'
                          : '질문지에 배치',
                      onSaved: (saved) => {
                        void library.mutate(
                          (current) => [
                            saved,
                            ...(current ?? []).filter((q) => q.id !== saved.id),
                          ],
                          { revalidate: false },
                        );
                      },
                      onPlace: placeCreated,
                      paused: paused || placing,
                      onCancel: closeQuestionAdder,
                      onStateChange: reportQuestion,
                    }}
                  />
                </Tabs.Panel>
                <Tabs.Panel value="existing">
                  {addMode === 'existing' && (
                    <>
                      <QuestionLibraryPicker
                        questions={questions}
                        placedIds={placedIds}
                        onAdd={(id) => {
                          if (placing || questionStateRef.current.saving)
                            return;
                          if (
                            questionStateRef.current.dirty &&
                            !window.confirm(
                              '작성 중인 새 질문의 저장하지 않은 변경 내용을 버리고 저장된 질문을 배치할까요?',
                            )
                          )
                            return;
                          setEditingQuestionId(id);
                          setEditorInstance((value) => value + 1);
                          setQuestionState({ dirty: false, saving: false });
                          questionStateRef.current = {
                            dirty: false,
                            saving: false,
                          };
                          setAddMode('new');
                        }}
                        error={library.error?.message}
                        loading={library.isLoading}
                        refresh={() => void library.mutate()}
                      />
                    </>
                  )}
                </Tabs.Panel>
              </Tabs.Root>
            </section>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
