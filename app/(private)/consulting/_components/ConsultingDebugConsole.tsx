'use client';

import { Activity, Bot, Bug, Database, Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { GuidedConsultingLog } from '@/features/guided-consulting/core/logger';
import type { GuidedConsultingToolError } from '@/features/guided-consulting/core/tools/protocol';
import type {
  GuidedConsultingModuleCall,
  GuidedConsultingPhase,
  GuidedConsultingScreen,
} from '@/features/guided-consulting/core/types';

type ConsultingDebugConsoleProps<Context extends object> = {
  planId: string;
  phase: GuidedConsultingPhase;
  currentNodeId: string;
  node: unknown;
  screen: GuidedConsultingScreen | null;
  draftValue: string;
  context: Context;
  actions: Readonly<Record<string, unknown>>;
  toolResults: Readonly<Record<string, unknown>>;
  toolErrors: Readonly<Record<string, GuidedConsultingToolError>>;
  error: Error | null;
  pendingModuleCalls: ReadonlyArray<GuidedConsultingModuleCall>;
  logs: ReadonlyArray<GuidedConsultingLog>;
};

const logKindLabels: Record<GuidedConsultingLog['kind'], string> = {
  'agent.input': 'INPUT',
  'module.request': 'REQUEST',
  'module.response': 'RESPONSE',
  'module.error': 'ERROR',
};

const phaseLabels: Record<GuidedConsultingPhase, string> = {
  'waiting-for-user': 'WAITING FOR USER',
  'running-tools': 'RUNNING TOOLS',
  complete: 'COMPLETE',
  error: 'ERROR',
};

function getLogEvent(log: GuidedConsultingLog) {
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

function DataBlock({
  value,
  compact = false,
}: {
  value: unknown;
  compact?: boolean;
}) {
  return (
    <pre
      className={
        compact
          ? 'mt-2 max-h-40 overflow-auto rounded-lg bg-black/70 p-3 font-mono text-[0.68rem] leading-5 whitespace-pre-wrap text-zinc-300'
          : 'mt-3 max-h-64 overflow-auto rounded-lg bg-black/70 p-3 font-mono text-[0.7rem] leading-5 whitespace-pre-wrap text-zinc-300'
      }
    >
      {stringify(value)}
    </pre>
  );
}

export function ConsultingDebugConsole<Context extends object>({
  planId,
  phase,
  currentNodeId,
  node,
  screen,
  draftValue,
  context,
  actions,
  toolResults,
  toolErrors,
  error,
  pendingModuleCalls,
  logs,
}: ConsultingDebugConsoleProps<Context>) {
  const latestLogs = [...logs].reverse();

  return (
    <details open className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl border bg-zinc-950 px-4 py-3 text-zinc-100 shadow-sm marker:hidden">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
            <Bug className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-[0.12em]">
              CONSULTING EVENT LOG
            </p>
            <p className="mt-0.5 text-[0.7rem] text-zinc-400">
              User · Agent · Renderer · Tools
            </p>
          </div>
        </div>
        <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <Radio className="size-3 animate-pulse" aria-hidden="true" />
          {phaseLabels[phase]}
        </Badge>
      </summary>

      <Card className="mt-2 gap-0 rounded-xl border-zinc-800 bg-zinc-900 py-0 text-zinc-100 shadow-sm ring-0">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <Badge variant="outline" className="border-zinc-700 text-zinc-300">
              {planId}
            </Badge>
            <span>{screen?.renderTarget.screenId ?? '화면 없음'}</span>
            <span>·</span>
            <span>{currentNodeId}</span>
            <span>·</span>
            <span>Pending modules {pendingModuleCalls.length}</span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Activity className="size-4 text-sky-400" aria-hidden="true" />
                UI → Agent
              </h2>
              <DataBlock
                value={{
                  screen: screen
                    ? {
                        id: screen.id,
                        nodeId: screen.nodeId,
                        availableActions: screen.availableActions,
                      }
                    : null,
                  draftValue,
                }}
              />
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Bot className="size-4 text-violet-400" aria-hidden="true" />
                Agent State
              </h2>
              <DataBlock
                value={{
                  phase,
                  currentNodeId,
                  node,
                  activeScreen: screen,
                  error,
                  pendingModuleCalls,
                }}
              />
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Database
                  className="size-4 text-emerald-400"
                  aria-hidden="true"
                />
                Agent Memory
              </h2>
              <DataBlock
                value={{ context, actions, toolResults, toolErrors }}
              />
            </section>
          </div>

          <section className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-semibold text-zinc-200">
                Execution Log
              </h2>
              <p className="text-[0.7rem] text-zinc-500">
                {logs.length} entries
              </p>
            </div>

            <div className="mt-3 max-h-128 space-y-2 overflow-auto">
              {latestLogs.map((log) => (
                <article
                  key={log.id}
                  className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 md:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <div>
                    <p
                      className={
                        log.kind === 'module.request'
                          ? 'text-xs font-semibold text-amber-300'
                          : log.kind === 'module.response'
                            ? 'text-xs font-semibold text-emerald-300'
                            : 'text-xs font-semibold text-zinc-300'
                      }
                    >
                      #{log.id} {log.text}
                    </p>
                    <p className="mt-1 font-mono text-[0.65rem] text-zinc-500">
                      {logKindLabels[log.kind]}
                      {log.callId ? ` · ${log.callId}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs leading-5 text-zinc-200">
                      {getLogEvent(log)}
                      {log.nodeId ? ` · ${log.nodeId}` : ''}
                    </p>
                    {log.data !== undefined && (
                      <DataBlock compact value={log.data} />
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </CardContent>
      </Card>
    </details>
  );
}
