'use client';

import { useEffect, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';

import { Button } from '@/components/ui/button';

import { useQuestionResponseEditor } from '../../hooks/responses/useQuestionResponseEditor';
import type { QuestionResponseSnapshot } from '../../lib/question-responses';
import { QUESTIONNAIRE_API } from '../../lib/questionnaire/api-client';
import { requestQuestionResponse } from '../../lib/responses/api-client';
import { focusResponseQuestion } from '../../lib/responses/submission-navigation';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';
import type { QuestionnaireEditorState } from './QuestionnaireView';

export function QuestionResponseForm(props: {
  embedded?: boolean;
  questionnaireId: string;
  published?: boolean;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  beforeLinkRegistration?: () => Promise<boolean>;
}) {
  return (
    <ResponseSession
      key={`${props.questionnaireId}:${!!props.published}`}
      {...props}
    />
  );
}
function ResponseSession({
  questionnaireId,
  onEditorState,
  beforeLinkRegistration,
  published = false,
  embedded = false,
}: {
  embedded?: boolean;
  questionnaireId: string;
  published?: boolean;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  beforeLinkRegistration?: () => Promise<boolean>;
}) {
  const { mutate } = useSWRConfig();
  const [remote, setRemote] = useState<QuestionResponseSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void requestQuestionResponse(questionnaireId, 'POST', {}, published)
      .then((data) => {
        if (!cancelled) {
          setRemote(data);
          if (published) void mutate(`${QUESTIONNAIRE_API}/unread`);
          setError('');
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [questionnaireId, attempt, published, mutate]);
  if (!remote)
    return error ? (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <Button onClick={() => setAttempt((v) => v + 1)}>다시 시도</Button>
      </div>
    ) : (
      <QuestionnaireLoading />
    );
  return (
    <ResponseEditor
      key={remote.id}
      questionnaireId={questionnaireId}
      embedded={embedded}
      initial={remote}
      published={published}
      onEditorState={onEditorState}
      beforeLinkRegistration={beforeLinkRegistration}
    />
  );
}
function ResponseEditor({
  questionnaireId,
  initial,
  onEditorState,
  beforeLinkRegistration,
  published = false,
  embedded = false,
}: {
  embedded?: boolean;
  questionnaireId: string;
  published?: boolean;
  initial: QuestionResponseSnapshot;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  beforeLinkRegistration?: () => Promise<boolean>;
}) {
  const {
    submissionIssues,
    invalidSubmission,
    rows,
    snapshot,
    hasResponseQuestions,
    remoteAnswerVersion,
    savedAt,
    saving,
    error,
    dirty,
    locked,
    pendingSave,
    save,
    change,
  } = useQuestionResponseEditor({
    questionnaireId,
    initial,
    onEditorState,
    published,
  });
  const [registrationSaving, setRegistrationSaving] = useState(false);
  async function saveBeforeRegistration() {
    setRegistrationSaving(true);
    try {
      if (!(await save())) return false;
      return beforeLinkRegistration ? await beforeLinkRegistration() : true;
    } finally {
      setRegistrationSaving(false);
    }
  }
  const container = useRef<HTMLDivElement>(null);
  function goToQuestion(questionId: string) {
    focusResponseQuestion(
      container.current,
      questionId,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }
  useEffect(() => {
    if (invalidSubmission) goToQuestion(invalidSubmission.questionId);
  }, [invalidSubmission]);
  const invalidQuestions = [
    ...new Set(submissionIssues.map((issue) => issue.questionId)),
  ];
  const questionLocation = (id: string) => {
    for (const [sectionIndex, section] of snapshot.sections.entries()) {
      const index = section.questions.findIndex(
        (question) => question.sourceQuestionId === id,
      );
      if (index >= 0)
        return `${section.title || `섹션 ${sectionIndex + 1}`} · ${index + 1}번 질문`;
    }
    return '질문';
  };
  return (
    <div ref={container} className="space-y-4">
      {hasResponseQuestions && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
          <p role="status" className="text-sm text-muted-foreground">
            {saving
              ? '저장 중…'
              : dirty
                ? '작성 중 · 10초마다 자동 저장돼요.'
                : savedAt
                  ? '저장 완료 · 언제든 수정할 수 있어요.'
                  : '답변을 작성해 주세요.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={locked || saving || !dirty}
              onClick={() => void save()}
            >
              저장
            </Button>
            {published && (
              <Button
                disabled={locked || saving || !!pendingSave}
                onClick={() => void save(true)}
              >
                제출
              </Button>
            )}
          </div>
        </div>
      )}
      {published && hasResponseQuestions && (
        <p className="text-sm text-muted-foreground">
          저장한 답변은 본인만 볼 수 있습니다. 제출하면 리드에게 공개되며, 제출
          후에도 수정할 수 있습니다.
          {snapshot.submittedAt && (
            <span className="block mt-1">
              마지막 제출:{' '}
              {new Date(snapshot.submittedAt).toLocaleString('ko-KR')}
              {(dirty || snapshot.hasUnsubmittedChanges) &&
                ' · 수정 내용은 다시 제출해야 공개됩니다.'}
            </span>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {submissionIssues.length > 0 && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="font-semibold">
            제출 전 {invalidQuestions.length}개 질문을 확인해 주세요.
          </p>
          <ul className="space-y-2">
            {invalidQuestions.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="text-left text-sm text-destructive underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => goToQuestion(id)}
                >
                  <span className="font-semibold">{questionLocation(id)}</span>
                  {' — '}
                  {
                    submissionIssues.find((issue) => issue.questionId === id)
                      ?.message
                  }
                  {submissionIssues.filter((issue) => issue.questionId === id)
                    .length > 1 && ' 외 추가 확인 항목'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {snapshot.sourceDeleted && (
        <p className="text-sm text-muted-foreground">
          원본 질문지가 삭제되었어요. 보관된 구성에서 내 답변을 계속 수정할 수
          있어요.
        </p>
      )}
      <QuestionnairePreview
        embedded={embedded}
        submissionIssues={submissionIssues}
        notices={snapshot.notices}
        beforeLinkRegistration={saveBeforeRegistration}
        registrationDisabled={
          locked || saving || registrationSaving || !!pendingSave
        }
        reviewQuestionnaireId={
          published || snapshot.sourceDeleted ? undefined : questionnaireId
        }
        key={remoteAnswerVersion}
        title={snapshot.title}
        sections={snapshot.sections}
        library={snapshot.questions.map((q) => q.definition)}
        showPrivateDetails={!published}
        showGuideAnswers={published}
        response={{
          rows,
          onChange: change,
          disabled: locked || registrationSaving || !!pendingSave?.complete,
        }}
      />
    </div>
  );
}
