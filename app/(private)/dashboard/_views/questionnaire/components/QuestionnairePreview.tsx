import type { QuestionnaireSection } from '../lib/types';

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
              <h4 className="whitespace-pre-wrap break-words font-medium">
                {questionIndex + 1}. {question.text || '작성하지 않은 질문'}
              </h4>
              {question.details
                .filter((detail) => detail.visibleToConsultants)
                .map((detail) => (
                  <div key={detail.id} className="border-l-2 pl-4">
                    <p className="break-words text-sm font-semibold">
                      {detail.title || '제목 없는 항목'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                      {detail.text || '작성하지 않은 내용'}
                    </p>
                  </div>
                ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
