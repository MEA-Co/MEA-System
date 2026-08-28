import type {
  ConsultingToolError,
  ConsultingToolRequest,
  ConsultingToolResponse,
} from '@/features/consulting/core/tools/protocol';
import { createConsultingToolRejectedResponse } from '@/features/consulting/core/tools/protocol';
import type { ConsultingToolsRuntime } from '@/features/consulting/core/tools/types';

export type ConsultingToolJobStatus =
  'queued' | 'running' | 'completed' | 'rejected' | 'cancelled';

export type ConsultingToolRunPolicy = 'parallel' | 'reuse' | 'replace';

export type ConsultingToolRunOptions = {
  key?: string;
  groupId?: string;
  policy?: ConsultingToolRunPolicy;
  label?: string;
};

export type ConsultingToolJob = {
  id: string;
  toolId: string;
  key?: string;
  groupId?: string;
  label?: string;
  status: ConsultingToolJobStatus;
  input: unknown;
  output?: unknown;
  error?: ConsultingToolError;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
};

export type ConsultingToolRuntimeSnapshot = {
  jobs: ReadonlyArray<ConsultingToolJob>;
};

export type ConsultingToolRun<Output = unknown> = {
  id: string;
  result: Promise<ConsultingToolResponse<string, Output>>;
  cancel: () => void;
};

export type ConsultingToolRuntime = {
  run: <Output = unknown>(
    request: ConsultingToolRequest,
    options?: ConsultingToolRunOptions,
  ) => ConsultingToolRun<Output>;
  retry: (jobId: string) => ConsultingToolRun | null;
  retryGroup: (
    groupId: string,
    options?: { failedOnly?: boolean },
  ) => ReadonlyArray<ConsultingToolRun>;
  cancel: (jobId: string) => void;
  cancelGroup: (groupId: string) => void;
  clearGroup: (groupId: string) => void;
  reset: () => void;
  dispose: () => void;
  getSnapshot: () => ConsultingToolRuntimeSnapshot;
  subscribe: (listener: () => void) => () => void;
};

type InternalJob = {
  snapshot: ConsultingToolJob;
  request: ConsultingToolRequest;
  options: ConsultingToolRunOptions;
  controller: AbortController;
  run: ConsultingToolRun;
};

export function createConsultingToolRuntime(
  tools: ConsultingToolsRuntime,
): ConsultingToolRuntime {
  const listeners = new Set<() => void>();
  const jobs = new Map<string, InternalJob>();
  let jobId = 0;
  let disposed = false;
  let snapshot: ConsultingToolRuntimeSnapshot = { jobs: [] };

  const publish = () => {
    snapshot = {
      jobs: [...jobs.values()].map((job) => ({ ...job.snapshot })),
    };
    for (const listener of listeners) listener();
  };

  const updateJob = (id: string, update: Partial<ConsultingToolJob>) => {
    const job = jobs.get(id);
    if (!job) return;
    job.snapshot = { ...job.snapshot, ...update };
    publish();
  };

  const cancelJob = (id: string) => {
    const job = jobs.get(id);
    if (!job) return;
    if (job.snapshot.status !== 'queued' && job.snapshot.status !== 'running') {
      return;
    }

    job.controller.abort();
    updateJob(id, {
      status: 'cancelled',
      error: { code: 'CANCELLED', message: 'Tool 요청이 취소되었습니다.' },
      finishedAt: Date.now(),
    });
  };

  const removeMatchingKeyJobs = (key: string) => {
    let changed = false;
    for (const [id, job] of jobs) {
      if (job.snapshot.key !== key) continue;
      if (
        job.snapshot.status === 'queued' ||
        job.snapshot.status === 'running'
      ) {
        job.controller.abort();
      }
      jobs.delete(id);
      changed = true;
    }
    if (changed) publish();
  };

  const run: ConsultingToolRuntime['run'] = <Output = unknown>(
    request: ConsultingToolRequest,
    options: ConsultingToolRunOptions = {},
  ) => {
    if (disposed) {
      throw new Error('이미 종료된 Consulting Tool Runtime입니다.');
    }

    const policy = options.policy ?? 'parallel';
    if (options.key && policy === 'reuse') {
      const existing = [...jobs.values()]
        .reverse()
        .find(
          (job) =>
            job.snapshot.key === options.key &&
            (job.snapshot.status === 'queued' ||
              job.snapshot.status === 'running' ||
              job.snapshot.status === 'completed'),
        );
      if (existing) return existing.run as ConsultingToolRun<Output>;
      removeMatchingKeyJobs(options.key);
    }
    if (options.key && policy === 'replace') {
      removeMatchingKeyJobs(options.key);
    }

    const id = `tool-job-${++jobId}`;
    const controller = new AbortController();
    const result = Promise.resolve().then(async () => {
      if (controller.signal.aborted) {
        return createConsultingToolRejectedResponse(request.toolId, {
          code: 'CANCELLED',
          message: 'Tool 요청이 취소되었습니다.',
        });
      }

      updateJob(id, { status: 'running', startedAt: Date.now() });
      let response: ConsultingToolResponse<string, Output>;
      try {
        response = (await tools.execute(request, {
          signal: controller.signal,
        })) as ConsultingToolResponse<string, Output>;
      } catch (cause) {
        response = createConsultingToolRejectedResponse(request.toolId, {
          code: controller.signal.aborted ? 'CANCELLED' : 'EXECUTION_FAILED',
          message: controller.signal.aborted
            ? 'Tool 요청이 취소되었습니다.'
            : cause instanceof Error
              ? cause.message
              : `Tool 실행에 실패했습니다: ${request.toolId}`,
        });
      }

      if (!jobs.has(id)) return response;
      if (response.status === 'completed') {
        updateJob(id, {
          status: 'completed',
          output: response.output,
          error: undefined,
          finishedAt: Date.now(),
        });
        return response;
      }

      updateJob(id, {
        status: response.error.code === 'CANCELLED' ? 'cancelled' : 'rejected',
        error: response.error,
        finishedAt: Date.now(),
      });
      return response;
    });

    const handle: ConsultingToolRun<Output> = {
      id,
      result,
      cancel: () => cancelJob(id),
    };
    jobs.set(id, {
      snapshot: {
        id,
        toolId: request.toolId,
        key: options.key,
        groupId: options.groupId,
        label: options.label,
        status: 'queued',
        input: request.input,
        createdAt: Date.now(),
      },
      request,
      options: { ...options, policy },
      controller,
      run: handle,
    });
    publish();
    return handle;
  };

  const retry = (id: string) => {
    const job = jobs.get(id);
    if (!job) return null;
    return run(job.request, { ...job.options, policy: 'replace' });
  };

  const retryGroup: ConsultingToolRuntime['retryGroup'] = (
    groupId,
    options = {},
  ) => {
    const candidates = [...jobs.values()].filter(
      (job) =>
        job.snapshot.groupId === groupId &&
        (!options.failedOnly ||
          job.snapshot.status === 'rejected' ||
          job.snapshot.status === 'cancelled'),
    );
    return candidates.map((job) =>
      run(job.request, { ...job.options, policy: 'replace' }),
    );
  };

  const cancelGroup = (groupId: string) => {
    for (const job of jobs.values()) {
      if (job.snapshot.groupId === groupId) cancelJob(job.snapshot.id);
    }
  };

  const clearGroup = (groupId: string) => {
    let changed = false;
    for (const [id, job] of jobs) {
      if (job.snapshot.groupId !== groupId) continue;
      if (
        job.snapshot.status === 'queued' ||
        job.snapshot.status === 'running'
      ) {
        job.controller.abort();
      }
      jobs.delete(id);
      changed = true;
    }
    if (changed) publish();
  };

  const reset = () => {
    for (const job of jobs.values()) job.controller.abort();
    jobs.clear();
    publish();
  };

  return {
    run,
    retry,
    retryGroup,
    cancel: cancelJob,
    cancelGroup,
    clearGroup,
    reset,
    dispose: () => {
      if (disposed) return;
      reset();
      disposed = true;
      listeners.clear();
    },
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
