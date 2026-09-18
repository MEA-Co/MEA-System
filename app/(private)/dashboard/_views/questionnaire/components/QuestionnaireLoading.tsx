export function QuestionnaireLoading() {
  return (
    <div
      className="flex min-h-[calc(100svh-10rem)] items-center justify-center p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-muted-foreground motion-safe:animate-pulse">
        질문지를 불러오고 있어요.
      </p>
    </div>
  );
}
