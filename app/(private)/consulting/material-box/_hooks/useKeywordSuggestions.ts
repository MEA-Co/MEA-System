'use client';

import { useCallback, useMemo } from 'react';

import {
  useConsultingToolRuntime,
  useConsultingToolRuntimeSnapshot,
} from '@/app/(private)/consulting/_components/ConsultingToolRuntimeProvider';
import {
  type GenerateKeywordSuggestionsToolOutput,
  isGenerateKeywordSuggestionsToolOutput,
  KEYWORD_SUGGESTION_GROUP_PREFIX,
} from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';

export type KeywordSuggestionStatus = 'idle' | 'loading' | 'ready' | 'error';

function getLatestKeywordSuggestionGroupId(
  jobs: ReturnType<typeof useConsultingToolRuntimeSnapshot>['jobs'],
) {
  let latestGroupId: string | null = null;
  let latestCreatedAt = -1;

  for (const job of jobs) {
    if (!job.groupId?.startsWith(KEYWORD_SUGGESTION_GROUP_PREFIX)) continue;
    if (job.createdAt < latestCreatedAt) continue;
    latestGroupId = job.groupId;
    latestCreatedAt = job.createdAt;
  }

  return latestGroupId;
}

export function useKeywordSuggestions() {
  const runtime = useConsultingToolRuntime();
  const snapshot = useConsultingToolRuntimeSnapshot();

  const state = useMemo(() => {
    const groupId = getLatestKeywordSuggestionGroupId(snapshot.jobs);
    if (!groupId) {
      return {
        groupId: null,
        status: 'idle' as const,
        results: [] as ReadonlyArray<GenerateKeywordSuggestionsToolOutput>,
        error: null,
      };
    }

    const jobs = snapshot.jobs.filter((job) => job.groupId === groupId);
    if (
      jobs.some((job) => job.status === 'queued' || job.status === 'running')
    ) {
      return {
        groupId,
        status: 'loading' as const,
        results: [] as ReadonlyArray<GenerateKeywordSuggestionsToolOutput>,
        error: null,
      };
    }

    const failedJob = jobs.find(
      (job) => job.status === 'rejected' || job.status === 'cancelled',
    );
    if (failedJob) {
      return {
        groupId,
        status: 'error' as const,
        results: [] as ReadonlyArray<GenerateKeywordSuggestionsToolOutput>,
        error:
          failedJob.error?.message ?? '세부 키워드 제안을 불러오지 못했습니다.',
      };
    }

    const completedJobs = [...jobs]
      .filter((job) => job.status === 'completed')
      .sort((left, right) => (left.key ?? '').localeCompare(right.key ?? ''));
    const results = completedJobs.map((job) => job.output);
    if (
      completedJobs.length === 0 ||
      !results.every(isGenerateKeywordSuggestionsToolOutput)
    ) {
      return {
        groupId,
        status: 'error' as const,
        results: [] as ReadonlyArray<GenerateKeywordSuggestionsToolOutput>,
        error: '세부 키워드 제안 Tool 응답 형식이 올바르지 않습니다.',
      };
    }

    return {
      groupId,
      status: 'ready' as const,
      results,
      error: null,
    };
  }, [snapshot.jobs]);

  const retry = useCallback(() => {
    if (!state.groupId) return;
    runtime.retryGroup(state.groupId, { failedOnly: true });
  }, [runtime, state.groupId]);

  return { ...state, retry };
}
