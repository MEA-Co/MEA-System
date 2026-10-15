import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function QuestionRelationshipsSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">참조 질문을 불러오고 있어요.</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}

export function QuestionEditorSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">질문 편집 정보를 불러오고 있어요.</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex h-11 w-52 items-center gap-2 rounded-lg bg-background p-2">
          <Skeleton className="h-7 flex-1" />
          <Skeleton className="h-7 flex-1" />
        </div>
        <Card variant="accent">
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card variant="accent">
          <CardContent className="space-y-6">
            <div className="flex gap-3 border-b pb-5">
              <Skeleton className="h-7 w-4 shrink-0" />
              <Skeleton className="h-24 flex-1" />
            </div>
            <Skeleton className="h-12 w-full" />
            <div className="space-y-4 rounded-lg border p-4 sm:p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <div className="space-y-4 rounded-lg border p-4 sm:p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
