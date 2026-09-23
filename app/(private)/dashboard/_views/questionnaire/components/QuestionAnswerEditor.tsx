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
      <span id={`${id}-label`} className={questionnaireStyles.questionLabel}>
        내 답변
      </span>
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
          compact
          ariaLabelledBy={`${id}-label`}
          value={answer}
          onChange={(value) => change(questionId, value)}
          placeholder="답변을 입력해 주세요"
        />
      )}
    </section>
  );
}
