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

import { readQuestionnairePublication } from '../actions/read-publication';

const PublicationContext = createContext<{
  unreadIds: string[];
  markRead: (id: string) => Promise<void>;
}>({ unreadIds: [], markRead: async () => {} });

export function PublicationNotifications({
  unreadIds,
  children,
}: {
  unreadIds: string[];
  children: ReactNode;
}) {
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const markRead = useCallback(async (id: string) => {
    try {
      if (await readQuestionnairePublication(id))
        setConfirmed((ids) => (ids.includes(id) ? ids : [...ids, id]));
    } catch {
      // Keep the unread indicator when confirmation could not be saved.
    }
  }, []);
  const value = useMemo(
    () => ({
      unreadIds: unreadIds.filter((id) => !confirmed.includes(id)),
      markRead,
    }),
    [unreadIds, confirmed, markRead],
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
