'use client';
import { Plus } from 'lucide-react';

import { ExplorationView } from '@/app/(private)/dashboard/_views/exploration/ExplorationView';
import { useExplorationList } from '@/app/(private)/dashboard/_views/exploration/hooks/useExplorationList';
import { Button } from '@/components/ui/button';
export function ExplorationRegistrationAction({ label }: { label: string }) {
  const { data, error, mutate } = useExplorationList('own', true, undefined, {
    identityOnly: true,
  });
  if (error && !data)
    return (
      <div role="alert" className="text-sm text-destructive">
        탐구활동 등록 화면을 불러오지 못했어요.
        <Button variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  if (!data)
    return (
      <Button size="wrap" disabled>
        <Plus aria-hidden="true" />
        {label}
      </Button>
    );
  return (
    <ExplorationView
      userId={data.userId}
      registrationOnly
      registrationLabel={label}
    />
  );
}
