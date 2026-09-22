'use client';

import type { Question } from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { useAnswers } from './QuestionnaireAnswers';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
import { RichTextContent } from './RichTextContent';

export function QuestionAnswerEditor({ question }: { question: Question }) {
  const questionId = question.id;
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
      {question.kind && question.kind !== 'text' ? (
        <QuestionChoiceInput
          question={question}
          value={answer}
          onChange={(value) => change(questionId, value)}
          disabled={locked}
        />
      ) : locked ? (
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
