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
import type { MaterialBoxKeywordSuggestionTaskState } from '@/app/(private)/consulting/material-box/_lib/types';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
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
  onRetry: () => void;
  taskState?: MaterialBoxKeywordSuggestionTaskState;
};

function SuggestionSource({
  link,
}: {
  link: KeywordSuggestion['links'][number];
}) {
  const isLaboratory = link.type === 'laboratory';
  const Icon = isLaboratory ? FlaskConical : BookOpen;

  return (
    <div className="min-w-0 rounded-lg bg-muted/55 p-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        {isLaboratory ? '연구실에서 확인한 키워드' : '학과에서 확인한 키워드'}
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground">
        {link.sourceKeyword}
      </p>
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1.5 inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{link.title}</span>
        <ExternalLink className="size-2.5 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}

export function KeywordSuggestionDrawer({
  majors,
  selectedSuggestions,
  onToggle,
  onApply,
  onRetry,
  taskState,
}: KeywordSuggestionDrawerProps) {
  const { status, results } = useKeywordSuggestions(taskState);
  const [open, setOpen] = useState(false);
  const [activeMajorIndex, setActiveMajorIndex] = useState(0);
  const isReady = status === 'ready' && results.length === majors.length;
  const isError = status === 'error';
  const activeResult = results[activeMajorIndex];
  const selectedCount = useMemo(
    () => selectedSuggestions.reduce((count, items) => count + items.length, 0),
    [selectedSuggestions],
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={!isReady && !isError}
      className={cn(
        'group transition-all',
        isReady
          ? 'border-violet-400/35 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-sky-500/10 shadow-sm hover:border-violet-400/60 hover:from-violet-500/15 hover:via-fuchsia-500/15 hover:to-sky-500/15 hover:shadow-md'
          : isError
            ? 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10'
            : 'border-border bg-muted text-muted-foreground shadow-none dark:bg-muted',
      )}
      onClick={() => {
        if (isError) {
          onRetry();
          return;
        }
        setOpen(true);
      }}
    >
      <Sparkles
        className={cn(
          'transition-transform',
          isReady
            ? 'text-violet-500 group-hover:rotate-6 group-hover:scale-110'
            : isError
              ? 'text-destructive'
              : 'text-muted-foreground',
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          'font-semibold',
          isReady
            ? 'bg-linear-to-r from-violet-600 via-fuchsia-600 to-sky-600 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-sky-300'
            : isError
              ? 'text-destructive'
              : 'text-muted-foreground',
        )}
      >
        {isError ? '키워드 제안 다시 받기' : '키워드를 정하기 어려워요'}
      </span>
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {!isReady && !isError ? (
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
              추천 키워드를 준비하는 중입니다...
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

                  <div className="mt-3 grid gap-2 pl-8 sm:grid-cols-2">
                    {suggestion.links.map((link) => (
                      <SuggestionSource
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
              : '관심 가는 키워드를 모두 선택해주세요'}
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
