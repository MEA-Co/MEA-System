export function QuestionTextAnswerPreview() {
  return (
    <textarea
      disabled
      aria-label="서술형 답변 미리보기"
      placeholder="응답자가 답변을 입력하는 공간입니다"
      className="min-h-24 w-full resize-none rounded-lg border-0 bg-neutral-100 p-3 text-sm placeholder:text-neutral-600 dark:bg-neutral-800 dark:placeholder:text-neutral-400"
    />
  );
}
