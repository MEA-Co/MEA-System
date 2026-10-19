import { Skeleton } from '@/components/ui/skeleton';

export function AttachmentListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="divide-y">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1 space-y-2 px-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Skeleton className="size-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttachmentPickerSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <Skeleton aria-hidden="true" className="h-10 w-full" />
      <AttachmentListSkeleton label={label} />
      <div
        aria-hidden="true"
        className="flex items-center justify-between gap-2"
      >
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-4 w-9" />
          <Skeleton className="h-8 w-14" />
        </div>
      </div>
    </div>
  );
}

export function AttachmentDetailsSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="min-h-0 flex-1 space-y-4 overflow-hidden bg-muted p-4 md:p-6"
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="space-y-4 rounded-lg border border-t-2 border-t-brand bg-background p-4"
          >
            <Skeleton className="h-5 w-32" />
            <div className="border-t pt-4">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
