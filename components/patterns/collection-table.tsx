import type { ComponentProps } from 'react';

import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Shared collection surface; column layout and actions belong to each domain. */
export function CollectionTable({
  className,
  ...props
}: ComponentProps<typeof Table>) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table
        className={cn(
          'table-fixed [&_thead]:bg-muted [&_th]:px-4 [&_td]:px-4 [&_td]:py-4 [&_td]:whitespace-normal',
          className,
        )}
        {...props}
      />
    </div>
  );
}
