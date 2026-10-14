import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function DetailLabel({ className, ...props }: ComponentProps<'dt'>) {
  return (
    <dt
      className={cn(
        'text-sm font-semibold leading-5 text-foreground',
        className,
      )}
      {...props}
    />
  );
}
