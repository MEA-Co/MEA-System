'use client';

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
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

import { useQuestionLibrary } from '../../hooks/questionnaire/useQuestionLibrary';
import { useQuestionnaireSave } from '../../hooks/questionnaire/useQuestionnaireSave';
import type { QuestionBlockRow } from '../../lib/question-blocks';
import { useQuestionnaireResource } from '../../lib/questionnaire/api-client';
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
import { questionCanvasClass } from '../question/question-styles';
import { QuestionLibraryView } from '../question/QuestionLibraryView';
import { QuestionRichTextEditor } from '../question/QuestionRichTextEditor';

import { QuestionLibraryPicker } from './QuestionLibraryPicker';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import type { QuestionnaireEditorState } from './QuestionnaireView';
import { QuestionPlacementCard } from './QuestionPlacementCard';
import { QuestionResponseForm } from './QuestionResponseForm';

export function QuestionnaireComposer({
  initialDraft,
  published = false,
  publishedSources = [],
  remoteUnavailable = false,
  reviewContext,
  onEditorState,
  paused = false,
  onClose,
}: {
  onClose?: () => void;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  paused?: boolean;
  initialDraft: QuestionnaireDraft;
  published?: boolean;
  publishedSources?: QuestionBlockRow[];
  remoteUnavailable?: boolean;
  reviewContext?: QuestionnaireReviewContext;
}) {
  const { data: guideAccess } = useQuestionnaireResource<{ canWrite: boolean }>(
    published ? '/guide-access' : null,
  );
  const [tab, setTab] = useState('edit');
  const [responseState, setResponseState] = useState({
    dirty: false,
    saving: false,
  });
  const reportResponse = useCallback((state: QuestionnaireEditorState) => {
    setResponseState((current) =>
      current.dirty === state.dirty && current.saving === state.saving
        ? current
        : { dirty: state.dirty, saving: state.saving },
    );
  }, []);
  const [title, setTitle] = useState(initialDraft.title);
  const [startNotice, setStartNotice] = useState(
    initialDraft.startNotice ?? null,
  );
  const [sections, setSections] = useState(initialDraft.sections);
  const [checkingRemoval, setCheckingRemoval] = useState(false);
  const removalLock = useRef(false);
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const [confirmedRemovedGuideQuestions, setConfirmedRemovedGuideQuestions] =
    useState<string[]>([]);
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
  const questions = [
    ...new Map(
      [...publishedSources, ...(library.data ?? [])].map((q) => [q.id, q]),
    ).values(),
  ];
  const hasPlacements = sections.some((s) =>
    s.questions.some((q) => q.sourceQuestionId),
  );
  const validation = library.data ? placementError(sections, questions) : null;
  const saveState = useQuestionnaireSave(
    {
      questionnaireId: initialDraft.questionnaireId,
      title,
      sections,
      startNotice,
    },
    initialDraft,
    (draft) => {
      setTitle(draft.title);
      setStartNotice(draft.startNotice ?? null);
      setSections(draft.sections);
    },
    remoteUnavailable,
    !title.trim()
      ? '질문지 제목이 비어 있어 저장할 수 없어요. 제목을 입력해 주세요.'
      : (validation ??
          (hasPlacements && (!library.data || library.error)
            ? '배치한 질문을 확인할 수 없어요. 질문 목록을 다시 불러와 주세요.'
            : null)),
    paused || pickerSection !== null || checkingRemoval,
    pickerSection !== null,
    confirmedRemovedGuideQuestions,
  );
  const { save, saving, dirty, savedAt, blocked, error } = saveState;
  async function removeQuestions(
    next: QuestionnaireSection[],
    removed: QuestionnaireSection['questions'],
    sectionRemoval = false,
  ) {
    if (saving || blocked || removalLock.current) return;
    removalLock.current = true;
    setCheckingRemoval(true);
    try {
      let occupied: string[] = [];
      if (initialDraft.revision > 0 && removed.length) {
        const response = await fetch(
          `/api/questionnaires/${initialDraft.questionnaireId}/guide-question-ids`,
          { cache: 'no-store' },
        );
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.questionIds)) throw new Error();
        occupied = removed.flatMap((question) =>
          question.sourceQuestionId &&
          data.questionIds.includes(question.sourceQuestionId)
            ? [question.sourceQuestionId]
            : [],
        );
      }
      if (occupied.length) {
        if (
          !window.confirm(
            '제거할 질문에 저장된 가이드 응답이 있습니다. 계속하면 이 질문지의 해당 가이드 응답이 삭제됩니다. 다른 질문지의 응답과 원본 질문은 유지됩니다. 계속하시겠습니까?',
          )
        )
          return;
      } else if (
        sectionRemoval &&
        removed.length &&
        !window.confirm(
          '이 섹션과 배치된 질문을 질문지에서 제거할까요? 원본 질문은 유지됩니다.',
        )
      )
        return;
      if (sectionsRef.current !== sections) throw new Error();
      const removedIds = new Set(
        removed.map((question) => question.sourceQuestionId),
      );
      setConfirmedRemovedGuideQuestions((current) => [
        ...new Set([
          ...current.filter((id) => !removedIds.has(id)),
          ...occupied,
        ]),
      ]);
      commit(next);
    } catch {
      toast.add({
        type: 'error',
        title: '가이드 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
      });
    } finally {
      removalLock.current = false;
      setCheckingRemoval(false);
    }
  }

  useEffect(() => {
    onEditorState?.({
      dirty: dirty || questionState.dirty || responseState.dirty,
      saving: saving || questionState.saving || placing || responseState.saving,
      emptyTitle: !title.trim(),
      childEditorOpen: pickerSection !== null,
    });
  }, [
    onEditorState,
    dirty,
    saving,
    title,
    questionState,
    responseState,
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
    setAddMode('existing');
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
    <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border">
      <div
        inert={paused || pickerSection !== null}
        className={cn(questionCanvasClass, 'space-y-5')}
        style={
          paused || pickerSection !== null ? { overflow: 'hidden' } : undefined
        }
      >
        <p className="text-sm text-muted-foreground">
          섹션 {sections.length}개 · 질문 {count}개
        </p>
        {(error || validation) && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
          >
            {validation || error}
          </p>
        )}
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (responseState.saving) return;
            if (
              responseState.dirty &&
              !window.confirm('저장되지 않은 답변을 버리고 화면을 전환할까요?')
            )
              return;
            setResponseState({ dirty: false, saving: false });
            setTab(value as string);
          }}
        >
          <TabsList className="mb-4" aria-label="질문지 보기 방식">
            <TabsTrigger value="edit" className="gap-2 px-4">
              <PencilLine className="size-4" />
              배치
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2 px-4">
              <Eye className="size-4" />
              미리보기
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="min-w-0">
            {published && guideAccess?.canWrite ? (
              <QuestionResponseForm
                questionnaireId={initialDraft.questionnaireId}
                onEditorState={reportResponse}
              />
            ) : (
              <QuestionnairePreview
                startNotice={startNotice}
                reviewQuestionnaireId={
                  published ? initialDraft.questionnaireId : undefined
                }
                title={title}
                sections={sections}
                library={questions}
                showGuideAnswers
              />
            )}
          </TabsContent>
          <TabsContent
            value="edit"
            keepMounted
            className="space-y-6 data-hidden:hidden"
          >
            <Card variant="accent">
              <CardContent>
                <Label
                  htmlFor="questionnaire-title"
                  className="text-sm font-medium"
                >
                  질문지 제목
                </Label>
                <Input
                  id="questionnaire-title"
                  value={title}
                  disabled={blocked || checkingRemoval || saving}
                  maxLength={500}
                  placeholder="제목을 입력하세요"
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 h-12 text-lg"
                />
              </CardContent>
            </Card>
            {startNotice ? (
              <Card variant="accent">
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="notice-title">질문지 시작 안내</Label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="시작 안내 삭제"
                      disabled={blocked || saving}
                      onClick={() => setStartNotice(null)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Input
                    id="notice-title"
                    aria-label="안내 제목"
                    placeholder="안내 제목"
                    maxLength={200}
                    value={startNotice.title}
                    disabled={blocked || saving}
                    onChange={(e) =>
                      setStartNotice({ ...startNotice, title: e.target.value })
                    }
                  />
                  <QuestionRichTextEditor
                    id="notice-body"
                    ariaLabel="안내 내용"
                    value={startNotice.body}
                    disabled={blocked || saving}
                    onChange={(body) =>
                      setStartNotice({ ...startNotice, body })
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!startNotice.buttonLabel}
                      disabled={blocked || saving}
                      onCheckedChange={(checked) =>
                        setStartNotice({
                          ...startNotice,
                          buttonLabel: checked ? '학습법 추가' : '',
                        })
                      }
                    />
                    학습법 등록 버튼 표시
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!startNotice.explorationButtonLabel}
                      disabled={blocked || saving}
                      onCheckedChange={(checked) =>
                        setStartNotice({
                          ...startNotice,
                          explorationButtonLabel: checked
                            ? '탐구활동 추가'
                            : '',
                        })
                      }
                    />
                    탐구활동 등록 버튼 표시
                  </label>
                  {startNotice.explorationButtonLabel && (
                    <Input
                      aria-label="탐구활동 등록 버튼 문구"
                      maxLength={100}
                      value={startNotice.explorationButtonLabel}
                      disabled={blocked || saving}
                      onChange={(e) =>
                        setStartNotice({
                          ...startNotice,
                          explorationButtonLabel: e.target.value,
                        })
                      }
                    />
                  )}
                  {startNotice.buttonLabel && (
                    <Input
                      aria-label="학습법 등록 버튼 문구"
                      maxLength={100}
                      value={startNotice.buttonLabel}
                      disabled={blocked || saving}
                      onChange={(e) =>
                        setStartNotice({
                          ...startNotice,
                          buttonLabel: e.target.value,
                        })
                      }
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="h-11 w-full border-dashed bg-muted/60"
                disabled={blocked || saving}
                onClick={() =>
                  setStartNotice({ title: '', body: '', buttonLabel: '' })
                }
              >
                <Plus />
                시작 안내 추가
              </Button>
            )}
            {sections.map((section, si) => (
              <Card
                variant="accent"
                key={section.id}
                className="gap-0"
                aria-label={`섹션 ${si + 1}`}
              >
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 border-b pb-4">
                    <Label
                      htmlFor={`section-${section.id}`}
                      className="text-sm font-medium"
                    >
                      섹션 {si + 1}
                    </Label>
                    <Input
                      id={`section-${section.id}`}
                      value={section.title}
                      disabled={blocked || checkingRemoval || saving}
                      maxLength={500}
                      placeholder="섹션 제목"
                      className="min-w-0 basis-full sm:basis-auto sm:flex-1"
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
                      disabled={blocked || checkingRemoval || saving}
                      aria-label={`섹션 ${si + 1} 삭제`}
                      onClick={() =>
                        void removeQuestions(
                          sections.filter((s) => s.id !== section.id),
                          section.questions,
                          true,
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {section.questions.length === 0 && (
                    <p className="rounded-lg bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
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
                        className="space-y-3 rounded-lg border border-t-2 border-t-brand bg-background p-4 sm:p-5"
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
                                  moveQuestion(
                                    section.id,
                                    question.id,
                                    direction,
                                  )
                                }
                              >
                                {direction < 0 ? <ArrowUp /> : <ArrowDown />}
                              </Button>
                            ))}
                            {source && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={blocked || checkingRemoval || saving}
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
                              disabled={blocked || checkingRemoval || saving}
                              aria-label={`섹션 ${si + 1} 질문 ${qi + 1} 배치 제거`}
                              onClick={() =>
                                void removeQuestions(
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
                                  [question],
                                )
                              }
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
                            questionId={question.sourceQuestionId ?? undefined}
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
                    className="h-11 w-full border-dashed bg-muted/60 hover:bg-muted"
                    disabled={blocked || section.questions.length >= 100}
                    onClick={(event) =>
                      openQuestionAdder(section.id, event.currentTarget)
                    }
                  >
                    <Plus />
                    질문 추가하기
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="h-11 w-full bg-background"
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
          </TabsContent>
        </Tabs>
      </div>
      <footer
        inert={paused || pickerSection !== null}
        className="flex shrink-0 flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <p className="min-h-5 text-xs text-muted-foreground" role="status">
          {saving
            ? '저장 중…'
            : dirty
              ? '변경 사항이 있어요 · 10초마다 자동 저장'
              : savedAt
                ? '모든 변경 사항을 저장했어요'
                : '제목과 질문을 구성하면 10초마다 자동 저장됩니다.'}
        </p>
        <div className="flex shrink-0 justify-end gap-2">
          {onClose && (
            <Button
              variant="outline"
              disabled={saving || responseState.saving}
              onClick={onClose}
            >
              닫기
            </Button>
          )}
          <Button
            onClick={() => void save()}
            disabled={
              saving ||
              blocked ||
              checkingRemoval ||
              !!validation ||
              (hasPlacements && (!library.data || !!library.error)) ||
              !dirty
            }
          >
            {saving ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </footer>
      {pickerSection !== null && addMode === 'existing' && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeQuestionAdder();
          }}
        >
          <DialogContent
            className="flex h-[min(800px,85dvh)] min-h-0 flex-col overflow-hidden sm:max-w-4xl"
            finalFocus={() => addTrigger.current}
          >
            <DialogHeader className="shrink-0 pr-10">
              <DialogTitle>기존 질문 추가</DialogTitle>
              <DialogDescription>
                기존 질문을 원본 그대로 질문지에 연결합니다.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              onClick={() => {
                setEditingQuestionId(undefined);
                setEditorInstance((value) => value + 1);
                setAddMode('new');
              }}
            >
              <Plus />새 질문 만들기
            </Button>
            <QuestionLibraryPicker
              placedIds={placedIds}
              onAdd={add}
              error={library.error?.message}
              loading={library.isLoading}
              refresh={() => void library.mutate()}
            />
          </DialogContent>
        </Dialog>
      )}
      <Drawer
        open={pickerSection !== null && addMode === 'new'}
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
            <DrawerTitle>
              {editingQuestionId ? '질문 수정' : '새 질문 만들기'}
            </DrawerTitle>
            <DrawerDescription>
              {editingQuestionId
                ? '저장하면 원본 질문이 수정됩니다.'
                : '새 질문을 저장한 뒤 질문지에 배치합니다.'}
            </DrawerDescription>
          </DrawerHeader>
          <section
            aria-label="질문 편집"
            className="min-h-0 flex-1 overflow-y-auto"
            aria-busy={placing}
          >
            {pickerSection !== null && addMode === 'new' && (
              <QuestionLibraryView
                key={`${editingQuestionId ?? 'new'}:${editorInstance}`}
                embedded={{
                  questionId: editingQuestionId,
                  allowSharedEdit: published,
                  questionnaireId: initialDraft.questionnaireId,
                  sharedSources: questions,
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
            )}
          </section>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
