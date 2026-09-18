'use client';

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const tutorialHighlight =
  'relative z-40 border border-emerald-400 bg-emerald-50/70 p-4 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function TutorialBubble({
  step,
  title,
  children,
  actionLabel,
  onAction,
  className,
  arrowClassName,
  onBack,
  onSkip,
}: {
  step: string;
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
  arrowClassName?: string;
  onBack?: () => void;
  onSkip?: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const changed: Array<[HTMLElement, boolean]> = [];
    // Make every branch outside the bubble inert, including highlighted controls.
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        // Already-inert siblings belong to their own React state; do not restore
        // a stale value after that state unlocks them when this guide closes.
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          changed.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const buttons = () =>
      Array.from(
        dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      );
    (buttons()[0] ?? dialog).focus({ preventScroll: true });
    const blockOutside = (event: Event) => {
      if (!dialog.contains(event.target as Node)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = buttons();
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('click', blockOutside, true);
    document.addEventListener('pointerdown', blockOutside, true);
    document.addEventListener('keydown', keydown, true);
    return () => {
      changed.forEach(([element, inert]) => {
        element.inert = inert;
      });
      document.removeEventListener('click', blockOutside, true);
      document.removeEventListener('pointerdown', blockOutside, true);
      document.removeEventListener('keydown', keydown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [step, title]);
  return (
    <>
      {mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-30 bg-zinc-900/25"
            aria-hidden="true"
          />,
          document.body,
        )}
      <aside
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`선택과목 컨설팅 안내 ${step}`}
        className={cn(
          'relative z-50 mt-4 border border-emerald-300 bg-background p-4 shadow-lg',
          className,
        )}
      >
        <span
          className={cn(
            'absolute -top-2 left-7 size-4 rotate-45 border-l border-t border-emerald-300 bg-background',
            arrowClassName,
          )}
          aria-hidden="true"
        />
        <p className="text-xs font-semibold text-emerald-700">{step}</p>
        <p className="mt-2 text-base font-semibold">{title}</p>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">
          {children}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {onSkip ? (
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
              안내 건너뛰기
            </Button>
          ) : null}
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              이전
            </Button>
          ) : null}
          <Button type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </aside>
    </>
  );
}
