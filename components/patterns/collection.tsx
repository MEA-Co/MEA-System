import { Search } from 'lucide-react';
import type { ComponentProps, ReactNode, Ref } from 'react';

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function CollectionHeader({
  id,
  category,
  titleRef,
  title,
  description,
  action,
}: {
  id: string;
  category?: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b pb-5">
      {category && <div className="col-span-2">{category}</div>}
      <h1
        id={id}
        ref={titleRef}
        tabIndex={titleRef ? -1 : undefined}
        className="min-w-0 text-2xl font-extrabold tracking-tight md:text-3xl"
      >
        {title}
      </h1>
      {action && <div className="col-start-2 shrink-0">{action}</div>}
      {description && (
        <p className="col-span-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
    </header>
  );
}

export function CollectionSearch({
  className,
  containerClassName,
  ...props
}: ComponentProps<typeof Input> & { containerClassName?: string }) {
  return (
    <div className={cn('relative w-full sm:w-80', containerClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
      />
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  );
}

export function CollectionEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Empty role="status" className="min-h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function CollectionLoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="min-h-64 rounded-lg border bg-background">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="divide-y">
        {[0, 1].map((row) => (
          <div key={row} className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
