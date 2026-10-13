import { Search } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function CollectionHeader({
  id,
  category,
  title,
  description,
  action,
}: {
  id: string;
  category?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div className="space-y-2">
        {category}
        <h1
          id={id}
          className="text-2xl font-extrabold tracking-tight md:text-3xl"
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

export function CollectionFilter({
  selected,
  className,
  ...props
}: ComponentProps<typeof Button> & { selected: boolean }) {
  return (
    <Button
      variant="ghost"
      aria-pressed={selected}
      className={cn(
        'rounded-md hover:bg-muted aria-pressed:bg-brand aria-pressed:text-brand-foreground aria-pressed:hover:bg-brand/85',
        className,
      )}
      {...props}
    />
  );
}

export function CollectionCount({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-sm bg-foreground/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums in-aria-pressed:bg-black/10 in-aria-pressed:text-brand-foreground">
      {children}
    </span>
  );
}

export function CollectionSearch({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <div className="relative w-full sm:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
      />
      <Input
        className={cn(
          'h-10 rounded-md border-border bg-background pl-9',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CollectionStatus({
  draft,
  children,
}: {
  draft: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'ml-2 inline-flex rounded-sm px-2 py-1 align-middle text-xs font-medium',
        draft
          ? 'bg-brand/20 text-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
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
    <div
      role="status"
      className="flex flex-col items-center rounded-lg border bg-muted/40 px-6 py-16 text-center"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-background text-foreground">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
