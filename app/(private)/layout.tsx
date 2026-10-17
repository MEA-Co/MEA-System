import type { ReactNode } from 'react';

import { ServiceAnnouncement } from '@/components/announcements/ServiceAnnouncement';

export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ServiceAnnouncement />
      {children}
    </>
  );
}
