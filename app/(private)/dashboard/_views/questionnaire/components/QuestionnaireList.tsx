'use client';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

import type { QuestionnaireListItem as Item } from '../lib/types';

import { DeleteQuestionnaireButton } from './DeleteQuestionnaireButton';
import {
  NewPublicationBadge,
  usePublicationNotifications,
} from './PublicationNotifications';
import { PublishQuestionnaireButton } from './PublishQuestionnaireButton';

const updatedDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});
export function QuestionnaireList({
  drafts,
  published,
  distributed,
  staff,
}: {
  drafts: Item[];
  published: Item[];
  distributed: Item[];
  staff: boolean;
}) {
  const { unreadIds } = usePublicationNotifications();
  const newCount = published.filter((item) =>
    unreadIds.includes(item.id),
  ).length;
  return (
    <Tabs.Root defaultValue={staff ? 'draft' : 'distributed'}>
      <Tabs.List
        className="mb-6 flex gap-1 rounded-lg bg-muted p-1"
        aria-label="질문지 상태"
      >
        {(staff
          ? (['draft', 'published', 'distributed'] as const)
          : (['distributed'] as const)
        ).map((tab) => (
          <Tabs.Tab
            key={tab}
            value={tab}
            className="flex flex-1 flex-wrap items-center justify-center gap-2 rounded-md px-3 py-2 text-sm data-[active]:bg-background data-[active]:shadow-sm"
          >
            {tab === 'published'
              ? `게시된 질문지 (${published.length})`
              : tab === 'draft'
                ? `작업 중인 질문지 (${drafts.length})`
                : `배포된 질문지 (${distributed.length})`}
            {tab === 'published' && newCount > 0 && (
              <NewPublicationBadge count={newCount} />
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {(staff
        ? (['draft', 'published', 'distributed'] as const)
        : (['distributed'] as const)
      ).map((tab) => {
        const items =
          tab === 'published'
            ? published
            : tab === 'draft'
              ? drafts
              : distributed;
        return (
          <Tabs.Panel key={tab} value={tab}>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              전체 {items.length}개
            </p>
            {items.length ? (
              <ul className="divide-y overflow-hidden rounded-xl border bg-background">
                {items.map((draft) => (
                  <li
                    key={draft.id}
                    className={`flex items-center ${unreadIds.includes(draft.id) ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                  >
                    <Link
                      href={`/dashboard?view=questionnaire&draft=${draft.id}`}
                      prefetch={false}
                      className="flex min-w-0 flex-1 items-center gap-4 p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <FileText
                          className="size-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">
                            {draft.title || '제목 없는 질문지'}
                          </p>
                          {unreadIds.includes(draft.id) && (
                            <NewPublicationBadge />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tab === 'distributed' ? '배포일 ' : '최근 저장 '}
                          <time
                            dateTime={draft.distributedAt ?? draft.updatedAt}
                          >
                            {updatedDate.format(
                              new Date(draft.distributedAt ?? draft.updatedAt),
                            )}
                          </time>
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {tab === 'distributed'
                          ? '배포됨'
                          : tab === 'published'
                            ? '게시 중'
                            : '작성 중'}
                      </Badge>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Link>
                    {draft.isOwner && tab !== 'distributed' && (
                      <PublishQuestionnaireButton
                        mode={tab === 'draft' ? 'publish' : 'distribute'}
                        versionId={draft.id}
                        revision={draft.revision}
                        title={draft.title}
                      />
                    )}
                    {draft.canDelete && (
                      <DeleteQuestionnaireButton
                        versionId={draft.id}
                        revision={draft.revision}
                        hasDistributed={draft.hasDistributed}
                        title={draft.title}
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
                <FileText
                  className="mb-4 size-9 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="font-medium">
                  {tab === 'distributed'
                    ? '아직 배포된 질문지가 없어요.'
                    : tab === 'published'
                      ? '아직 게시된 질문지가 없어요.'
                      : '아직 작업 중인 질문지가 없어요.'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tab === 'distributed'
                    ? staff
                      ? '게시된 질문지를 배포하면 여기에 표시돼요.'
                      : '질문지가 배포되면 여기에 표시돼요.'
                    : tab === 'published'
                      ? '작업 중인 질문지를 게시하면 여기에 표시돼요.'
                      : '‘새 질문지 제작’을 눌러 첫 질문지를 작성해 보세요.'}
                </p>
              </div>
            )}
          </Tabs.Panel>
        );
      })}
    </Tabs.Root>
  );
}
