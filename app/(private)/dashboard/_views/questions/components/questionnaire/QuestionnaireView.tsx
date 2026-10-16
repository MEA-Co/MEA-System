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

import { CollectionHeader } from '@/components/patterns/collection';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

import { DashboardPageCategory } from '../../../../_components/DashboardPageCategory';
import {
  type QuestionnaireApiError,
  useQuestionnaireResource,
} from '../../lib/questionnaire/api-client';
import { QUESTIONNAIRE_REVIEWS_VISIBLE } from '../../lib/questionnaire/features';
import {
  questionnaireDetailHref,
  questionnaireListPath,
} from '../../lib/questionnaire/list-model';
import {
  closeSubmittedResponse,
  SUBMITTED_RESPONSE_PARAM,
} from '../../lib/questionnaire/submitted-navigation';
import type { QuestionnaireViewData } from '../../lib/questionnaire/types';
import { QuestionsNavigation } from '../QuestionsNavigation';

import { QuestionnaireComposer } from './QuestionnaireComposer';
import { QuestionnaireList } from './QuestionnaireList';
import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnaireReadMarker } from './QuestionnaireNotifications';
import { QuestionnaireReviews } from './QuestionnaireReviews';
import { SharedQuestionnaire } from './SharedQuestionnaire';
import { SubmittedResponsesLoading } from './SubmittedResponsesLoading';

export type QuestionnaireEditorState = {
  dirty: boolean;
  saving: boolean;
  emptyTitle: boolean;
  childEditorOpen?: boolean;
};
export function QuestionnaireView({
  requestedId,
  staff,
}: {
  requestedId?: string;
  staff: boolean;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get('draft') ?? undefined;
  const [active, setActive] = useState(requested ?? requestedId);
  const [confirm, setConfirm] = useState(false);
  const continueWriting = useRef<HTMLButtonElement>(null);
  const listFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (searchParams.has('questionnaireEditor')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('questionnaireEditor');
      window.history.replaceState(null, '', url);
    }
  }, [searchParams]);
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
    if (id) {
      url.searchParams.set('draft', id);
    } else {
      url.searchParams.delete('draft');
      url.searchParams.delete('questionnaireEditor');
      url.searchParams.set('tab', 'questionnaires');
      url.searchParams.delete('return');
      url.searchParams.delete('questionnairePanel');
      url.searchParams.delete(SUBMITTED_RESPONSE_PARAM);
      url.searchParams.set('view', 'questions');
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
    if (searchParams.get(SUBMITTED_RESPONSE_PARAM)) {
      closeSubmittedResponse();
      return;
    }
    if (editor.current.saving) return;
    if (editor.current.childEditorOpen || confirm) return;
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
    if (
      active &&
      (editor.current.dirty ||
        editor.current.saving ||
        editor.current.childEditorOpen)
    ) {
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
      <div ref={listFocus} tabIndex={-1} hidden={!!active}>
        <QuestionnairePanel staff={staff} />
      </div>
      {active && (
        <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={requestClose}
          >
            <ArrowLeft />
            {searchParams.get(SUBMITTED_RESPONSE_PARAM)
              ? '제출 목록으로'
              : '질문지 목록으로'}
          </Button>
          <QuestionnairePanel
            staff={staff}
            id={active}
            onEditorState={report}
            paused={confirm}
            onClose={requestClose}
          />
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent initialFocus={continueWriting}>
          <AlertDialogHeader>
            <AlertDialogTitle>작성을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {emptyTitle
                ? '질문지 제목이 비어 있어 저장할 수 없어요. 계속 작성해 제목을 입력하거나 변경 내용을 버려 주세요.'
                : '저장하지 않은 변경 내용이나 답변은 사라집니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              ref={continueWriting}
              variant="outline"
              onClick={() => setConfirm(false)}
            >
              계속 작성
            </Button>
            <Button variant="destructive" onClick={close}>
              변경 내용 버리기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function QuestionnairePanel({
  staff,
  id,
  onEditorState,
  paused = false,
  onClose,
}: {
  onClose?: () => void;
  staff: boolean;
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
  const searchParams = useSearchParams();
  const loadingView =
    staff && searchParams.get('questionnairePanel') === 'responses' ? (
      <SubmittedResponsesLoading
        withTabs
        detail={!!searchParams.get(SUBMITTED_RESPONSE_PARAM)}
      />
    ) : (
      <QuestionnaireLoading editor />
    );
  const newKey = creation.key;
  const path =
    id === 'new'
      ? `/new?instance=${newKey}`
      : id
        ? `/${id}`
        : questionnaireListPath(searchParams, staff);
  const { data, error, mutate, isLoading } =
    useQuestionnaireResource<QuestionnaireViewData>(
      path,
      id && id !== 'new' ? 5_000 : undefined,
      !!id,
    );
  if (!data && !id) {
    return (
      <QuestionnaireContent
        key="list"
        loading={!error}
        onRetry={() => void mutate()}
        data={{
          staff,
          selected: null,
          reviews: [],
          initialDraft: null,
          sharedDocument: null,
        }}
        error={error}
      />
    );
  }
  if (!data || (id === 'new' && isLoading)) {
    if (!error) return loadingView;
    return (
      <div role="alert" className="space-y-3">
        <p>{error.message}</p>
        <Button variant="outline" onClick={() => void mutate()}>
          다시 시도
        </Button>
      </div>
    );
  }
  const document = data.initialDraft ?? data.sharedDocument;
  if (id && id !== 'new' && document?.questionnaireId !== id)
    return error ? <p role="alert">{error.message}</p> : loadingView;
  return (
    <QuestionnaireContent
      key={document?.questionnaireId ?? 'list'}
      data={data}
      loading={!id && isLoading}
      onRetry={() => void mutate()}
      error={error}
      onEditorState={onEditorState}
      paused={paused}
      onClose={onClose}
    />
  );
}
function QuestionnaireContent({
  onRetry,
  loading = false,
  data,
  error,
  onEditorState,
  paused,
  onClose,
}: {
  onClose?: () => void;
  onEditorState?: (state: QuestionnaireEditorState) => void;
  paused?: boolean;
  onRetry?: () => void;
  loading?: boolean;
  data: QuestionnaireViewData;
  error?: QuestionnaireApiError;
}) {
  const searchParams = useSearchParams();
  const [openedDraft] = useState(data.initialDraft);
  const reportEditor = onEditorState;
  const { initialDraft, staff, selected, reviews, sharedDocument } = data;
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
          questionnaireId: selected.id,
          isOwner: selected.isOwner,
          initialReviews: reviews,
          disabled: !!error,
        }
      : undefined;
  const pendingReviewCount =
    data.pendingReviewCount ??
    reviews.filter((review) => !review.resolved_at).length;
  const unlinkedReviews = reviews.filter((review) => !review.question_id);
  if (editorDraft || sharedDocument) {
    return (
      <>
        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 max-w-6xl rounded-lg bg-destructive/10 p-4 text-sm"
          >
            {error.message}
          </p>
        )}
        {((staff && selected?.status === 'in_review' && !selected.isOwner) ||
          (!staff &&
            selected?.status === 'published' &&
            !data.sharedDocument?.sections.some((section) =>
              section.questions.some((question) => question.sourceQuestionId),
            ))) &&
          selected && <QuestionnaireReadMarker questionnaireId={selected.id} />}
        {reviewContext?.isOwner && pendingReviewCount > 0 && (
          <div
            role="status"
            className="mx-auto mb-4 max-w-6xl rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200"
          >
            처리하지 않은 검토 요청이 {pendingReviewCount}개 있어요. 각 질문
            아래에서 확인해 주세요.
          </div>
        )}
        {reviewContext && unlinkedReviews.length > 0 && (
          <div className="mx-auto mb-6 max-w-6xl">
            <QuestionnaireReviews
              {...reviewContext}
              initialReviews={unlinkedReviews}
            />
          </div>
        )}
        {initialDraft && selected?.status === 'in_review' && (
          <p className="mx-auto mb-4 max-w-6xl rounded-lg bg-muted p-4 text-sm">
            검토 중인 질문지입니다. 저장한 수정 내용은 다른 리드와 관리자에게도
            반영됩니다.
          </p>
        )}
        {editorDraft ? (
          <QuestionnaireComposer
            key={`editor:${editorDraft.questionnaireId}`}
            initialDraft={editorDraft}
            onClose={onClose}
            sharedSources={data.sharedSources}
            inReview={selected?.status === 'in_review'}
            onEditorState={reportEditor}
            paused={paused}
            remoteUnavailable={editUnavailable}
            reviewContext={reviewContext}
          />
        ) : sharedDocument && !error ? (
          <SharedQuestionnaire
            submittedResponseCount={selected?.submittedResponseCount}
            onEditorState={reportEditor}
            document={sharedDocument}
            sources={data.sharedSources}
            published={selected?.status === 'published'}
            staff={staff}
            reviewContext={reviewContext}
          />
        ) : null}
      </>
    );
  }
  return (
    <section
      className="w-full space-y-6"
      aria-busy={loading}
      aria-labelledby="questionnaire-management-title"
    >
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error.message}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          )}
        </div>
      )}
      <CollectionHeader
        id="questionnaire-management-title"
        category={<DashboardPageCategory view="questions" />}
        title={staff ? '질문지 관리' : '질문지'}
        description={
          staff
            ? '질문지 작성·검토·배포와 제출 응답을 한곳에서 관리하세요.'
            : '배포된 질문지에 답변하고 제출한 내용을 확인하세요.'
        }
        action={
          staff ? (
            <Button
              render={
                <Link
                  href={questionnaireDetailHref(searchParams, 'new')}
                  prefetch={false}
                  scroll={false}
                />
              }
              nativeButton={false}
            >
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">새 질문지 만들기</span>
              <span className="sm:hidden">추가</span>
            </Button>
          ) : undefined
        }
      />
      {staff && <QuestionsNavigation questionnaire />}
      <QuestionnaireList loading={loading} model={data.list} staff={staff} />
    </section>
  );
}
