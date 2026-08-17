import { ArrowRight } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ConsultingProgressButton({
  children = '진행하기',
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="lg"
      className={cn(
        'group/progress h-11 border-border/80 bg-background/90 pr-2 pl-5 text-foreground shadow-sm hover:border-foreground/20 hover:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
      <span className="ml-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/progress:translate-x-0.5">
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </Button>
  );
}
