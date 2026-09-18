'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SWRConfig } from 'swr';

import {
  type QuestionnaireRealtimeAudience,
  useQuestionnaireRealtime,
} from '../hooks/useQuestionnaireRealtime';
import {
  useQuestionnaireApi,
  useQuestionnaireResource,
} from '../lib/api-client';

const PublicationContext = createContext<{
  unreadIds: string[];
  markRead: (id: string) => Promise<void>;
}>({ unreadIds: [], markRead: async () => {} });

export function PublicationNotifications({
  enabled,
  realtimeAudience,
  userId,
  children,
}: {
  enabled: boolean;
  realtimeAudience: QuestionnaireRealtimeAudience;
  userId: string;
  children: ReactNode;
}) {
  const [cache] = useState(() => new Map());
  const config = useMemo(() => ({ provider: () => cache }), [cache]);
  return (
    <SWRConfig value={config}>
      <PublicationState
        enabled={enabled}
        realtimeAudience={realtimeAudience}
        userId={userId}
      >
        {children}
      </PublicationState>
    </SWRConfig>
  );
}
function PublicationState({
  enabled,
  realtimeAudience,
  userId,
  children,
}: {
  enabled: boolean;
  realtimeAudience: QuestionnaireRealtimeAudience;
  userId: string;
  children: ReactNode;
}) {
  useQuestionnaireRealtime(realtimeAudience, userId);
  const { data, mutate } = useQuestionnaireResource<string[]>(
    enabled ? '/unread' : null,
  );
  const { command } = useQuestionnaireApi();
  const markRead = useCallback(
    async (id: string) => {
      try {
        const result = await command(`/${id}/read`, 'PUT', {});
        if (!result.error)
          await mutate((ids) => (ids ?? []).filter((value) => value !== id), {
            revalidate: true,
          });
      } catch {
        /* Retain unread on network failure. */
      }
    },
    [command, mutate],
  );
  const value = useMemo(
    () => ({ unreadIds: data ?? [], markRead }),
    [data, markRead],
  );
  return (
    <PublicationContext.Provider value={value}>
      {children}
    </PublicationContext.Provider>
  );
}

export function usePublicationNotifications() {
  return useContext(PublicationContext);
}

export function PublicationReadMarker({ versionId }: { versionId: string }) {
  const { unreadIds, markRead } = usePublicationNotifications();
  const unread = unreadIds.includes(versionId);
  useEffect(() => {
    if (unread) void markRead(versionId);
  }, [unread, versionId, markRead]);
  return null;
}

export function NewPublicationBadge({ count }: { count?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300"
      aria-label={
        count ? `새로 게시된 질문지 ${count}개` : '새로 게시된 질문지'
      }
    >
      {count ? `NEW ${count}` : 'NEW'}
    </span>
  );
}
