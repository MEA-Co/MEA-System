export function QuestionTextAnswerPreview({
  variant,
}: {
  variant: 'editor' | 'respondent';
}) {
  return (
    <textarea
      disabled
      aria-label="서술형 답변 미리보기"
      rows={variant === 'editor' ? 3 : 1}
      placeholder={
        variant === 'editor'
          ? '응답자가 답변을 입력하는 공간입니다.'
          : '답변을 입력해 주세요'
      }
      className={`w-full resize-none rounded-lg text-sm placeholder:text-neutral-600 dark:placeholder:text-neutral-400 ${variant === 'editor' ? 'min-h-24 border border-dashed border-neutral-300 bg-white p-3 dark:border-neutral-600 dark:bg-neutral-900' : 'h-10 overflow-hidden border-0 bg-neutral-100 px-3 py-2.5 dark:bg-neutral-800'}`}
    />
  );
}
