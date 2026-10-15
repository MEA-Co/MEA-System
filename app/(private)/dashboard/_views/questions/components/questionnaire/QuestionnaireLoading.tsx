export function QuestionnaireLoading({ editor = false }: { editor?: boolean }) {
  if (editor)
    return (
      <div
        role="status"
        aria-label="질문지 편집기 로딩"
        aria-busy="true"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-6 overflow-hidden bg-muted p-4 sm:p-8">
          <div className="h-5 w-32 animate-pulse rounded bg-border" />
          <div className="h-10 w-48 animate-pulse rounded bg-border" />
          {[0, 1].map((key) => (
            <div
              key={key}
              className="space-y-4 rounded-lg border border-t-2 border-t-brand bg-background p-6"
            >
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-12 animate-pulse rounded bg-muted" />
              {key === 1 && (
                <div className="h-24 animate-pulse rounded bg-muted" />
              )}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-3">
          <div className="h-10 w-20 animate-pulse rounded bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );

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
