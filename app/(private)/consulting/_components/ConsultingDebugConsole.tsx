'use client';

import {
  Bot,
  Bug,
  ChevronDown,
  Database,
  PanelRightClose,
  PanelRightOpen,
  Radio,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ConsultingMemory } from '@/features/consulting/core/agent/memory';
import type { ConsultingAgentSnapshot } from '@/features/consulting/core/agent/types';
import type { ConsultingLog } from '@/features/consulting/core/logger';
import type { ConsultingToolsRuntime } from '@/features/consulting/core/tools';
import { cn } from '@/lib/utils';

type ConsultingDebugConsoleProps<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
> = {
  snapshot: ConsultingAgentSnapshot<Context, Tools>;
  memory: ConsultingMemory<Context>;
  logs: ReadonlyArray<ConsultingLog>;
};

const logKindLabels: Record<ConsultingLog['kind'], string> = {
  'agent.input': 'INPUT',
  'module.request': 'REQUEST',
  'module.response': 'RESPONSE',
  'module.error': 'ERROR',
};

const unreadLogClassNames: Record<ConsultingLog['kind'], string> = {
  'agent.input': 'border-sky-400/50 bg-sky-400/10 ring-sky-400/15',
  'module.request': 'border-amber-400/50 bg-amber-400/10 ring-amber-400/15',
  'module.response':
    'border-emerald-400/50 bg-emerald-400/10 ring-emerald-400/15',
  'module.error': 'border-rose-400/50 bg-rose-400/10 ring-rose-400/15',
};

const phaseLabels: Record<
  ConsultingAgentSnapshot<object, ConsultingToolsRuntime>['phase'],
  string
> = {
  'waiting-for-user': 'WAITING FOR USER',
  'running-tools': 'RUNNING TOOLS',
  complete: 'COMPLETE',
  error: 'ERROR',
};

function getLogEvent(log: ConsultingLog) {
  if (log.moduleId) return log.moduleId;
  const type = (log.data as { type?: unknown } | undefined)?.type;
  return typeof type === 'string' ? type : log.kind;
}

function stringify(value: unknown) {
  const seen = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(
      value,
      (_key, candidate: unknown) => {
        if (candidate instanceof Error) {
          return { name: candidate.name, message: candidate.message };
        }
        if (typeof candidate === 'bigint') return candidate.toString();
        if (typeof candidate === 'function') return '[Function]';
        if (candidate && typeof candidate === 'object') {
          if (seen.has(candidate)) return '[Circular]';
          seen.add(candidate);
        }
        return candidate;
      },
      2,
    );

    return serialized ?? String(value);
  } catch {
    return '[표시할 수 없는 데이터]';
  }
}

function DataBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-black/70 p-3 font-mono text-[0.68rem] leading-5 whitespace-pre-wrap text-zinc-300">
      {stringify(value)}
    </pre>
  );
}

export function ConsultingDebugConsole<
  Context extends object,
  Tools extends ConsultingToolsRuntime,
>({ snapshot, memory, logs }: ConsultingDebugConsoleProps<Context, Tools>) {
  const [isOpen, setIsOpen] = useState(true);
  const [readLogIds, setReadLogIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const latestLogs = [...logs].reverse();
  const unreadCount = logs.reduce(
    (count, log) => count + (readLogIds.has(log.id) ? 0 : 1),
    0,
  );

  const markAsRead = (logId: number) => {
    setReadLogIds((current) => {
      if (current.has(logId)) return current;
      const next = new Set(current);
      next.add(logId);
      return next;
    });
  };

  return (
    <div className="hidden lg:block">
      {!isOpen && (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed top-20 right-4 z-50 h-auto gap-2 rounded-xl bg-zinc-950 px-3 py-2.5 text-zinc-100 shadow-xl hover:bg-zinc-900"
          aria-label="컨설팅 이벤트 로그 열기"
        >
          <PanelRightOpen className="size-4" aria-hidden="true" />
          Event Log
          {unreadCount > 0 && (
            <Badge className="border-amber-300/30 bg-amber-300 text-zinc-950">
              {unreadCount}
            </Badge>
          )}
        </Button>
      )}

      {isOpen && (
        <Card className="fixed top-20 right-4 bottom-4 z-50 flex w-96 gap-0 overflow-hidden rounded-2xl border-zinc-800 bg-zinc-900 py-0 text-zinc-100 shadow-2xl ring-0 xl:w-md">
          <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                  <Bug className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[0.12em]">
                    CONSULTING EVENT LOG
                  </p>
                  <p className="mt-0.5 truncate text-[0.7rem] text-zinc-400">
                    {snapshot.planId} · {snapshot.currentNodeId}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="컨설팅 이벤트 로그 닫기"
              >
                <PanelRightClose aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Radio className="size-3 animate-pulse" aria-hidden="true" />
                {phaseLabels[snapshot.phase]}
              </Badge>
              <p className="text-[0.7rem] text-zinc-400">
                {unreadCount > 0 ? `${unreadCount} new` : 'All read'}
              </p>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
            <div className="grid gap-2">
              <details className="group rounded-xl border border-zinc-800 bg-zinc-950/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:hidden">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Bot
                      className="size-4 text-violet-400"
                      aria-hidden="true"
                    />
                    Agent Snapshot
                  </span>
                  <ChevronDown className="size-4 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-zinc-800 px-3.5 pb-3.5">
                  <DataBlock value={snapshot} />
                </div>
              </details>

              <details className="group rounded-xl border border-zinc-800 bg-zinc-950/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:hidden">
                  <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Database
                      className="size-4 text-emerald-400"
                      aria-hidden="true"
                    />
                    Agent Memory
                  </span>
                  <ChevronDown className="size-4 text-zinc-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-zinc-800 px-3.5 pb-3.5">
                  <DataBlock value={memory} />
                </div>
              </details>
            </div>

            <section className="mt-4">
              <div className="flex items-center justify-between gap-4 px-1">
                <h2 className="text-xs font-semibold text-zinc-200">
                  Execution Log
                </h2>
                <p className="text-[0.7rem] text-zinc-500">
                  {logs.length} entries
                </p>
              </div>

              <div className="mt-2.5 space-y-2">
                {latestLogs.map((log) => {
                  const isUnread = !readLogIds.has(log.id);

                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => markAsRead(log.id)}
                      className={cn(
                        'block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-left transition-colors',
                        isUnread && `ring-2 ${unreadLogClassNames[log.kind]}`,
                      )}
                      aria-label={`#${log.id} ${getLogEvent(log)}${isUnread ? ' 새 이벤트' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={cn(
                              'text-xs font-semibold',
                              log.kind === 'module.request'
                                ? 'text-amber-300'
                                : log.kind === 'module.response'
                                  ? 'text-emerald-300'
                                  : log.kind === 'module.error'
                                    ? 'text-rose-300'
                                    : 'text-sky-300',
                            )}
                          >
                            #{log.id} {log.text}
                          </p>
                          <p className="mt-1 font-mono text-[0.65rem] text-zinc-500">
                            {logKindLabels[log.kind]}
                            {log.callId ? ` · ${log.callId}` : ''}
                          </p>
                        </div>
                        {isUnread && (
                          <Badge className="border-amber-300/20 bg-amber-300/15 text-amber-200">
                            NEW
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 font-mono text-xs leading-5 text-zinc-200">
                        {getLogEvent(log)}
                        {log.nodeId ? ` · ${log.nodeId}` : ''}
                      </p>
                      {log.data !== undefined && <DataBlock value={log.data} />}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </Card>
      )}
    </div>
  );
}
