'use client';

import { useMemo } from 'react';

import {
  useConsultingToolRuntime,
  useConsultingToolRuntimeSnapshot,
} from '@/app/(private)/consulting/_components/ConsultingToolRuntimeProvider';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ConsultingBackgroundStatus() {
  const runtime = useConsultingToolRuntime();
  const snapshot = useConsultingToolRuntimeSnapshot();
  const jobs = useMemo(() => {
    const backgroundJobs = snapshot.jobs.filter(
      (job) => job.executionMode === 'background',
    );
    const latestGroupByTool = new Map<
      string,
      { groupId: string; createdAt: number }
    >();

    for (const job of backgroundJobs) {
      if (!job.groupId) continue;
      const latestGroup = latestGroupByTool.get(job.toolId);
      if (!latestGroup || job.createdAt >= latestGroup.createdAt) {
        latestGroupByTool.set(job.toolId, {
          groupId: job.groupId,
          createdAt: job.createdAt,
        });
      }
    }

    return backgroundJobs.filter(
      (job) =>
        !job.groupId ||
        latestGroupByTool.get(job.toolId)?.groupId === job.groupId,
    );
  }, [snapshot.jobs]);
  const activeJobs = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  );
  const failedJobs = jobs.filter(
    (job) => job.status === 'rejected' || job.status === 'cancelled',
  );

  if (jobs.length === 0) return null;

  if (activeJobs.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <div
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted/80 px-2.5 text-xs font-medium text-muted-foreground"
                role="status"
                aria-live="polite"
              />
            }
          >
            <span
              className="size-2 shrink-0 animate-pulse rounded-full bg-amber-400 shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-amber-400)_18%,transparent)]"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              백그라운드 작업 {activeJobs.length}개 처리 중
            </span>
            <span className="sr-only sm:hidden">
              백그라운드 작업 {activeJobs.length}개 처리 중
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>응답을 받아오는 중입니다.</p>
            {activeJobs.map((job) => (
              <p key={job.id} className="text-muted-foreground">
                {job.label ?? job.toolId}
              </p>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (failedJobs.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/8 hover:text-destructive"
                onClick={() => {
                  for (const job of failedJobs) runtime.retry(job.id);
                }}
              />
            }
          >
            <span
              className="size-2 shrink-0 rounded-full bg-destructive shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_14%,transparent)]"
              aria-hidden="true"
            />
            <span className="hidden sm:inline">백그라운드 작업 실패</span>
            <span className="sr-only">실패한 백그라운드 작업 다시 실행</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            {failedJobs.map((job) => (
              <p key={job.id}>
                {job.label ?? job.toolId}:{' '}
                {job.error?.message ?? '작업에 실패했습니다.'}
              </p>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted/80 px-2.5 text-xs font-medium text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <span
        className="size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-emerald-500)_16%,transparent)]"
        aria-hidden="true"
      />
      <span className="hidden sm:inline">백그라운드 작업 완료</span>
      <span className="sr-only sm:hidden">백그라운드 작업 완료</span>
    </div>
  );
}
