'use client';

import { Menu } from '@base-ui/react/menu';
import { Check, Eye, Paperclip, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ExplorationDetails } from '@/app/(private)/dashboard/_views/exploration/components/ExplorationDetails';
import { useExplorationList } from '@/app/(private)/dashboard/_views/exploration/hooks/useExplorationList';
import {
  explorationSummary,
  explorationTitle,
} from '@/app/(private)/dashboard/_views/exploration/lib/list-model';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { fromRow } from '@/lib/exploration/storage-model';

import { ExplorationReferenceContent } from './ExplorationCommands';

export function QuestionExplorationInput({
  value = '',
  onChange,
  disabled = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, error, isLoading, mutate } = useExplorationList(
    'own',
    !disabled,
    undefined,
    { query: search, page },
  );
  const selectedResult = useExplorationList(
    'own',
    !disabled && !!value,
    value || undefined,
  );
  const current = data?.page ?? page;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));
  const activities = data?.activities;
  const selected = selectedResult.data?.activities.find(
    (activity) => activity.id === value,
  );
  if (disabled && value)
    return (
      <ExplorationReferenceContent id={value}>
        첨부한 탐구활동 보기
      </ExplorationReferenceContent>
    );
  if (disabled)
    return (
      <Button variant="outline" disabled>
        탐구활동 첨부
      </Button>
    );
  return (
    <div className="space-y-3">
      {
        // Keep the trigger's conditional focus guards outside the parent spacing layout.
        <div>
          <Menu.Root>
            <Menu.Trigger render={<Button variant="outline" />}>
              <Paperclip aria-hidden="true" />
              {selected ? '탐구활동 변경' : '탐구활동 첨부'}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="start" sideOffset={6} className="z-50">
                <Menu.Popup className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none">
                  <div className="space-y-2 p-2">
                    <Input
                      value={query}
                      maxLength={200}
                      aria-label="탐구활동 검색"
                      placeholder="탐구활동 검색"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Escape' && event.key !== 'Tab')
                          event.stopPropagation();
                      }}
                    />
                    {error ? (
                      <div role="alert">
                        불러오지 못했어요.{' '}
                        <Button size="sm" onClick={() => void mutate()}>
                          다시 시도
                        </Button>
                      </div>
                    ) : isLoading || query.trim() !== search ? (
                      <p role="status">불러오는 중이에요.</p>
                    ) : !activities?.length ? (
                      <p className="text-sm text-muted-foreground">
                        검색 결과가 없어요.
                      </p>
                    ) : null}
                  </div>
                  <Menu.RadioGroup
                    value={selected?.id ?? ''}
                    onValueChange={(id) => onChange?.(id)}
                    aria-label="첨부할 탐구활동"
                  >
                    {(!isLoading && query.trim() === search
                      ? (activities ?? [])
                      : []
                    ).map((activity) => (
                      <Menu.RadioItem
                        key={activity.id}
                        value={activity.id}
                        label={explorationTitle(fromRow(activity))}
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
                            {explorationTitle(fromRow(activity))}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {explorationSummary(fromRow(activity))}
                          </span>
                        </span>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioGroup>
                  <div className="flex items-center justify-between gap-2 border-t p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading || !!error || current <= 1}
                      onClick={() => setPage(current - 1)}
                    >
                      이전
                    </Button>
                    <span className="text-xs">
                      {current} / {pages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading || !!error || current >= pages}
                      onClick={() => setPage(current + 1)}
                    >
                      다음
                    </Button>
                  </div>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      }
      {selected && (
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-0">
            <p className="wrap-break-word font-medium">
              {explorationTitle(fromRow(selected))}
            </p>
            <p className="text-muted-foreground">
              {explorationSummary(fromRow(selected))}
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
                    aria-label="탐구활동 자세히 보기"
                    title="자세히 보기"
                  />
                }
              >
                <Eye aria-hidden="true" />
              </DrawerTrigger>
              <DrawerContent className="h-dvh max-h-dvh rounded-none md:w-[min(1200px,94vw)] md:max-w-none">
                <DrawerHeader>
                  <DrawerTitle>탐구활동 자세히 보기</DrawerTitle>
                </DrawerHeader>
                <ExplorationDetails
                  activity={fromRow(selected)}
                  notice="첨부한 탐구활동입니다. 읽기 전용으로 표시됩니다."
                  onClose={() => setDetailsOpen(false)}
                />
              </DrawerContent>
            </Drawer>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="탐구활동 첨부 해제"
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
      {value && !selected && !selectedResult.isLoading && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <p role="alert" className="text-sm text-destructive">
            {selectedResult.error
              ? '선택한 활동을 확인하지 못했어요.'
              : '선택한 활동을 찾을 수 없어요. 다시 선택해 주세요.'}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="탐구활동 첨부 해제"
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
