'use client';

import { Tabs } from '@base-ui/react/tabs';
import {
  ArrowLeft,
  Blocks,
  Eye,
  LoaderCircle,
  Network,
  PencilLine,
  Plus,
  Save,
  Search,
  Table2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import { richTextPlainText } from '@/app/(private)/dashboard/_views/questions/lib/rich-text';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';

import { DashboardPageCategory } from '../../_components/DashboardPageCategory';

import { QuestionBlockFieldEditor } from './components/QuestionBlockFieldEditor';
import { QuestionBlockPreview } from './components/QuestionBlockPreview';
import { QuestionConditionEditor } from './components/QuestionConditionEditor';
import { QuestionDetailsEditor } from './components/QuestionDetailsEditor';
import { QuestionManagementTable } from './components/QuestionManagementTable';
import { QuestionRelationshipGraph } from './components/QuestionRelationshipGraph';
import { QuestionRichTextEditor } from './components/QuestionRichTextEditor';
import {
  documentFromRow,
  emptyQuestionBlock,
  type QuestionBlockDocument,
  type QuestionBlockField,
  type QuestionBlockRow,
  questionBlockSchema,
  questionName,
} from './lib/question-blocks';

function MaxItemsInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Input
      id="max-rows"
      type="number"
      min={1}
      max={20}
      step={1}
      aria-label="최대 항목 수"
      aria-describedby="max-rows-description"
      className="h-9 w-20 text-center"
      disabled={disabled}
      value={editing ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setEditing(text);
        const count = Number(text);
        if (text && Number.isInteger(count) && count >= 1 && count <= 20)
          onChange(count);
      }}
      onBlur={() => {
        const count = Number(editing ?? value);
        onChange(
          Number.isFinite(count)
            ? Math.max(1, Math.min(20, Math.floor(count)))
            : value,
        );
        setEditing(null);
      }}
    />
  );
}

function readError(result: unknown) {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof result.error === 'string'
  )
    return result.error;
  return '요청을 처리하지 못했어요.';
}

function stableDocument(value: QuestionBlockDocument) {
  return JSON.stringify(
    { ...value, title: value.title.trim(), details: value.details ?? [] },
    (_key, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
        : item,
  );
}

function localDraftKey(userId: string, id?: string) {
  return `question-block-draft:${userId}${id ? `:${id}` : ''}`;
}

function clearLocalDraft(userId: string | null, id: string) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(localDraftKey(userId, id));
    const legacy = readLocalDraft(userId);
    if (legacy?.document.id === id)
      window.localStorage.removeItem(localDraftKey(userId));
  } catch {}
}

type LocalQuestionBlockDraft = {
  document: QuestionBlockDocument;
  savedDocument: QuestionBlockDocument | null;
  revision: number;
  savedAt: string | null;
};

function readLocalDraft(
  userId: string,
  id?: string,
): LocalQuestionBlockDraft | null {
  try {
    const raw =
      window.localStorage.getItem(localDraftKey(userId, id)) ??
      (id ? window.localStorage.getItem(localDraftKey(userId)) : null);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const local = value as Partial<LocalQuestionBlockDraft>;
    if (
      !local.document ||
      typeof local.document.id !== 'string' ||
      (id !== undefined && local.document.id !== id) ||
      typeof local.document.title !== 'string' ||
      typeof local.document.prompt !== 'string' ||
      !Array.isArray(local.document.fields) ||
      typeof local.revision !== 'number' ||
      !Number.isInteger(local.revision) ||
      local.revision < 0
    )
      return null;
    return {
      document: {
        ...local.document,
        fields: local.document.fields.map((field, index) => ({
          ...field,
          label: field.label.trim() || `답변 ${index + 1}`,
        })),
      },
      savedDocument: local.savedDocument ?? null,
      revision: local.revision,
      savedAt: local.savedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function QuestionsView() {
  const requestedId = useSearchParams().get('question');
  const activeId = useRef<string | null>(null);
  const sessions = useRef(
    new Map<
      string,
      LocalQuestionBlockDraft & {
        conflicted?: boolean;
        saveError?: string | null;
      }
    >(),
  );
  const pendingSaves = useRef(
    new Map<
      string,
      {
        document: QuestionBlockDocument;
        expectedRevision: number;
        saveId: string;
      }
    >(),
  );
  const savingRef = useRef(false);
  const [blocks, setBlocks] = useState<QuestionBlockRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionBlockDocument | null>(null);
  const [savedDocument, setSavedDocument] =
    useState<QuestionBlockDocument | null>(null);
  const [revision, setRevision] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [query, setQuery] = useState('');
  const [listMode, setListMode] = useState<'table' | 'graph'>('table');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<QuestionBlockRow | null>(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const loadBlocks = useCallback(async () => {
    setLoadError(false);
    try {
      const response = await fetch('/api/questions', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data));
      setBlocks(data.blocks);
      setUserId(data.userId);
      setRole(data.role);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/questions', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(readError(data));
        return data;
      })
      .then((data) => {
        if (!active) return;
        setBlocks(data.blocks);
        setUserId(data.userId);
        setRole(data.role);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return blocks.filter(
      (block) =>
        questionName(block).toLocaleLowerCase().includes(search) ||
        richTextPlainText(block.prompt).toLocaleLowerCase().includes(search),
    );
  }, [blocks, query]);
  const existing = blocks.find((block) => block.id === draft?.id);
  const candidates = blocks.filter((block) => block.id !== draft?.id);
  const dirty = draft
    ? !savedDocument || stableDocument(draft) !== stableDocument(savedDocument)
    : false;
  const valid = draft ? questionBlockSchema.safeParse(draft).success : false;

  function storeSession(
    snapshot: LocalQuestionBlockDraft & {
      conflicted?: boolean;
      saveError?: string | null;
    },
  ) {
    sessions.current.set(snapshot.document.id, snapshot);
    if (!userId) return;
    try {
      if (
        snapshot.savedDocument &&
        stableDocument(snapshot.document) ===
          stableDocument(snapshot.savedDocument)
      ) {
        clearLocalDraft(userId, snapshot.document.id);
      } else {
        window.localStorage.setItem(
          localDraftKey(userId, snapshot.document.id),
          JSON.stringify(snapshot),
        );
      }
    } catch {
      /* In-memory drafts and server saves remain available. */
    }
  }
  const rememberDraft = useEffectEvent(() => {
    if (draft)
      storeSession({
        document: draft,
        savedDocument,
        revision,
        savedAt,
        conflicted,
        saveError,
      });
  });
  useEffect(() => {
    rememberDraft();
  }, [userId, draft, savedDocument, revision, savedAt, conflicted, saveError]);

  function navigateQuestion(id: string | null, replace = false) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('question', id);
    else url.searchParams.delete('question');
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }

  const syncQuestionRoute = useEffectEvent(() => {
    if (loading || loadError || !userId) return;
    if (
      requestedId === activeId.current &&
      (requestedId === null || draft?.id === requestedId)
    )
      return;
    rememberDraft();
    activeId.current = requestedId;
    setConfirmDiscard(false);
    if (!requestedId) {
      setDraft(null);
      setSavedDocument(null);
      setSaveError(null);
      setConflicted(false);
      return;
    }
    if (requestedId === 'new') {
      const document = emptyQuestionBlock();
      storeSession({
        document,
        savedDocument: null,
        revision: 0,
        savedAt: null,
      });
      navigateQuestion(document.id, true);
      return;
    }
    const remote = blocks.find((block) => block.id === requestedId);
    const local =
      sessions.current.get(requestedId) ?? readLocalDraft(userId, requestedId);
    if (
      (remote && role !== 'admin' && remote.created_by !== userId) ||
      (!remote && !local)
    ) {
      toast.add({
        title: remote
          ? '이 질문을 수정할 권한이 없어요.'
          : '질문을 찾을 수 없어요.',
        type: 'error',
      });
      navigateQuestion(null, true);
      return;
    }
    const remoteDocument = remote ? documentFromRow(remote) : null;
    const localDirty =
      local &&
      (!local.savedDocument ||
        stableDocument(local.document) !== stableDocument(local.savedDocument));
    const useLocal = local && (localDirty || !remote);
    const isConflict = !!(
      useLocal &&
      ((remote &&
        remote.revision > local.revision &&
        stableDocument(remoteDocument!) !== stableDocument(local.document)) ||
        (!remote && local.revision > 0))
    );
    const sameSaved =
      remoteDocument &&
      local &&
      stableDocument(remoteDocument) === stableDocument(local.document);
    setDraft(useLocal ? local.document : remoteDocument);
    setSavedDocument(
      sameSaved || !useLocal ? remoteDocument : local.savedDocument,
    );
    setRevision(sameSaved || !useLocal ? remote!.revision : local.revision);
    setSavedAt(sameSaved || !useLocal ? remote!.updated_at : local.savedAt);
    setConflicted(isConflict);
    setSaveError(
      isConflict ? '다른 곳에서 수정됐어요. 작성 내용은 유지됩니다.' : null,
    );
  });
  useEffect(() => {
    // Browser history is the external source of truth for the active editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncQuestionRoute();
  }, [requestedId, loading, loadError, userId]);

  function updateDraft(changes: Partial<QuestionBlockDocument>) {
    setDraft((current) => (current ? { ...current, ...changes } : null));
  }

  function updateField(fieldId: string, updated: QuestionBlockField) {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId ? updated : field,
            ),
          }
        : null,
    );
  }

  function returnToList() {
    navigateQuestion(null);
  }
  function leaveEditor() {
    if (dirty) setConfirmDiscard(true);
    else returnToList();
  }

  function openEditor(block?: QuestionBlockRow) {
    if (!block) {
      const document = emptyQuestionBlock();
      storeSession({
        document,
        savedDocument: null,
        revision: 0,
        savedAt: null,
      });
      navigateQuestion(document.id);
    } else navigateQuestion(block.id);
  }

  async function save(manual = true) {
    if (
      !draft ||
      savingRef.current ||
      conflicted ||
      (!dirty && !pendingSaves.current.has(draft.id))
    )
      return;
    let attempt = pendingSaves.current.get(draft.id);
    if (!attempt) {
      const parsed = questionBlockSchema.safeParse(draft);
      if (!parsed.success) {
        if (manual)
          toast.add({
            title:
              parsed.error.issues[0]?.message ?? '질문 내용을 확인해 주세요.',
            type: 'error',
          });
        return;
      }
      attempt = {
        document: parsed.data,
        expectedRevision: revision,
        saveId: crypto.randomUUID(),
      };
      pendingSaves.current.set(draft.id, attempt);
    }
    savingRef.current = true;
    setBusy(true);
    setSaveError(null);
    const attemptId = attempt.document.id;
    const isCurrentQuestion = () =>
      activeId.current === attemptId &&
      new URL(window.location.href).searchParams.get('question') === attemptId;
    const recordError = (message: string, conflict = false) => {
      const session = sessions.current.get(attemptId);
      if (session)
        storeSession({
          ...session,
          saveError: message,
          conflicted: conflict || session.conflicted,
        });
      if (isCurrentQuestion()) {
        if (conflict) setConflicted(true);
        setSaveError(message);
      }
    };
    try {
      const response = await fetch(
        attempt.expectedRevision > 0
          ? `/api/questions/${attempt.document.id}`
          : '/api/questions',
        {
          method: attempt.expectedRevision > 0 ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: attempt.document,
            expectedRevision: attempt.expectedRevision,
            saveId: attempt.saveId,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        const message = readError(data);
        if (response.status < 500) pendingSaves.current.delete(attemptId);
        recordError(message, response.status === 409);
        if (manual) toast.add({ title: message, type: 'error' });
        return;
      }
      const saved = data.block as QuestionBlockRow;
      setBlocks((current) => [
        saved,
        ...current.filter((block) => block.id !== saved.id),
      ]);
      const session = sessions.current.get(attemptId);
      if (session)
        storeSession({
          ...session,
          savedDocument: attempt.document,
          revision: saved.revision,
          savedAt: saved.updated_at,
          conflicted: false,
          saveError: null,
        });
      if (isCurrentQuestion()) {
        setRevision(saved.revision);
        setSavedAt(saved.updated_at);
        setSavedDocument(attempt.document);
        setSaveError(null);
      }
      pendingSaves.current.delete(attemptId);
      if (manual) toast.add({ title: '질문을 저장했어요.', type: 'success' });
    } catch {
      const message = '저장 결과를 확인하지 못했어요. 연결을 확인해 주세요.';
      recordError(message);
      if (manual) toast.add({ title: message, type: 'error' });
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  const autoSave = useEffectEvent(() => {
    if (draft?.id === requestedId && dirty && valid && !conflicted)
      void save(false);
  });
  useEffect(() => {
    const timer = window.setInterval(autoSave, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const beforeNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank')
        return;
      if (!window.confirm('저장되지 않은 질문 내용이 있어요. 이동할까요?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.document.addEventListener('click', beforeNavigate, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.document.removeEventListener('click', beforeNavigate, true);
    };
  }, [dirty, busy]);

  async function archive() {
    if (!pendingArchive || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/questions/${pendingArchive.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: pendingArchive.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(readError(data));
      setPendingArchive(null);
      await loadBlocks();
      toast.add({ title: '질문을 보관했어요.', type: 'success' });
    } catch (error) {
      toast.add({
        title:
          error instanceof Error ? error.message : '질문을 보관하지 못했어요.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="question-management-title"
      data-question-editor={draft ? '' : undefined}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DashboardPageCategory view="questions" />
          <h1
            id="question-management-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.03em] md:text-3xl"
          >
            {draft ? (existing ? '질문 수정' : '질문 만들기') : '질문 관리'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            질문과 답변 열을 만들고, 질문 간 순서와 조건을 설정합니다.
          </p>
        </div>
        {draft ? (
          <Button
            disabled={busy || conflicted || (!dirty && !!savedAt)}
            onClick={() => void save()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            {busy ? '저장 중…' : '저장'}
          </Button>
        ) : (
          <Button disabled={loading || loadError} onClick={() => openEditor()}>
            <Plus aria-hidden="true" /> 질문 만들기
          </Button>
        )}
      </div>

      {draft ? (
        <div className="space-y-6">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={leaveEditor}
          >
            <ArrowLeft aria-hidden="true" /> 목록으로
          </Button>

          <Tabs.Root defaultValue="edit">
            <Tabs.List
              className="mb-5 inline-flex gap-1 rounded-full bg-neutral-200/70 p-1 dark:bg-neutral-800"
              aria-label="질문 보기 방식"
            >
              {[
                { value: 'edit', label: '편집', icon: PencilLine },
                { value: 'preview', label: '미리보기', icon: Eye },
              ].map(({ value, label, icon: Icon }) => (
                <Tabs.Tab
                  key={value}
                  value={value}
                  className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-background data-active:text-foreground data-active:shadow-sm"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="preview">
              <QuestionBlockPreview
                key={`${draft.id}:${draft.sourceBlockId ?? draft.condition?.clauses[0]?.blockId ?? ''}`}
                document={draft}
                questions={blocks}
              />
            </Tabs.Panel>
            <Tabs.Panel
              value="edit"
              keepMounted
              className="space-y-6 data-[hidden]:hidden"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="block-title">관리용 이름 (선택)</Label>
                  <Input
                    id="block-title"
                    maxLength={200}
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft({ title: event.target.value })
                    }
                    placeholder="입력하지 않으면 질문 내용이 이름으로 표시됩니다."
                    className="bg-background"
                  />
                </div>
                {(busy || conflicted || saveError || valid) && (
                  <p className="text-xs text-muted-foreground" role="status">
                    {busy
                      ? '저장 중…'
                      : conflicted
                        ? '다른 곳에서 수정됐어요. 작성 내용은 유지됩니다.'
                        : saveError
                          ? saveError
                          : dirty
                            ? '변경 사항이 있어요 · 10초마다 자동 저장'
                            : savedAt
                              ? '모든 변경 사항을 저장했어요 · 10초마다 자동 저장'
                              : '내용을 입력하면 10초마다 자동 저장됩니다.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">질문과 답변 구성</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    질문과 답변의 내용을 구성합니다.
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-background p-5 sm:p-6 dark:border-neutral-700">
                <h3 className="font-semibold">질문</h3>
                <div className="flex items-start gap-2 sm:gap-3">
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 pt-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300"
                  >
                    #
                  </span>
                  <QuestionRichTextEditor
                    id={`question-prompt-${draft.id}`}
                    value={draft.prompt}
                    onChange={(prompt) => updateDraft({ prompt })}
                    placeholder="질문을 입력하세요"
                    ariaLabel="질문"
                    maxLength={10000}
                    compact
                    className="min-w-0 flex-1 rounded-lg"
                  />
                </div>
                <QuestionDetailsEditor
                  details={draft.details ?? []}
                  onChange={(details) => updateDraft({ details })}
                />
              </div>

              <div className="space-y-4">
                {draft.fields.map((field, index) => (
                  <QuestionBlockFieldEditor
                    key={field.id}
                    field={field}
                    index={index}
                    fieldCount={draft.fields.length}
                    onChange={(updated) => updateField(field.id, updated)}
                    onRemove={() =>
                      updateDraft({
                        fields: draft.fields.filter(
                          (item) => item.id !== field.id,
                        ),
                      })
                    }
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-12 w-full border-dashed"
                  disabled={draft.fields.length >= 20}
                  onClick={() =>
                    updateDraft({
                      fields: [
                        ...draft.fields,
                        {
                          id: crypto.randomUUID(),
                          label: `답변 ${draft.fields.length + 1}`,
                          kind: 'text',
                        },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden="true" /> 답변 열 추가
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border bg-background p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {draft.rowMode === 'reference' ? (
                    <p className="text-sm text-muted-foreground">
                      앞선 질문의 응답 항목 수에 맞춰 반복됩니다.
                    </p>
                  ) : (
                    <>
                      <Label htmlFor="max-rows">최대</Label>
                      <MaxItemsInput
                        value={
                          draft.rowMode === 'repeatable'
                            ? (draft.maxRows ?? 1)
                            : 1
                        }
                        disabled={false}
                        onChange={(count) => {
                          if (draft.rowMode === 'reference') return;
                          updateDraft({
                            rowMode: count > 1 ? 'repeatable' : 'single',
                            maxRows: count > 1 ? count : null,
                          });
                        }}
                      />
                      <Label htmlFor="max-rows">개 항목 입력</Label>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div>
                  <h2 className="font-semibold">조건 설정</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    질문들간의 관계를 설정합니다.
                  </p>
                </div>
              </div>
              <QuestionConditionEditor
                key={draft.id}
                questions={candidates}
                document={draft}
                onChange={updateDraft}
              />
              <p className="text-sm text-muted-foreground">
                질문과 관계를 먼저 관리하는 단계입니다. 기존 질문지나 응답
                화면에는 아직 연결되지 않았습니다.
              </p>
            </Tabs.Panel>
          </Tabs.Root>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search
                aria-hidden="true"
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="질문 검색"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름이나 질문 내용으로 검색"
              />
            </div>
            <div
              className="inline-flex gap-1 rounded-full bg-muted p-1"
              role="group"
              aria-label="질문 목록 보기 방식"
            >
              {(
                [
                  { value: 'table', label: '테이블', icon: Table2 },
                  { value: 'graph', label: '그래프', icon: Network },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={listMode === value}
                  onClick={() => setListMode(value)}
                  className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${listMode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              질문을 불러오고 있어요…
            </p>
          ) : loadError ? (
            <div className="rounded-2xl border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                질문 목록을 불러오지 못했어요.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void loadBlocks()}
              >
                다시 시도
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border bg-background p-10 text-center text-sm text-muted-foreground">
              <Blocks className="size-10 text-neutral-400" aria-hidden="true" />
              {query ? '검색 결과가 없어요.' : '아직 만든 질문이 없어요.'}
            </div>
          ) : listMode === 'table' ? (
            <QuestionManagementTable
              questions={filtered}
              allQuestions={blocks}
              canManage={(q) => role === 'admin' || q.created_by === userId}
              onOpen={openEditor}
              onArchive={setPendingArchive}
            />
          ) : (
            <QuestionRelationshipGraph
              questions={blocks}
              matchedQuestions={filtered}
              canManage={(q) => role === 'admin' || q.created_by === userId}
              onOpen={openEditor}
            />
          )}
        </div>
      )}

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>작성 중인 내용을 버릴까요?</DialogTitle>
            <DialogDescription>
              저장하지 않은 질문의 변경 내용은 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              계속 작성
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (draft) {
                  clearLocalDraft(userId, draft.id);
                  sessions.current.delete(draft.id);
                  pendingSaves.current.delete(draft.id);
                }
                activeId.current = null;
                setDraft(null);
                setConfirmDiscard(false);
                returnToList();
              }}
            >
              변경 내용 버리기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingArchive)}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>질문을 보관할까요?</DialogTitle>
            <DialogDescription>
              보관하면 목록에서 사라집니다. 다른 질문이 참조 중이라면 보관할 수
              없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void archive()}
            >
              보관
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
