import { ArrowRight } from 'lucide-react';
import { type ComponentProps, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConsultingProgressButtonProps = Omit<
  ComponentProps<typeof Button>,
  'ref'
> & {
  compact?: boolean;
  spacebarShortcut?: boolean;
};

export function ConsultingProgressButton({
  children = '진행하기',
  className,
  compact = false,
  spacebarShortcut = false,
  ...props
}: ConsultingProgressButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!spacebarShortcut || props.disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return;
      }

      event.preventDefault();
      buttonRef.current?.click();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.disabled, spacebarShortcut]);

  return (
    <Button
      ref={buttonRef}
      variant={compact ? 'ghost' : 'outline'}
      size={compact ? 'sm' : 'lg'}
      className={cn(
        compact
          ? 'group/progress h-8 gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'
          : 'group/progress h-11 border-border/80 bg-background/90 pr-2 pl-5 text-foreground shadow-sm hover:border-foreground/20 hover:bg-muted',
        className,
      )}
      {...props}
      aria-keyshortcuts={
        spacebarShortcut ? 'Space' : props['aria-keyshortcuts']
      }
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
