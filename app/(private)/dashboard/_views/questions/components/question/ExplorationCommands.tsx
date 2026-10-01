'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { ExplorationActivityDetails } from '@/app/(private)/dashboard/_views/exploration/components/ExplorationActivityDetails';
import { ExplorationView } from '@/app/(private)/dashboard/_views/exploration/ExplorationView';
import {
  type ActivityRow,
  fromRow,
} from '@/app/(private)/dashboard/_views/exploration/lib/storage-model';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

async function load(
  url: string,
): Promise<{ userId: string; activities: ActivityRow[] }> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('탐구활동을 불러오지 못했어요.');
  return response.json();
}

export function ExplorationPicker({
  onSelect,
  onEditorOpenChange,
}: {
  onSelect: (id: string, title: string) => void;
  onEditorOpenChange?: (open: boolean) => void;
}) {
  const { data, error, mutate } = useSWR('/api/exploration?scope=own', load);
  if (error)
    return (
      <div role="alert">
        탐구활동을 불러오지 못했어요.{' '}
        <Button type="button" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  if (!data) return <p role="status">탐구활동을 불러오는 중이에요.</p>;
  return (
    <ExplorationView
      userId={data.userId}
      onEditorOpenChange={onEditorOpenChange}
      onSelect={(activity) =>
        onSelect(activity.clientKey, activity.values.topic)
      }
    />
  );
}

export function ExplorationReferenceContent({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data, error, mutate } = useSWR(
    open ? '/api/exploration' : null,
    load,
  );
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
          <DrawerTitle className="p-6">첨부한 탐구활동</DrawerTitle>
          {error ? (
            <div role="alert" className="p-6">
              탐구활동을 불러오지 못했어요.{' '}
              <Button type="button" onClick={() => void mutate()}>
                다시 시도
              </Button>
            </div>
          ) : !data ? (
            <p role="status" className="p-6">
              불러오는 중이에요.
            </p>
          ) : activity ? (
            <ExplorationActivityDetails
              activity={fromRow(activity)}
              onClose={() => setOpen(false)}
            />
          ) : (
            <p className="p-6">삭제되었거나 조회 권한이 없는 탐구활동이에요.</p>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
