import { Badge } from '@/components/ui/badge';

import type { QuestionnaireDraft } from '../lib/types';
export function PublishedQuestionnaire({
  document,
  distributed = false,
  staff = true,
}: {
  document: QuestionnaireDraft;
  distributed?: boolean;
  staff?: boolean;
}) {
  return (
    <article className="mx-auto max-w-4xl space-y-8 rounded-xl border bg-background p-5 sm:p-10">
      <header>
        <Badge variant="secondary">
          {distributed ? '배포된 질문지' : '게시된 질문지'}
        </Badge>
        <h1 className="mt-3 whitespace-pre-wrap break-words text-2xl font-semibold">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {distributed
            ? '배포된 질문지는 수정할 수 없어요.'
            : '컨설턴트 리드와 관리자만 볼 수 있어요.'}
        </p>
      </header>
      {document.sections.map((section, index) => (
        <section key={section.id} className="space-y-5">
          <h2 className="whitespace-pre-wrap break-words text-xl font-semibold">
            {section.title || `섹션 ${index + 1}`}
          </h2>
          {section.questions.map((question, questionIndex) => (
            <div key={question.id} className="space-y-4 rounded-lg border p-5">
              <h3 className="text-sm font-medium text-muted-foreground">
                질문 {questionIndex + 1}
              </h3>
              <p className="whitespace-pre-wrap break-words">{question.text}</p>
              {question.details.map((detail) => (
                <div key={detail.id} className="rounded-lg bg-muted/50 p-4">
                  <h4 className="whitespace-pre-wrap break-words font-medium">
                    {detail.title || '설명'}{' '}
                    {staff && (
                      <Badge variant="outline">
                        {detail.visibleToConsultants
                          ? '컨설턴트 공개 항목'
                          : '컨설턴트 비공개 항목'}
                      </Badge>
                    )}
                  </h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {detail.text}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
