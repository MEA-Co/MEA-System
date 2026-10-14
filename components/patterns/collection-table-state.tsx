import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

/** Keep the table header and a stable content area during loading or an empty result. */
export function CollectionTableState({
  colSpan,
  loading,
  title,
  description,
  action,
}: {
  colSpan: number;
  loading?: boolean;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-72 whitespace-normal p-0">
        {loading ? (
          <div role="status">
            <span className="sr-only">{title}</span>
            <div aria-hidden="true" className="divide-y">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="flex h-18 items-center justify-between gap-6 px-4"
                >
                  <div className="w-2/3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-14" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="mx-auto max-w-md space-y-2 px-5 py-10 text-center"
          >
            <p className="font-semibold text-foreground">{title}</p>
            {description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            )}
            {action && <div className="pt-2">{action}</div>}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
