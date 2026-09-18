'use client';

import { useAnswers } from './QuestionnaireAnswers';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
import { RichTextContent } from './RichTextContent';

export function QuestionAnswerEditor({ questionId }: { questionId: string }) {
  const { answers, locked, change } = useAnswers();
  const answer = answers[questionId] ?? '';
  const id = `answer-${questionId}`;
  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-labelledby={`${id}-label`}
    >
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-medium">
        내 답변
      </label>
      {locked ? (
        <RichTextContent value={answer || '답변 없음'} />
      ) : (
        <QuestionRichTextEditor
          id={id}
          ariaLabel="내 답변"
          value={answer}
          onChange={(value) => change(questionId, value)}
          placeholder="이 질문에 대한 답변을 작성해 주세요"
        />
      )}
    </section>
  );
}
