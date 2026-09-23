'use client';

import type { Question } from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { questionnaireStyles } from './questionnaire-styles';
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
      className={questionnaireStyles.answerArea}
      aria-labelledby={`${id}-label`}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={questionnaireStyles.questionLabel}
      >
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
