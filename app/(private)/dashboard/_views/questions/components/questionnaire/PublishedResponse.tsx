'use client';

import type { QuestionBlockRow } from '../../lib/question-blocks';
import { useQuestionnaireResource } from '../../lib/questionnaire/api-client';
import type { QuestionnaireDraft } from '../../lib/questionnaire/types';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';
import type { QuestionnaireEditorState } from './QuestionnaireView';
import { QuestionResponseForm } from './QuestionResponseForm';

export function PublishedResponse({
  document,
  sources = [],
  onEditorState,
}: {
  document: QuestionnaireDraft;
  sources?: QuestionBlockRow[];
  onEditorState?: (state: QuestionnaireEditorState) => void;
}) {
  const { data, error } = useQuestionnaireResource<{ canWrite: boolean }>(
    '/guide-access',
  );
  if (error)
    return <p role="alert">답변 권한을 확인하지 못했어요. 다시 열어 주세요.</p>;
  if (!data) return <QuestionnaireLoading />;
  return data.canWrite ? (
    <>
      <p className="text-sm text-muted-foreground">
        내 답변 · 다른 컨설턴트에게 가이드로 제공됩니다.
      </p>
      <QuestionResponseForm
        questionnaireId={document.questionnaireId}
        onEditorState={onEditorState}
      />
    </>
  ) : (
    <QuestionnairePreview
      reviewQuestionnaireId={document.questionnaireId}
      title={document.title}
      sections={document.sections}
      library={sources}
      showPrivateDetails
    />
  );
}
