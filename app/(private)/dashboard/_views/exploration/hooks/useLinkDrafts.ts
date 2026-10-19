'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  deleteLinkDraft,
  LINK_DRAFT_EVENT,
  type LinkContent,
  type LinkDraft,
  linkDraftPrefix,
  readLinkDrafts,
  writeLinkDraft,
} from '../lib/link-drafts';

const pending = 'pending';
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener(LINK_DRAFT_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(LINK_DRAFT_EVENT, callback);
  };
};
export function useLinkDrafts(userId: string) {
  const prefix = linkDraftPrefix(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'local',
    userId,
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => {
      try {
        return JSON.stringify(readLinkDrafts(localStorage, prefix, userId));
      } catch {
        return JSON.stringify({
          drafts: [],
          errors: [
            '브라우저 저장소에 접근할 수 없습니다. 저장소 설정을 확인해 주세요.',
          ],
        });
      }
    }, [prefix, userId]),
    () => pending,
  );
  const state = useMemo(
    () =>
      snapshot === pending
        ? { drafts: [], errors: [] }
        : (JSON.parse(snapshot) as { drafts: LinkDraft[]; errors: string[] }),
    [snapshot],
  );
  async function lock<T>(draftId: string, task: () => T): Promise<T> {
    if (!navigator.locks)
      throw new Error(
        '안전한 임시저장을 지원하는 최신 브라우저에서 이용해 주세요.',
      );
    return navigator.locks.request(
      prefix + draftId,
      { signal: AbortSignal.timeout(5000) },
      () => {
        try {
          return task();
        } finally {
          window.dispatchEvent(new Event(LINK_DRAFT_EVENT));
        }
      },
    );
  }
  return {
    ...state,
    ready: snapshot !== pending,
    save: (
      draftId: string,
      revision: number,
      content: LinkContent,
      serverRevision = 0,
    ) =>
      lock(draftId, () =>
        writeLinkDraft(
          localStorage,
          prefix,
          userId,
          draftId,
          revision,
          content,
          serverRevision,
        ),
      ),
    remove: (draft: LinkDraft) =>
      lock(draft.id, () => deleteLinkDraft(localStorage, prefix, draft)),
  };
}
