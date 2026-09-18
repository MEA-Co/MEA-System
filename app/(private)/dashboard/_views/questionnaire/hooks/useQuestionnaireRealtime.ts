'use client';

import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

import { useQuestionnaireApi } from '../lib/api-client';

export type QuestionnaireRealtimeAudience = 'staff' | 'distributed' | null;

export function useQuestionnaireRealtime(
  audience: QuestionnaireRealtimeAudience,
  userId: string,
) {
  const { refresh } = useQuestionnaireApi();

  useEffect(() => {
    if (!audience) return;

    const supabase = createClient();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    // One save can emit several events. Coalesce the burst without postponing
    // indefinitely, and avoid API requests while the tab is hidden/offline.
    const flush = () => {
      timer = undefined;
      if (disposed || document.hidden || !navigator.onLine || !pending) return;
      pending = false;
      void refresh().catch(() => {});
    };
    const invalidate = () => {
      if (disposed) return;
      pending = true;
      if (timer === undefined) timer = setTimeout(flush, 250);
    };
    const resume = () => {
      if (pending) invalidate();
    };
    const topics = [`questionnaires:${audience}`];
    if (audience === 'staff') topics.push(`questionnaires:user:${userId}`);

    const channels = topics.map((topic) =>
      supabase
        .channel(topic, { config: { private: true } })
        .on('broadcast', { event: 'changed' }, invalidate)
        .subscribe((status) => {
          // Catch changes between initial fetch and subscription, including
          // reconnects. supabase-js supplies and refreshes the session JWT.
          if (status === 'SUBSCRIBED') invalidate();
        }),
    );

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    const stop = () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== userId))
        stop();
    });

    return () => {
      stop();
      auth.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [audience, userId, refresh]);
}
