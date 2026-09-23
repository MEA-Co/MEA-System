'use client';

import { Tabs } from '@base-ui/react/tabs';
import {
  Eye,
  FileText,
  LoaderCircle,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import type {
  QuestionnaireDraft,
  QuestionnaireReviewContext,
  QuestionnaireSection as Section,
} from '@/app/(private)/dashboard/_views/questionnaire/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useQuestionnaireSave } from '../hooks/useQuestionnaireSave';

import { QuestionDetailsEditor } from './QuestionDetailsEditor';
import { questionnaireStyles } from './questionnaire-styles';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
import { QuestionTypeEditor } from './QuestionTypeEditor';

export function QuestionnaireEditor({
  initialDraft,
  remoteUnavailable = false,
  reviewContext,
}: {
  initialDraft: QuestionnaireDraft;
  remoteUnavailable?: boolean;
  reviewContext?: QuestionnaireReviewContext;
}) {
  const [title, setTitle] = useState(initialDraft.title);
  const [sections, setSections] = useState<Section[]>(initialDraft.sections);
  const { save, saving, dirty, savedAt, error, blocked } = useQuestionnaireSave(
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
  );
  const questionCount = sections.reduce(
    (total, section) => total + section.questions.length,
    0,
  );

  function updateSection(id: string, update: (section: Section) => Section) {
    setSections((current) =>
      current.map((section) => (section.id === id ? update(section) : section)),
    );
  }

  function addSection() {
    const section: Section = {
      id: crypto.randomUUID(),
      title: '',
      questions: [
        {
          id: crypto.randomUUID(),
          logicalKey: crypto.randomUUID(),
          text: '',
          details: [],
        },
      ],
    };
    setSections((current) => [...current, section]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">질문지 제작</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            컨설턴트에게 전달할 질문과 설명을 작성해 보세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            섹션 {sections.length}개 · 질문 {questionCount}개
          </span>
          <Button
            onClick={() => void save()}
            disabled={saving || blocked || (!dirty && !!savedAt)}
          >
            {saving ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {saving ? '저장 중' : '저장'}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Tabs.Root defaultValue="edit">
        <Tabs.List
          className="mb-4 inline-flex max-w-full gap-1 rounded-full bg-neutral-200/70 p-1 dark:bg-neutral-800"
          aria-label="질문지 보기 방식"
        >
          {[
            { value: 'edit', label: '편집', icon: PencilLine },
            { value: 'consultant', label: '미리보기', icon: Eye },
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-active:bg-background data-active:text-foreground data-active:shadow-sm"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-background dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-300">
            <FileText className="size-4" aria-hidden="true" />
            <span role="status">
              {saving
                ? '저장 중…'
                : error
                  ? '저장되지 않은 내용이 있어요.'
                  : dirty
                    ? '변경 사항이 있어요 · 10초마다 자동 저장'
                    : savedAt
                      ? '모든 변경 사항을 저장했어요 · 10초마다 자동 저장'
                      : '내용을 입력하면 10초마다 자동 저장됩니다.'}
            </span>
          </div>
          <Tabs.Panel
            value="consultant"
            className="bg-background dark:bg-neutral-900"
          >
            <QuestionnairePreview title={title} sections={sections} />
          </Tabs.Panel>
          <Tabs.Panel
            value="edit"
            keepMounted
            className="space-y-10 bg-background p-5 sm:p-10 dark:bg-neutral-900 data-[hidden]:hidden"
          >
            <div>
              <label
                htmlFor="questionnaire-title"
                className="text-xs font-medium text-muted-foreground"
              >
                질문지 제목
              </label>
              <Textarea
                id="questionnaire-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목을 입력하세요"
                rows={1}
                className={`mt-2 min-h-14 resize-none rounded-lg px-4 text-2xl font-semibold md:text-3xl ${questionnaireStyles.input}`}
              />
            </div>

            {sections.map((section, sectionIndex) => (
              <section
                key={section.id}
                aria-label={`섹션 ${sectionIndex + 1}`}
                className="border-t pt-8"
              >
                <div className="mb-5 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`section-${section.id}`}
                      className="block text-xs font-medium text-muted-foreground"
                    >
                      섹션 {sectionIndex + 1}
                    </label>
                    <Input
                      id={`section-${section.id}`}
                      value={section.title}
                      onChange={(event) =>
                        updateSection(section.id, (current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="소제목을 입력하세요"
                      className={`mt-2 h-12 rounded-lg px-4 text-lg font-semibold sm:max-w-[66%] md:text-lg ${questionnaireStyles.input}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`섹션 ${sectionIndex + 1} 삭제`}
                    onClick={() =>
                      setSections((current) =>
                        current.filter((item) => item.id !== section.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {section.questions.map((question, questionIndex) => (
                    <div key={question.id}>
                      <div className={questionnaireStyles.questionCard}>
                        <div className="flex items-center justify-between gap-3">
                          <QuestionTypeEditor
                            part="header"
                            question={question}
                            disabled={blocked}
                            onChange={(updated) =>
                              updateSection(section.id, (current) => ({
                                ...current,
                                questions: current.questions.map((item) =>
                                  item.id === question.id ? updated : item,
                                ),
                              }))
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`섹션 ${sectionIndex + 1} 질문 ${questionIndex + 1} 삭제`}
                            onClick={() =>
                              updateSection(section.id, (current) => ({
                                ...current,
                                questions: current.questions.filter(
                                  (item) => item.id !== question.id,
                                ),
                              }))
                            }
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span
                            id={`question-${question.id}-label`}
                            className="w-6 shrink-0 pt-3 text-sm font-semibold tabular-nums text-neutral-600 dark:text-neutral-300"
                          >
                            <span className="sr-only">
                              섹션 {sectionIndex + 1} 질문{' '}
                            </span>
                            {questionIndex + 1}
                          </span>
                          <QuestionRichTextEditor
                            id={`question-${question.id}`}
                            value={question.text}
                            ariaLabelledBy={`question-${question.id}-label`}
                            placeholder="질문을 입력하세요"
                            compact
                            className="min-w-0 flex-1 rounded-lg"
                            onChange={(text) =>
                              updateSection(section.id, (current) => ({
                                ...current,
                                questions: current.questions.map((item) =>
                                  item.id === question.id
                                    ? { ...item, text }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <QuestionDetailsEditor
                          details={question.details}
                          onChange={(details) =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              questions: current.questions.map((item) =>
                                item.id === question.id
                                  ? { ...item, details }
                                  : item,
                              ),
                            }))
                          }
                        />
                        <QuestionTypeEditor
                          question={question}
                          disabled={blocked}
                          onChange={(updated) =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              questions: current.questions.map((item) =>
                                item.id === question.id ? updated : item,
                              ),
                            }))
                          }
                        />
                      </div>
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
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  onClick={() => {
                    const question = {
                      id: crypto.randomUUID(),
                      logicalKey: crypto.randomUUID(),
                      text: '',
                      details: [],
                    };
                    updateSection(section.id, (current) => ({
                      ...current,
                      questions: [...current.questions, question],
                    }));
                  }}
                >
                  <Plus aria-hidden="true" />
                  질문 추가
                </Button>
              </section>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed border-neutral-300 bg-background text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              onClick={addSection}
            >
              <Plus aria-hidden="true" />
              섹션 추가
            </Button>
          </Tabs.Panel>
        </div>
      </Tabs.Root>
    </div>
  );
}
