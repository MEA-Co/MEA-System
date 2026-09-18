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
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireReviews } from './QuestionnaireReviews';

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
          className="mb-4 inline-flex max-w-full gap-1 rounded-xl bg-muted p-1"
          aria-label="질문지 보기 방식"
        >
          {[
            { value: 'edit', label: '편집', icon: PencilLine },
            { value: 'consultant', label: '미리보기', icon: Eye },
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-active:bg-background data-active:text-foreground data-active:shadow-sm"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
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
          <Tabs.Panel value="consultant">
            <QuestionnairePreview title={title} sections={sections} />
          </Tabs.Panel>
          <Tabs.Panel
            value="edit"
            keepMounted
            className="space-y-10 p-5 sm:p-10 data-[hidden]:hidden"
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
                className="mt-2 min-h-14 resize-none rounded-lg border-border bg-muted px-4 text-2xl font-semibold shadow-none md:text-3xl"
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
                      className="text-xs font-medium text-muted-foreground"
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
                      className="mt-2 h-12 rounded-lg border-border bg-muted px-4 text-lg font-semibold shadow-none md:text-lg"
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
                      <div className="flex items-start gap-2 sm:gap-3">
                        <label
                          htmlFor={`question-${question.id}`}
                          className="pt-3 text-xs font-semibold text-muted-foreground"
                        >
                          <span className="sr-only">
                            섹션 {sectionIndex + 1} 질문{' '}
                          </span>
                          {questionIndex + 1}.
                        </label>
                        <Textarea
                          id={`question-${question.id}`}
                          value={question.text}
                          placeholder="질문을 입력하세요"
                          rows={2}
                          className="min-w-0 flex-1 resize-y rounded-lg border-border bg-muted"
                          onChange={(event) =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              questions: current.questions.map((item) =>
                                item.id === question.id
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="mt-1"
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
                  className="mt-4"
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
              className="w-full border-dashed"
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
