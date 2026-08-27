'use client';

import {
  BookOpen,
  Check,
  ExternalLink,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { useKeywordSuggestions } from '@/app/(private)/consulting/material-box/_hooks/useKeywordSuggestions';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type KeywordSuggestionDrawerProps = {
  majors: ReadonlyArray<string>;
  selectedSuggestions: ReadonlyArray<ReadonlyArray<KeywordSuggestion>>;
  onToggle: (majorIndex: number, suggestion: KeywordSuggestion) => void;
  onApply: () => void;
};

function SuggestionSourceLink({
  link,
}: {
  link: KeywordSuggestion['links'][number];
}) {
  const isLaboratory = link.type === 'laboratory';
  const Icon = isLaboratory ? FlaskConical : BookOpen;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{link.title}</span>
      <ExternalLink className="size-2.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

export function KeywordSuggestionDrawer({
  majors,
  selectedSuggestions,
  onToggle,
  onApply,
}: KeywordSuggestionDrawerProps) {
  const { status, results } = useKeywordSuggestions();
  const [open, setOpen] = useState(false);
  const [activeMajorIndex, setActiveMajorIndex] = useState(0);
  const isReady = status === 'ready' && results.length === majors.length;
  const activeResult = results[activeMajorIndex];
  const selectedCount = useMemo(
    () => selectedSuggestions.reduce((count, items) => count + items.length, 0),
    [selectedSuggestions],
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={!isReady}
      onClick={() => setOpen(true)}
    >
      <Sparkles aria-hidden="true" />
      키워드를 정하기 어려워요
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {!isReady ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="inline-flex"
                  tabIndex={0}
                  aria-disabled="true"
                />
              }
            >
              {trigger}
            </TooltipTrigger>
            <TooltipContent side="top">
              {status === 'error'
                ? '키워드 제안을 받아오지 못했습니다.'
                : '응답을 받아오는 중입니다...'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}

      <DrawerContent className="md:max-w-xl">
        <DrawerHeader className="border-b">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4" aria-hidden="true" />
            세부 키워드 제안
          </DrawerTitle>
          <DrawerDescription>
            관심 가는 키워드를 여러 개 고를 수 있어요. 대학 공식 학과·연구실
            페이지도 함께 살펴보세요.
          </DrawerDescription>
        </DrawerHeader>

        {majors.length > 1 && (
          <div
            className="flex gap-2 overflow-x-auto border-b px-5 py-3"
            role="tablist"
            aria-label="희망 전공"
          >
            {majors.map((major, index) => (
              <Button
                key={`${index}-${major}`}
                type="button"
                size="sm"
                variant={activeMajorIndex === index ? 'secondary' : 'ghost'}
                role="tab"
                aria-selected={activeMajorIndex === index}
                onClick={() => setActiveMajorIndex(index)}
              >
                {major}
                {selectedSuggestions[index]?.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {selectedSuggestions[index].length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4">
            <p className="text-sm font-semibold">{activeResult?.major}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              제안은 탐색의 출발점이에요. 링크를 확인한 뒤 내 관심에 맞는 분야를
              선택해보세요.
            </p>
          </div>

          <div className="space-y-3">
            {activeResult?.suggestions.map((suggestion) => {
              const selected = selectedSuggestions[activeMajorIndex]?.some(
                (item) => item.keyword === suggestion.keyword,
              );

              return (
                <article
                  key={suggestion.keyword}
                  className={cn(
                    'rounded-xl border bg-background p-4 transition-colors',
                    selected && 'border-primary/45 bg-primary/3',
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left focus-visible:outline-none"
                    aria-pressed={selected}
                    onClick={() => onToggle(activeMajorIndex, suggestion)}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background',
                      )}
                      aria-hidden="true"
                    >
                      {selected && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {suggestion.keyword}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {suggestion.description}
                      </span>
                    </span>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-1.5 pl-8">
                    {suggestion.links.map((link) => (
                      <SuggestionSourceLink
                        key={`${link.type}-${link.url}`}
                        link={link}
                      />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-background p-5">
          <p className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `총 ${selectedCount}개 선택됨`
              : '관심 가는 키워드를 선택해주세요'}
          </p>
          <Button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => {
              onApply();
              setOpen(false);
            }}
          >
            선택한 키워드 적용
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
