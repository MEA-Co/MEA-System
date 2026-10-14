import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function DetailValue({ className, ...props }: ComponentProps<'dd'>) {
  return (
    <dd
      className={cn(
        'min-w-0 rounded-md bg-muted px-3 py-2 text-sm leading-7 whitespace-pre-wrap wrap-break-word text-foreground',
        className,
      )}
      {...props}
    />
  );
}
