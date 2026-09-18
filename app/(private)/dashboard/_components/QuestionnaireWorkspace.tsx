import { ArrowLeft, ArrowRight, FileText, Plus } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loadQuestionnaireWorkspace } from '@/features/questionnaires/server';

import { DeleteQuestionnaireButton } from './DeleteQuestionnaireButton';
import { QuestionnaireEditor } from './QuestionnaireEditor';

const updatedDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

export async function QuestionnaireWorkspace({
  requestedId,
}: {
  requestedId?: string;
}) {
  const { initialDraft, drafts } =
    await loadQuestionnaireWorkspace(requestedId);
  if (initialDraft) {
    return (
      <>
        <div className="mx-auto mb-6 max-w-4xl">
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href="/dashboard?view=questionnaire" prefetch={false} />
            }
            nativeButton={false}
          >
            <ArrowLeft aria-hidden="true" />
            질문지 목록으로
          </Button>
        </div>
        <QuestionnaireEditor
          key={initialDraft.versionId}
          initialDraft={initialDraft}
        />
      </>
    );
  }
  return (
    <section
      className="mx-auto max-w-4xl"
      aria-labelledby="questionnaire-management-title"
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            id="questionnaire-management-title"
            className="text-2xl font-semibold tracking-tight"
          >
            질문지 관리
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            저장된 질문지를 이어서 작성하거나 새 질문지를 만들어 보세요.
          </p>
        </div>
        <Button
          render={
            <Link
              href="/dashboard?view=questionnaire&draft=new"
              prefetch={false}
            />
          }
          nativeButton={false}
        >
          <Plus aria-hidden="true" />새 질문지 제작
        </Button>
      </div>
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        전체 {drafts.length}개
      </p>
      {drafts.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-background">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex items-center">
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
                  <p className="truncate font-medium">
                    {draft.title || '제목 없는 질문지'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    최근 저장{' '}
                    <time dateTime={draft.updatedAt}>
                      {updatedDate.format(new Date(draft.updatedAt))}
                    </time>
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  작성 중
                </Badge>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
              <DeleteQuestionnaireButton
                versionId={draft.id}
                revision={draft.revision}
                hasPublished={draft.hasPublished}
                title={draft.title}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
          <FileText
            className="mb-4 size-9 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="font-medium">아직 저장된 질문지가 없어요.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ‘새 질문지 제작’을 눌러 첫 질문지를 작성해 보세요.
          </p>
        </div>
      )}
    </section>
  );
}
