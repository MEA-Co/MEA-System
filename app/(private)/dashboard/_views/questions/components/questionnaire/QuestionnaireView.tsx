'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  type QuestionnaireApiError,
  useQuestionnaireResource,
} from '../../lib/questionnaire/api-client';
import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';
import type { QuestionnaireViewData } from '../../lib/questionnaire/types';

import { PublicationReadMarker } from './PublicationNotifications';
import { PublishedQuestionnaire } from './PublishedQuestionnaire';
import { QuestionnaireComposer } from './QuestionnaireComposer';
import { QuestionnaireList } from './QuestionnaireList';
import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnaireReviews } from './QuestionnaireReviews';

export type QuestionnaireEditorState = {
  dirty: boolean;
  saving: boolean;
  emptyTitle: boolean;
  childEditorOpen?: boolean;
};
export function QuestionnaireView({ requestedId }: { requestedId?: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('draft') ?? undefined;
  const returnToDashboard = searchParams.get('return') === 'dashboard';
  const [active, setActive] = useState(requested ?? requestedId);
  const [confirm, setConfirm] = useState(false);
  const [emptyTitle, setEmptyTitle] = useState(false);
  const editor = useRef<QuestionnaireEditorState>({
    dirty: false,
    saving: false,
    emptyTitle: true,
  });
  const report = useCallback((state: QuestionnaireEditorState) => {
    editor.current = state;
  }, []);
  function navigate(id?: string) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('draft', id);
    else {
      url.searchParams.delete('draft');
      if (returnToDashboard) {
        url.searchParams.delete('tab');
        url.searchParams.delete('return');
        url.searchParams.set('view', 'questions');
      }
    }
    window.history.replaceState(null, '', url);
  }
  function close() {
    editor.current = { dirty: false, saving: false, emptyTitle: true };
    setConfirm(false);
    setActive(undefined);
    navigate();
  }
  function requestClose() {
    if (editor.current.saving) return;
    if (editor.current.childEditorOpen) {
      if (
        !editor.current.dirty ||
        window.confirm(
          '질문과 질문지의 저장하지 않은 변경 내용을 버리고 목록으로 돌아갈까요?',
        )
      )
        close();
      return;
    }
    if (editor.current.dirty) {
      setEmptyTitle(editor.current.emptyTitle);
      setConfirm(true);
    } else close();
  }
  const syncRoute = useEffectEvent(() => {
    if (requested === active) return;
    // First save replaces "new" with the persisted UUID without closing the editor.
    if (active && requested && active === 'new') {
      setActive(requested);
      return;
    }
    if (active && (editor.current.dirty || editor.current.saving)) {
      navigate(active);
      requestClose();
      return;
    }
    editor.current = { dirty: false, saving: false, emptyTitle: true };
    setActive(requested);
  });
  useEffect(() => {
    // Synchronize browser history without unmounting unsaved work.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncRoute();
  }, [requested]);
  return (
    <>
      <div hidden={!!active}>
        <QuestionnairePanel />
      </div>
      {active && (
        <div className="mx-auto max-w-5xl space-y-5">
          <Button variant="ghost" onClick={requestClose}>
            <ArrowLeft />
            {returnToDashboard ? '질문 관리 대시보드로' : '질문지 목록으로'}
          </Button>
          <QuestionnairePanel
            id={active}
            onEditorState={report}
            paused={confirm}
          />
        </div>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>작성 중인 내용을 버릴까요?</DialogTitle>
            <DialogDescription>
              {emptyTitle
                ? '질문지 제목이 비어 있어 저장할 수 없어요. 계속 작성해 제목을 입력하거나 변경 내용을 버려 주세요.'
                : '저장하지 않은 변경 내용이나 답변은 사라집니다.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              계속 작성
            </Button>
            <Button variant="destructive" onClick={close}>
              변경 내용 버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function QuestionnairePanel({
  id,
  onEditorState,
  paused = false,
}: {
  id?: string;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  paused?: boolean;
}) {
  const [creation, setCreation] = useState(() => ({
    id,
    key: crypto.randomUUID(),
  }));
  if (creation.id !== id)
    setCreation({ id, key: id === 'new' ? crypto.randomUUID() : creation.key });
  const newKey = creation.key;
  const path = id === 'new' ? `/new?instance=${newKey}` : id ? `/${id}` : '';
  const { data, error, mutate, isLoading } =
    useQuestionnaireResource<QuestionnaireViewData>(
      path,
      id && id !== 'new' ? 5_000 : undefined,
    );
  if (!data || (id === 'new' && isLoading)) {
    if (!error) return <QuestionnaireLoading />;
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6" role="alert">
        <p>{error.message}</p>
        <Button variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  }
  const document = data.initialDraft ?? data.publishedDocument;
  if (id && id !== 'new' && document?.versionId !== id)
    return error ? (
      <p role="alert">{error.message}</p>
    ) : (
      <QuestionnaireLoading />
    );
  return (
    <QuestionnaireContent
      key={document?.versionId ?? 'list'}
      data={data}
      error={error}
      onEditorState={onEditorState}
      paused={paused}
    />
  );
}
function QuestionnaireContent({
  data,
  error,
  onEditorState,
  paused,
}: {
  onEditorState?: (state: QuestionnaireEditorState) => void;
  paused?: boolean;
  data: QuestionnaireViewData;
  error?: QuestionnaireApiError;
}) {
  const [openedDraft] = useState(data.initialDraft);
  const reportEditor = onEditorState;
  const {
    initialDraft,
    drafts,
    published,
    distributed,
    staff,
    selected,
    reviews,
    publishedDocument,
  } = data;
  const editorDraft = initialDraft ?? openedDraft;
  const editUnavailable =
    error?.status === 404 ||
    error?.status === 403 ||
    error?.status === 401 ||
    (!!openedDraft && !initialDraft);
  const reviewContext =
    QUESTIONNAIRE_REVIEWS_VISIBLE &&
    selected &&
    selected.status !== 'draft' &&
    staff
      ? {
          versionId: selected.id,
          isOwner: selected.isOwner,
          initialReviews: reviews,
          disabled: !!error,
          canRequest: selected.status === 'published',
        }
      : undefined;
  const pendingReviewCount = reviews.filter(
    (review) => !review.resolved_at,
  ).length;
  const unlinkedReviews = reviews.filter((review) => !review.question_id);
  if (editorDraft || publishedDocument) {
    return (
      <>
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-4xl rounded-lg bg-destructive/10 p-4 text-sm"
          >
            {error.message}
          </p>
        )}
        {((staff && selected?.status === 'published' && !selected.isOwner) ||
          (!staff && selected?.status === 'distributed')) &&
          selected && <PublicationReadMarker versionId={selected.id} />}
        {reviewContext?.isOwner && pendingReviewCount > 0 && (
          <div
            role="status"
            className="mx-auto mb-4 max-w-4xl rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
          >
            확인하지 않은 검토 요청이 {pendingReviewCount}개 있어요. 각 질문
            아래에서 확인해 주세요.
          </div>
        )}
        {reviewContext && unlinkedReviews.length > 0 && (
          <div className="mx-auto mb-6 max-w-4xl">
            <QuestionnaireReviews
              {...reviewContext}
              initialReviews={unlinkedReviews}
            />
          </div>
        )}
        {initialDraft && selected?.status === 'published' && (
          <p className="mx-auto mb-4 max-w-4xl rounded-lg bg-muted p-4 text-sm">
            게시 중인 질문지입니다. 저장한 수정 내용은 다른 리드와 관리자에게도
            반영됩니다.
          </p>
        )}
        {editorDraft ? (
          <QuestionnaireComposer
            key={`editor:${editorDraft.versionId}`}
            initialDraft={editorDraft}
            published={selected?.status === 'published'}
            onEditorState={reportEditor}
            paused={paused}
            remoteUnavailable={editUnavailable}
            reviewContext={reviewContext}
          />
        ) : publishedDocument && !error ? (
          <PublishedQuestionnaire
            onEditorState={reportEditor}
            document={publishedDocument}
            sources={data.publishedSources}
            distributed={selected?.status === 'distributed'}
            staff={staff}
            reviewContext={reviewContext}
          />
        ) : null}
      </>
    );
  }
  return (
    <section
      className="w-full"
      aria-labelledby="questionnaire-management-title"
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error.message}
        </p>
      )}
      <div className="mb-8 flex flex-wrap items-center justify-end gap-4">
        <div className="sr-only">
          <h2 id="questionnaire-management-title" className="sr-only">
            질문지
          </h2>
        </div>
        {staff && (
          <Button
            render={
              <Link
                href="/dashboard?view=questions&tab=questionnaires&draft=new"
                prefetch={false}
                scroll={false}
              />
            }
            nativeButton={false}
          >
            <Plus aria-hidden="true" />새 질문지 만들기
          </Button>
        )}
      </div>
      <QuestionnaireList
        drafts={drafts}
        published={published}
        distributed={distributed}
        staff={staff}
        archived={data.archived ?? []}
      />
    </section>
  );
}
