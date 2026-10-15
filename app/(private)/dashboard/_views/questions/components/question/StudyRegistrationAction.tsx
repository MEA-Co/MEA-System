'use client';

import { Plus } from 'lucide-react';

import { useStudyList } from '@/app/(private)/dashboard/_views/study/hooks/useStudyList';
import { StudyView } from '@/app/(private)/dashboard/_views/study/StudyView';
import { Button } from '@/components/ui/button';

export function StudyRegistrationAction({ label }: { label: string }) {
  const { data, error, mutate } = useStudyList('own', true, undefined, {
    identityOnly: true,
  });
  if (error && !data)
    return (
      <div role="alert" className="space-y-2 text-sm text-destructive">
        <p>학습법 등록 화면을 불러오지 못했어요.</p>
        <Button type="button" variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="space-y-2">
        <Button
          type="button"
          disabled
          size="wrap"
        >
          <Plus aria-hidden="true" />
          {label}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          학습법 등록 화면을 준비하고 있어요.
        </p>
      </div>
    );
  return (
    <StudyView
      userId={data.userId}
      registrationOnly
      registrationLabel={label}
    />
  );
}
