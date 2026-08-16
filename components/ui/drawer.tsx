'use client';

import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  const isMobile = useIsMobile();

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      swipeDirection={isMobile ? 'down' : 'right'}
      {...props}
    />
  );
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        'fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none supports-backdrop-filter:backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            'pointer-events-auto relative flex max-h-[85svh] w-full flex-col rounded-t-2xl border-t bg-popover text-popover-foreground shadow-xl transition-transform duration-300 ease-out data-[swipe-direction=down]:translate-y-[var(--drawer-swipe-movement-y)] data-[swipe-direction=right]:translate-x-[var(--drawer-swipe-movement-x)] data-ending-style:data-[swipe-direction=down]:translate-y-full data-ending-style:data-[swipe-direction=right]:translate-x-full data-starting-style:data-[swipe-direction=down]:translate-y-full data-starting-style:data-[swipe-direction=right]:translate-x-full data-swiping:transition-none md:h-full md:max-h-none md:max-w-sm md:rounded-none md:border-t-0 md:border-l',
            className,
          )}
          {...props}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-muted md:hidden" />
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col">
            {children}
          </DrawerPrimitive.Content>
          <DrawerPrimitive.Close
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4"
              />
            }
          >
            <XIcon />
            <span className="sr-only">닫기</span>
          </DrawerPrimitive.Close>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('flex flex-col gap-1.5 p-6 pr-14', className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn('font-heading text-base font-medium', className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
