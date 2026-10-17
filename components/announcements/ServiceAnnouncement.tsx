'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  ANNOUNCEMENT_UPDATED_EVENT,
  readAnnouncement,
} from '@/lib/announcements/client';
import {
  type Announcement,
  isAnnouncementActive,
} from '@/lib/announcements/schema';
import { createClient } from '@/lib/supabase/client';

import { AnnouncementBanner } from './AnnouncementBanner';

// This is a sibling of the page, never a wrapper keyed by announcement state.
export function ServiceAnnouncement() {
  const [notice, setNotice] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const banner = useRef<HTMLElement>(null);
  const visible =
    !!notice &&
    isAnnouncementActive(notice, now) &&
    dismissed !== notice.revision;
  useLayoutEffect(() => {
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        '--service-announcement-height',
        `${banner.current?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (banner.current) observer.observe(banner.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(
        '--service-announcement-height',
      );
    };
  }, [visible]);

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
    window.addEventListener(ANNOUNCEMENT_UPDATED_EVENT, resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener(ANNOUNCEMENT_UPDATED_EVENT, resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  if (!visible || !notice) return null;
  return (
    <>
      <div
        aria-hidden="true"
        className="h-[var(--service-announcement-height,0px)] shrink-0"
      />
      <aside
        ref={banner}
        aria-label="서비스 공지"
        className="fixed inset-x-0 top-0 z-40"
      >
        <AnnouncementBanner
          title={notice.title}
          body={notice.body}
          color={notice.color}
          onClose={() => setDismissed(notice.revision)}
        />
      </aside>
    </>
  );
}
