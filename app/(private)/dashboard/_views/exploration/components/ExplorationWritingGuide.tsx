import { Popover } from '@base-ui/react/popover';
import { CircleHelp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ExplorationWritingGuide({
  title,
  guide,
}: {
  title: string;
  guide: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1.5 rounded-full px-3 text-xs"
          />
        }
        aria-label={`${title} 작성 가이드`}
      >
        <CircleHelp aria-hidden="true" className="size-4" />
        작성 가이드
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-[60]">
          <Popover.Popup className="max-h-[min(70dvh,var(--available-height))] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border bg-popover p-5 text-popover-foreground shadow-lg outline-none">
            <div className="mb-3 flex items-start justify-between gap-3">
              <Popover.Title className="flex items-center gap-2 text-sm font-semibold">
                <CircleHelp aria-hidden="true" className="size-4 shrink-0" />
                {title} 작성 가이드
              </Popover.Title>
              <Popover.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mt-1 -mr-1 shrink-0"
                  />
                }
                aria-label="작성 가이드 닫기"
              >
                <X aria-hidden="true" />
              </Popover.Close>
            </div>
            <Popover.Description className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
              {guide}
            </Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
