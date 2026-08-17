import { ArrowRight } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConsultingProgressButtonProps = ComponentProps<typeof Button> & {
  compact?: boolean;
};

export function ConsultingProgressButton({
  children = '진행하기',
  className,
  compact = false,
  ...props
}: ConsultingProgressButtonProps) {
  return (
    <Button
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'sm' : 'lg'}
      className={cn(
        compact
          ? 'group/progress h-8 gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'
          : 'group/progress h-11 border-border/80 bg-background/90 pr-2 pl-5 text-foreground shadow-sm hover:border-foreground/20 hover:bg-muted',
        className,
      )}
      {...props}
    >
      {children}
      {compact ? (
        <ArrowRight
          className="size-3.5 transition-transform group-hover/progress:translate-x-0.5"
          aria-hidden="true"
        />
      ) : (
        <span className="ml-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover/progress:translate-x-0.5">
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </span>
      )}
    </Button>
  );
}
