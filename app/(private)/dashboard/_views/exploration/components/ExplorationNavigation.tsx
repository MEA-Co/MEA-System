'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function ExplorationNavigation({ stems }: { stems: boolean }) {
  return (
    <nav aria-label="탐구활동 관리 영역" className="flex gap-2">
      {[
        { tab: 'activities', label: '탐구활동', active: !stems },
        { tab: 'stems', label: '탐구줄기', active: stems },
      ].map((item) => (
        <Button
          key={item.tab}
          variant={item.active ? 'secondary' : 'ghost'}
          nativeButton={false}
          render={
            <Link
              href={`/dashboard?view=exploration&tab=${item.tab}`}
              prefetch={false}
              aria-current={item.active ? 'page' : undefined}
            />
          }
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}
