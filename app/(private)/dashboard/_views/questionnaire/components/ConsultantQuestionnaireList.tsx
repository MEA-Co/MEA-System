'use client';
import { Tabs } from '@base-ui/react/tabs';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';

import { useQuestionnaireResource } from '../lib/api-client';
import type { QuestionnaireListItem } from '../lib/types';

import {
  NewPublicationBadge,
  usePublicationNotifications,
} from './PublicationNotifications';
import { QuestionnaireLoading } from './QuestionnaireLoading';
export function ConsultantQuestionnaireList({
  items,
}: {
  items: QuestionnaireListItem[];
}) {
  const { data, error } =
    useQuestionnaireResource<{ version_id: string; status: string }[]>(
      '/responses',
    );
  const { unreadIds } = usePublicationNotifications();
  if (!data)
    return error ? (
      <p role="alert">{error.message}</p>
    ) : (
      <QuestionnaireLoading />
    );
  const complete = new Set(
    data.filter((r) => r.status === 'submitted').map((r) => r.version_id),
  );
  const groups = [
    {
      id: 'pending',
      label: '답변 전',
      items: items.filter((i) => !complete.has(i.id)),
    },
    {
      id: 'complete',
      label: '답변 완료',
      items: items.filter((i) => complete.has(i.id)),
    },
  ];
  return (
    <Tabs.Root defaultValue="pending">
      <Tabs.List
        aria-label="답변 상태"
        className="mb-6 flex gap-1 rounded-lg bg-muted p-1"
      >
        {groups.map((group) => (
          <Tabs.Tab
            key={group.id}
            value={group.id}
            className="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm data-active:bg-background data-active:shadow-sm"
          >
            {group.label} ({group.items.length})
            {group.id === 'pending' &&
              group.items.some((i) => unreadIds.includes(i.id)) && (
                <NewPublicationBadge
                  count={
                    group.items.filter((i) => unreadIds.includes(i.id)).length
                  }
                />
              )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {groups.map((group) => (
        <Tabs.Panel key={group.id} value={group.id}>
          {group.items.length ? (
            <ul className="divide-y overflow-hidden rounded-xl border bg-background">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className={
                    unreadIds.includes(item.id)
                      ? 'bg-blue-50/40 dark:bg-blue-950/20'
                      : ''
                  }
                >
                  <Link
                    href={`/dashboard?view=questionnaire&draft=${item.id}`}
                    prefetch={false}
                    className="flex items-center gap-4 p-5 hover:bg-muted/50"
                  >
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {item.title}
                        </span>
                        {unreadIds.includes(item.id) && <NewPublicationBadge />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {complete.has(item.id)
                          ? '완료한 답변 보기'
                          : data.some(
                                (r) =>
                                  r.version_id === item.id &&
                                  r.status === 'in_progress',
                              )
                            ? '이어서 답변하기'
                            : '답변하기'}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              {group.id === 'pending'
                ? '답변할 질문지가 없어요.'
                : '아직 답변을 완료한 질문지가 없어요.'}
            </p>
          )}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
