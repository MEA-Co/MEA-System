'use client';

import { useAnswers } from './QuestionnaireAnswers';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';
import { RichTextContent } from './RichTextContent';

export function QuestionnaireFreeResponse() {
  const { freeResponse, changeFreeResponse, locked } = useAnswers();
  return (
    <section
      className="space-y-3 border-t pt-8"
      aria-labelledby="free-response-label"
    >
      <h2 id="free-response-label" className="text-lg font-semibold">
        자유 응답{' '}
        <span className="text-sm font-normal text-muted-foreground">
          (선택)
        </span>
      </h2>
      <p className="text-sm text-muted-foreground">
        질문에 답하면서 추가로 남기고 싶은 이야기나 의견을 자유롭게 작성해
        주세요.
      </p>
      {locked ? (
        <RichTextContent value={freeResponse || '추가로 남긴 내용이 없어요.'} />
      ) : (
        <QuestionRichTextEditor
          id="questionnaire-free-response"
          ariaLabel="자유 응답 (선택)"
          value={freeResponse}
          onChange={changeFreeResponse}
          placeholder="추가로 전하고 싶은 내용을 입력해 주세요"
        />
      )}
    </section>
  );
}
