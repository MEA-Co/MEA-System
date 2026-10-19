'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ExplorationNavigation({ links }: { links: boolean }) {
  return (
    <nav aria-label="탐구활동 관리 영역" className="flex gap-2">
      <Button
        variant={!links ? 'secondary' : 'ghost'}
        nativeButton={false}
        render={
          <Link
            href="/dashboard?view=exploration&tab=activities"
            prefetch={false}
            aria-current={!links ? 'page' : undefined}
          />
        }
      >
        탐구활동
      </Button>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={links ? 'secondary' : 'ghost'}
                className="relative"
                nativeButton={false}
                render={
                  <Link
                    href="/dashboard?view=exploration&tab=links"
                    prefetch={false}
                    aria-current={links ? 'page' : undefined}
                  />
                }
              />
            }
          >
            탐구줄기
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 size-2"
            >
              <span className="absolute inset-0 rounded-full bg-blue-400/40 motion-safe:animate-ping motion-safe:animation-duration-[2.5s]" />
              <span className="absolute inset-0 rounded-full bg-blue-500" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={8}
            className="bg-violet-600 bg-linear-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 font-medium text-white shadow-lg"
          >
            이번 주차에 필요한 블록이에요!
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </nav>
  );
}
