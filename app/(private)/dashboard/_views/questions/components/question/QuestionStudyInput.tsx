'use client';

import { Menu } from '@base-ui/react/menu';
import { Check, Eye, Paperclip, X } from 'lucide-react';
import { useState } from 'react';

import { StudyActivityDetails } from '@/app/(private)/dashboard/_views/study/components/StudyActivityDetails';
import { useStudyList } from '@/app/(private)/dashboard/_views/study/hooks/useStudyList';
import {
  studySummary,
  studyTitle,
} from '@/app/(private)/dashboard/_views/study/lib/fields';
import { fromRow } from '@/app/(private)/dashboard/_views/study/lib/storage-model';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

import { StudyReferenceContent } from './StudyCommands';

export function QuestionStudyInput({
  value = '',
  onChange,
  disabled = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data, error, isLoading, mutate } = useStudyList('own', !disabled);
  const activities = data?.activities;
  const selected = activities?.find((activity) => activity.id === value);
  if (disabled && value)
    return (
      <StudyReferenceContent id={value}>
        첨부한 공부법 보기
      </StudyReferenceContent>
    );
  if (disabled)
    return (
      <Button variant="outline" disabled>
        공부법 첨부
      </Button>
    );
  return (
    <div className="space-y-3">
      {error ? (
        <div role="alert" className="text-sm text-destructive">
          공부법을 불러오지 못했어요.
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            다시 시도
          </Button>
        </div>
      ) : isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          공부법을 불러오는 중이에요.
        </p>
      ) : !activities?.length ? (
        <p className="text-sm text-muted-foreground">
          첨부할 공부법이 없어요. 공부법 관리에서 먼저 확정해 주세요.
        </p>
      ) : (
        // Keep the trigger's conditional focus guards outside the parent spacing layout.
        <div>
          <Menu.Root>
            <Menu.Trigger render={<Button variant="outline" />}>
              <Paperclip aria-hidden="true" />
              {selected ? '공부법 변경' : '공부법 첨부'}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="start" sideOffset={6} className="z-50">
                <Menu.Popup className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                  <Menu.RadioGroup
                    value={selected?.id ?? ''}
                    onValueChange={(id) => onChange?.(id)}
                    aria-label="첨부할 공부법"
                  >
                    {activities.map((activity) => (
                      <Menu.RadioItem
                        key={activity.id}
                        value={activity.id}
                        label={studyTitle(activity.values)}
                        closeOnClick
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      >
                        <span className="mt-0.5 size-4 shrink-0">
                          <Menu.RadioItemIndicator>
                            <Check className="size-4" />
                          </Menu.RadioItemIndicator>
                        </span>
                        <span className="min-w-0">
                          <span className="block wrap-break-word">
                            {studyTitle(activity.values)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {studySummary(activity.values)}
                          </span>
                        </span>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}
      {selected && (
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0">
            <p className="wrap-break-word font-medium">
              {studyTitle(selected.values)}
            </p>
            <p className="text-muted-foreground">
              {studySummary(selected.values)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
              <DrawerTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="공부법 자세히 보기"
                    title="자세히 보기"
                  />
                }
              >
                <Eye aria-hidden="true" />
              </DrawerTrigger>
              <DrawerContent className="h-dvh max-h-dvh rounded-none md:w-[min(1200px,94vw)] md:max-w-none">
                <DrawerHeader>
                  <DrawerTitle>공부법 자세히 보기</DrawerTitle>
                </DrawerHeader>
                <StudyActivityDetails
                  activity={fromRow(selected)}
                  notice="첨부한 공부법입니다. 읽기 전용으로 표시됩니다."
                  onClose={() => setDetailsOpen(false)}
                />
              </DrawerContent>
            </Drawer>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="공부법 첨부 해제"
              title="첨부 해제"
              onClick={() => {
                setDetailsOpen(false);
                onChange?.('');
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
      {value && !selected && !isLoading && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <p role="alert" className="text-sm text-destructive">
            {error
              ? '선택한 활동을 확인하지 못했어요.'
              : '선택한 활동을 찾을 수 없어요. 다시 선택해 주세요.'}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="공부법 첨부 해제"
            title="첨부 해제"
            onClick={() => onChange?.('')}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
