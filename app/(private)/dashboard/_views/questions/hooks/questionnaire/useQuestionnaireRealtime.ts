'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

import { useQuestionnaireApi } from '../../lib/questionnaire/api-client';

export type QuestionnaireRealtimeAudience = 'staff' | 'published' | null;

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
    topics.push(`questionnaires:user:${userId}`);

    const channels: RealtimeChannel[] = [];
    const subscribe = async () => {
      // Resolve the session before constructing private-channel join payloads.
      const { data, error } = await supabase.auth.getSession();
      if (disposed || error || !data.session || data.session.user.id !== userId) return;
      await supabase.realtime.setAuth();
      if (disposed) return;
      for (const topic of topics) {
        const channel = supabase
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, invalidate);
        channels.push(channel);
        channel.subscribe((status, error) => {
          if (status === 'SUBSCRIBED') invalidate();
          // A denied private topic must not continuously rejoin. Existing HTTP
          // refresh remains available and still checks server permissions.
          if (status === 'CHANNEL_ERROR' && /unauthorized|permissions|forbidden/i.test(error?.message ?? '')) {
            void supabase.removeChannel(channel);
          }
        });
      }
    };
    void subscribe().catch(() => {
      // Keep the existing polling fallback if session initialization fails.
    });

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
