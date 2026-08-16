'use client';

import { Bot } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

type ConsultingAdviceProps = {
  children?: ReactNode;
  description?: string;
  highlightTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title?: string;
  triggerDisabled?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

export function ConsultingAdvice({
  children,
  description = '컨설팅 진행에 필요한 조언이 표시됩니다.',
  highlightTrigger = false,
  onOpenChange,
  open,
  title = 'AI 조언',
  triggerDisabled = false,
  triggerLabel = 'AI 조언',
  triggerClassName,
}: ConsultingAdviceProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={triggerDisabled}
            className={cn(
              'relative',
              highlightTrigger &&
                'border-blue-500/40 bg-blue-500/10 text-blue-700 shadow-sm hover:border-blue-500/60 hover:bg-blue-500/15 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200',
              triggerClassName,
            )}
          />
        }
      >
        {highlightTrigger && (
          <span
            className="absolute -top-1 -right-1 flex size-2.5"
            aria-hidden="true"
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-55 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-blue-500" />
          </span>
        )}
        <Bot />
        {triggerLabel}
      </DrawerTrigger>
      <DrawerContent className="md:max-w-md">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
