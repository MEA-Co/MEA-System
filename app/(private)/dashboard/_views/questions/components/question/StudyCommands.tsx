'use client';

import { useState } from 'react';

import { StudyActivityDetails } from '@/app/(private)/dashboard/_views/study/components/StudyActivityDetails';
import { useStudyList } from '@/app/(private)/dashboard/_views/study/hooks/useStudyList';
import { studyTitle } from '@/app/(private)/dashboard/_views/study/lib/fields';
import { fromRow } from '@/app/(private)/dashboard/_views/study/lib/storage-model';
import { StudyView } from '@/app/(private)/dashboard/_views/study/StudyView';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

export function StudyPicker({
  onSelect,
  onEditorOpenChange,
}: {
  onSelect: (id: string, title: string) => void;
  onEditorOpenChange?: (open: boolean) => void;
}) {
  const { data, error, mutate } = useStudyList('own');
  if (error)
    return (
      <div role="alert">
        학습법을 불러오지 못했어요.{' '}
        <Button type="button" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  if (!data) return <p role="status">학습법을 불러오는 중이에요.</p>;
  return (
    <StudyView
      userId={data.userId}
      onEditorOpenChange={onEditorOpenChange}
      onSelect={(activity) =>
        onSelect(activity.clientKey, studyTitle(activity.values))
      }
    />
  );
}

export function StudyReferenceContent({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useStudyList('accessible', open, id);
  const activity = data?.activities.find((item) => item.id === id);
  return (
    <>
      <button
        type="button"
        className="cursor-pointer rounded bg-blue-100 px-1 text-left text-blue-800 underline decoration-blue-300 dark:bg-blue-950 dark:text-blue-200"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-dvh max-h-dvh rounded-none md:w-[min(1200px,94vw)] md:max-w-none">
          <DrawerTitle className="p-6">첨부한 학습법</DrawerTitle>
          {error ? (
            <div role="alert" className="p-6">
              학습법을 불러오지 못했어요.{' '}
              <Button type="button" onClick={() => void mutate()}>
                다시 시도
              </Button>
            </div>
          ) : !data ? (
            <p role="status" className="p-6">
              불러오는 중이에요.
            </p>
          ) : activity ? (
            <StudyActivityDetails
              activity={fromRow(activity)}
              onClose={() => setOpen(false)}
            />
          ) : (
            <p className="p-6">삭제되었거나 조회 권한이 없는 학습법이에요.</p>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
