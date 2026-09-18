import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

import { loadQuestionnaireView } from '@/app/(private)/dashboard/_views/questionnaire/lib/server';
import { Button } from '@/components/ui/button';

import { PublishedQuestionnaire } from './components/PublishedQuestionnaire';
import { QuestionnaireEditor } from './components/QuestionnaireEditor';
import { QuestionnaireList } from './components/QuestionnaireList';
import { QuestionnaireReviews } from './components/QuestionnaireReviews';

export async function QuestionnaireView({
  requestedId,
}: {
  requestedId?: string;
}) {
  const {
    initialDraft,
    drafts,
    published,
    distributed,
    staff,
    selected,
    reviews,
    publishedDocument,
  } = await loadQuestionnaireView(requestedId);
  if (initialDraft || publishedDocument) {
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
        {selected && selected.status !== 'draft' && staff && (
          <QuestionnaireReviews
            key={`reviews:${selected.id}`}
            versionId={selected.id}
            isOwner={selected.isOwner}
            initialReviews={reviews}
          />
        )}
        {initialDraft && selected?.status === 'published' && (
          <p className="mx-auto mb-4 max-w-4xl rounded-lg bg-muted p-4 text-sm">
            게시 중인 질문지예요. 저장한 수정 내용은 다른 리드와 관리자에게도
            반영됩니다. 배포는 목록에서 진행할 수 있어요.
          </p>
        )}
        {publishedDocument ? (
          <PublishedQuestionnaire
            document={publishedDocument}
            distributed={selected?.status === 'distributed'}
            staff={staff}
          />
        ) : initialDraft ? (
          <QuestionnaireEditor
            key={`editor:${initialDraft.versionId}`}
            initialDraft={initialDraft}
          />
        ) : null}
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
            {staff
              ? '질문지를 작성하고 게시·검토·배포할 수 있어요.'
              : '배포된 질문지를 확인해 보세요.'}
          </p>
        </div>
        {staff && (
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
        )}
      </div>
      <QuestionnaireList
        drafts={drafts}
        published={published}
        distributed={distributed}
        staff={staff}
      />
    </section>
  );
}
