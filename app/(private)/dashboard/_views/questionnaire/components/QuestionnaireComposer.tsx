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
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

import { useQuestionLibrary } from '../hooks/useQuestionLibrary';
import { useQuestionnaireSave } from '../hooks/useQuestionnaireSave';
import {
  createPlacement,
  placementError,
  questionsToPlace,
} from '../lib/question-placement';
import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
  QuestionnaireSection,
} from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { QuestionLibraryPicker } from './QuestionLibraryPicker';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import { QuestionPlacementCard } from './QuestionPlacementCard';
import { RichTextContent } from './RichTextContent';

export function QuestionnaireComposer({
  initialDraft,
  remoteUnavailable = false,
  reviewContext,
}: {
  initialDraft: QuestionnaireDraft;
  remoteUnavailable?: boolean;
  reviewContext?: QuestionnaireReviewContext;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [sections, setSections] = useState(initialDraft.sections);
  const [pickerSection, setPickerSection] = useState<string | null>(null);
  const library = useQuestionLibrary();
  const questions = library.data ?? [];
  const hasPlacements = sections.some((s) =>
    s.questions.some((q) => q.sourceQuestionId),
  );
  const validation =
    hasPlacements && library.data ? placementError(sections, questions) : null;
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
    validation ??
      (hasPlacements && (!library.data || library.error)
        ? '배치한 질문을 확인할 수 없어요. 질문 목록을 다시 불러와 주세요.'
        : null),
  );
  const { save, saving, dirty, savedAt, blocked, error } = saveState;
  const placedIds = new Set(
    sections.flatMap((s) =>
      s.questions.flatMap((q) =>
        q.sourceQuestionId ? [q.sourceQuestionId] : [],
      ),
    ),
  );
  const count = sections.reduce((sum, s) => sum + s.questions.length, 0);

  function commit(next: QuestionnaireSection[]) {
    const issue = library.data
      ? placementError(next, questions)
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
  function add(id: string) {
    if (!pickerSection || blocked) return;
    try {
      const additions = questionsToPlace(id, sections, questions).map(
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
        )
      ) {
        setPickerSection(null);
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

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">질문지 제작</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            저장된 질문을 골라 섹션과 순서를 구성하세요.
          </p>
        </div>
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
              (!dirty && !!savedAt)
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
      <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
        질문 내용·답변 열·조건·설명은 질문 관리에서 수정합니다. 제작 중인
        질문지는 원본의 최신 내용을 보여줍니다.
        {hasPlacements &&
          ' 현재 새 방식은 제작·게시·미리보기까지 지원하며 배포는 아직 지원하지 않습니다.'}
      </p>
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
                        {!question.sourceQuestionId && ' · 기존 질문'}
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
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={blocked}
                          aria-label={`섹션 ${si + 1} 질문 ${qi + 1} 배치 제거`}
                          onClick={() => {
                            if (
                              question.sourceQuestionId ||
                              window.confirm(
                                '이 기존 질문을 질문지에서 제거할까요? 저장된 답변이 없는 질문만 편집할 수 있습니다.',
                              )
                            )
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
                      <QuestionPlacementCard question={source} />
                    ) : question.sourceQuestionId ? (
                      <p className="text-sm text-muted-foreground">
                        {library.error
                          ? '질문을 불러오지 못했어요.'
                          : library.isLoading
                            ? '질문을 불러오고 있어요.'
                            : '원본 질문을 찾을 수 없어요.'}
                      </p>
                    ) : (
                      <>
                        <RichTextContent value={question.text} />
                        {question.kind && question.kind !== 'text' && (
                          <QuestionChoiceInput question={question} disabled />
                        )}
                        <p className="text-xs text-muted-foreground">
                          기존 방식으로 작성된 질문입니다. 내용은 보존되며 순서
                          변경과 제거가 가능합니다.
                        </p>
                      </>
                    )}
                    {question.details.map((detail) => (
                      <div
                        key={detail.id}
                        className="rounded-lg bg-muted/40 p-3 text-sm"
                      >
                        <p className="mb-2 font-medium">
                          {detail.title || '설명'} ·{' '}
                          {detail.visibleToConsultants ? '공개' : '비공개'}
                        </p>
                        <RichTextContent value={detail.text} />
                      </div>
                    ))}
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
                onClick={() => setPickerSection(section.id)}
              >
                <Plus />
                저장된 질문 배치
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
      <QuestionLibraryPicker
        open={pickerSection !== null && !blocked}
        onOpenChange={(open) => {
          if (!open) setPickerSection(null);
        }}
        questions={questions}
        placedIds={placedIds}
        onAdd={add}
        error={library.error?.message}
        loading={library.isLoading}
        refresh={() => void library.mutate()}
      />
    </div>
  );
}
