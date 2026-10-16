'use client';

import { Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { readAnnouncement } from '@/lib/announcements/client';
import {
  type Announcement,
  isAnnouncementActive,
} from '@/lib/announcements/schema';
import { createClient } from '@/lib/supabase/client';

// This is a sibling of the page, never a wrapper keyed by announcement state.
export function ServiceAnnouncement() {
  const [notice, setNotice] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let active = false;
    let inFlight = false;
    let again = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    async function refresh() {
      if (!active || disposed) return;
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      try {
        const latest = await readAnnouncement();
        if (!disposed && active) setNotice(latest);
      } catch {
        /* Keep the last known notice through transient outages. */
      } finally {
        inFlight = false;
        if (again && !disposed) {
          again = false;
          void refresh();
        }
      }
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      active = Boolean(session);
      if (!active) {
        setNotice(null);
        if (channel) {
          void supabase.removeChannel(channel);
          channel = undefined;
        }
        return;
      }
      if (!channel) {
        channel = supabase
          .channel('service-announcement')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'service_announcements',
            },
            () => {
              void refresh();
            },
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void refresh();
          });
      }
      // Avoid awaiting Supabase work inside the auth callback.
      queueMicrotask(() => {
        void refresh();
      });
    });
    const resume = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        void refresh();
      }
    };
    const poll = window.setInterval(resume, 30_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  if (
    !notice ||
    !isAnnouncementActive(notice, now) ||
    dismissed === notice.revision
  )
    return null;
  return (
    <aside
      aria-label="서비스 공지"
      className="fixed inset-x-3 top-3 z-[110] mx-auto max-w-2xl rounded-lg border border-brand/60 bg-background p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Megaphone aria-hidden="true" className="mt-1 size-5 shrink-0" />
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 flex-1"
        >
          <p className="font-semibold wrap-anywhere">{notice.title}</p>
          <p className="mt-1 max-h-[25dvh] overflow-y-auto text-sm leading-6 whitespace-pre-wrap wrap-anywhere">
            {notice.body}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="공지 닫기"
          onClick={() => setDismissed(notice.revision)}
        >
          <X />
        </Button>
      </div>
    </aside>
  );
}
