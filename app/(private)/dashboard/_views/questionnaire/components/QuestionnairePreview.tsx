import type { QuestionnaireSection } from '../lib/types';

import { QuestionChoiceInput } from './QuestionChoiceInput';
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
      <h2 className="whitespace-pre-wrap break-words text-3xl font-semibold">
        {title || '제목 없는 질문지'}
      </h2>
      {sections.map((section, sectionIndex) => (
        <section key={section.id} className="space-y-6 border-t pt-6">
          <h3 className="break-words text-xl font-semibold">
            {section.title || `섹션 ${sectionIndex + 1}`}
          </h3>
          {section.questions.map((question, questionIndex) => (
            <div key={question.id} className="space-y-4">
              <div className="flex items-start gap-2 font-medium">
                <span>{questionIndex + 1}.</span>
                <RichTextContent
                  className="min-w-0 flex-1"
                  value={question.text || '작성하지 않은 질문'}
                />
              </div>
              {question.details
                .filter((detail) => detail.visibleToConsultants)
                .map((detail) => (
                  <div key={detail.id} className="border-l-2 pl-4">
                    <p className="break-words text-sm font-semibold">
                      {detail.title || '제목 없는 항목'}
                    </p>
                    <RichTextContent
                      className="mt-2 text-sm leading-7 text-muted-foreground"
                      value={detail.text || '작성하지 않은 내용'}
                    />
                  </div>
                ))}
              {question.kind && question.kind !== 'text' ? (
                <QuestionChoiceInput question={question} disabled />
              ) : (
                <QuestionTextAnswerPreview />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
