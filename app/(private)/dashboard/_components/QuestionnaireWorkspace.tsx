import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { loadQuestionnaireWorkspace } from '@/features/questionnaires/server';

import { QuestionnaireEditor } from './QuestionnaireEditor';

export async function QuestionnaireWorkspace({
  requestedId,
}: {
  requestedId?: string;
}) {
  const { initialDraft, drafts } =
    await loadQuestionnaireWorkspace(requestedId);
  return (
    <>
      <div className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center gap-2">
        <details className="relative">
          <summary className="cursor-pointer rounded-lg border px-3 py-2 text-sm">
            저장한 질문지 ({drafts.length})
          </summary>
          <div className="absolute top-full left-0 z-20 mt-2 max-h-72 w-72 overflow-auto rounded-xl border bg-background p-2 shadow-lg">
            {drafts.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">
                저장한 질문지가 없어요.
              </p>
            ) : (
              drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/dashboard?view=questionnaire&draft=${draft.id}`}
                  className="block truncate rounded-md p-2 text-sm hover:bg-muted"
                  aria-current={
                    draft.id === initialDraft.versionId ? 'page' : undefined
                  }
                >
                  {draft.title || '제목 없는 질문지'}
                </Link>
              ))
            )}
          </div>
        </details>
        <Button
          variant="outline"
          render={<Link href="/dashboard?view=questionnaire&draft=new" />}
          nativeButton={false}
        >
          새 질문지
        </Button>
      </div>
      <QuestionnaireEditor
        key={initialDraft.versionId}
        initialDraft={initialDraft}
      />
    </>
  );
}
