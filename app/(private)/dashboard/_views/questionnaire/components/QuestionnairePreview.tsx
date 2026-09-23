import { cn } from '@/lib/utils';

import type { QuestionnaireSection } from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
import { questionnaireStyles } from './questionnaire-styles';
import { QuestionTextAnswerPreview } from './QuestionTextAnswerPreview';
import { RichTextContent } from './RichTextContent';

export function QuestionnairePreview({
  title,
  sections,
}: {
  title: string;
  sections: QuestionnaireSection[];
}) {
  return (
    <div className="space-y-8 p-5 sm:p-10">
      <h2 className="whitespace-pre-wrap wrap-break-word text-3xl font-semibold">
        {title || '제목 없는 질문지'}
      </h2>
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className="space-y-5">
          <h3
            className={cn(
              questionnaireStyles.sectionHeading,
              'bg-transparent px-0 dark:bg-transparent',
            )}
          >
            <span className={questionnaireStyles.sectionNumber}>
              {sectionIndex + 1}
            </span>
            <span className="min-w-0 whitespace-pre-wrap wrap-break-word">
              {section.title || '제목 없는 섹션'}
            </span>
          </h3>
          {section.questions.map((question, questionIndex) => (
            <div key={question.id} className={questionnaireStyles.questionCard}>
              <div className="flex items-start gap-2 font-medium">
                <span
                  className={`w-6 shrink-0 tabular-nums ${questionnaireStyles.questionLabel}`}
                >
                  {questionIndex + 1}
                </span>
                <RichTextContent
                  className="min-w-0 flex-1"
                  value={question.text || '작성하지 않은 질문'}
                />
              </div>
              {question.details
                .filter((detail) => detail.visibleToConsultants)
                .map((detail) => (
                  <div
                    key={detail.id}
                    className={questionnaireStyles.explanation}
                  >
                    <p className="wrap-break-word text-sm font-semibold">
                      {detail.title || '제목 없는 항목'}
                    </p>
                    <RichTextContent
                      className="mt-2 text-sm leading-7 text-neutral-700 dark:text-neutral-300"
                      value={detail.text || '작성하지 않은 내용'}
                    />
                  </div>
                ))}
              {question.kind && question.kind !== 'text' ? (
                <QuestionChoiceInput question={question} disabled />
              ) : (
                <QuestionTextAnswerPreview variant="questionnaire" />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
