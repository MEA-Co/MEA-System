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

import { Badge } from '@/components/ui/badge';

import {
  type QuestionnaireRealtimeAudience,
  useQuestionnaireRealtime,
} from '../../hooks/questionnaire/useQuestionnaireRealtime';
import {
  useQuestionnaireApi,
  useQuestionnaireResource,
} from '../../lib/questionnaire/api-client';

const PublicationContext = createContext<{
  unreadIds: string[];
  hasUnreadReviews: boolean;
  markRead: (id: string) => Promise<void>;
}>({ unreadIds: [], hasUnreadReviews: false, markRead: async () => {} });

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
  const { data: reviewNotifications } = useQuestionnaireResource<{
    hasUnread: boolean;
  }>(enabled && realtimeAudience === 'staff' ? '/unread-reviews' : null);
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
    () => ({
      unreadIds: data ?? [],
      hasUnreadReviews:
        enabled &&
        realtimeAudience === 'staff' &&
        reviewNotifications?.hasUnread === true,
      markRead,
    }),
    [data, markRead, enabled, realtimeAudience, reviewNotifications],
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

export function PublicationReadMarker({
  questionnaireId,
}: {
  questionnaireId: string;
}) {
  const { unreadIds, markRead } = usePublicationNotifications();
  const unread = unreadIds.includes(questionnaireId);
  useEffect(() => {
    if (unread) void markRead(questionnaireId);
  }, [unread, questionnaireId, markRead]);
  return null;
}

export function NewPublicationBadge({ count }: { count?: number }) {
  return (
    <Badge
      variant="secondary"
      className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      aria-label={count ? `새 질문지 ${count}개` : '새 질문지'}
    >
      {count ? `NEW ${count}` : 'NEW'}
    </Badge>
  );
}
