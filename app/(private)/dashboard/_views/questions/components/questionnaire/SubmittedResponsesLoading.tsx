import { Eye, MessageSquare } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SubmittedResponsesLoading({
  detail = false,
  withTabs = false,
}: {
  detail?: boolean;
  withTabs?: boolean;
}) {
  const content = (
    <section
      role="status"
      aria-label="제출된 답변을 불러오는 중"
      aria-busy="true"
      className="space-y-4"
    >
      {detail && (
        <div className="flex justify-end">
          <Skeleton className="h-10 w-48" />
        </div>
      )}
      <div className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          {!detail && <Skeleton className="h-10 w-48" />}
        </div>
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="border-b bg-muted p-4">
          <Skeleton className="h-5 w-28" />
        </div>
        {Array.from({ length: detail ? 2 : 5 }, (_, index) => (
          <div key={index} className="space-y-3 border-b p-5 last:border-b-0">
            <Skeleton className="h-5 w-40" />
            <Skeleton
              className={detail ? 'h-24 w-full' : 'h-4 w-56 max-w-full'}
            />
          </div>
        ))}
      </div>
    </section>
  );
  if (!withTabs) return content;
  return (
    <Tabs value="responses" className="mx-auto w-full min-w-0 max-w-6xl">
      <TabsList
        className="h-auto! max-w-full flex-wrap"
        aria-label="질문지 보기 방식"
      >
        <TabsTrigger value="preview" disabled className="gap-2 px-3">
          <Eye className="size-4" />
          미리보기
        </TabsTrigger>
        <TabsTrigger
          value="responses"
          disabled
          className="relative gap-2 pl-3 pr-9"
        >
          <MessageSquare className="size-4" />
          제출된 답변
          <span className="absolute right-1.5 top-1 min-w-4 rounded bg-foreground/10 px-1 text-center text-[10px] font-semibold leading-4">
            –
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="responses">{content}</TabsContent>
    </Tabs>
  );
}
