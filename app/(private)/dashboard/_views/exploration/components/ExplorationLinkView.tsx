'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { AttachmentListSkeleton } from '@/components/patterns/attachment-list-skeleton';
import { CollectionHeader } from '@/components/patterns/collection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { emptyValues, type Exploration } from '@/lib/exploration/fields';
import { fromRow } from '@/lib/exploration/storage-model';
import { type LinkRecord, recordDraft } from '@/lib/exploration-links/model';
import {
  NAVIGATION_EXIT_FAILED,
  NAVIGATION_EXIT_REQUEST,
} from '@/lib/navigation/exit-request';

import { DashboardPageCategory } from '../../../_components/DashboardPageCategory';
import { useExplorationList } from '../hooks/useExplorationList';
import { useLinkDrafts } from '../hooks/useLinkDrafts';
import { linkRequest, readLink } from '../lib/link-api';
import {
  layoutLink,
  type LinkContent,
  type LinkDraft,
} from '../lib/link-drafts';
import { shouldConfirmLinkExit } from '../lib/link-exit-policy';
import { canConnectLink } from '../lib/link-graph';
import { guardLinkHistory } from '../lib/link-history-guard';
import { explorationSummary, explorationTitle } from '../lib/list-model';

import { type LinkGraph } from './ExplorationLinkGraph';
import { ExplorationLinkTable } from './ExplorationLinkTable';
import { ExplorationNavigation } from './ExplorationNavigation';

const ExplorationLinkGraph = dynamic(
  () =>
    import('./ExplorationLinkGraph').then(
      (module) => module.ExplorationLinkGraph,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-130 animate-pulse rounded-lg bg-muted sm:h-150"
        role="status"
        aria-label="탐구줄기 캔버스 불러오는 중"
      />
    ),
  },
);

function ActivityPicker({
  selected,
  onSelect,
}: {
  selected: Exploration[];
  onSelect: (activity: Exploration) => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, error, isLoading, mutate } = useExplorationList(
    'own',
    true,
    undefined,
    { query: search, page },
  );
  const loading = isLoading || search !== query.trim();
  const current = data?.page ?? page;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));
  return (
    <>
      <Input
        aria-label="연결할 탐구활동 검색"
        placeholder="탐구활동 검색"
        maxLength={200}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="min-h-48 overflow-y-auto" aria-busy={loading}>
        {error ? (
          <div role="alert" className="space-y-3 p-4">
            <p>탐구활동을 불러오지 못했어요.</p>
            <Button variant="outline" onClick={() => void mutate()}>
              다시 시도
            </Button>
          </div>
        ) : loading ? (
          <AttachmentListSkeleton label="탐구활동 목록을 불러오는 중입니다" />
        ) : (
          <ul className="divide-y">
            {data?.activities.map((row) => {
              const activity = fromRow(row);
              const added = selected.some(
                (item) => item.clientKey === activity.clientKey,
              );
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onSelect(activity)}
                    className="flex w-full items-center gap-4 rounded-lg p-4 text-left hover:bg-accent disabled:cursor-default disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block wrap-break-word font-medium">
                        {explorationTitle(activity)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {explorationSummary(activity)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm">
                      {added ? '배치됨' : '배치'}
                    </span>
                  </button>
                </li>
              );
            })}
            {!data?.activities.length && (
              <li className="p-6 text-center text-muted-foreground">
                {search
                  ? '검색 결과가 없어요.'
                  : '확정한 탐구활동이 없어요. 탐구활동 탭에서 먼저 등록해 주세요.'}
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !!error || current <= 1}
          onClick={() => setPage(current - 1)}
        >
          이전
        </Button>
        <span className="text-sm">
          {current} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !!error || current >= pages}
          onClick={() => setPage(current + 1)}
        >
          다음
        </Button>
      </div>
    </>
  );
}

export function ExplorationLinkView({
  userId,
  canViewOthers,
}: {
  userId: string;
  canViewOthers: boolean;
}) {
  const drafts = useLinkDrafts(userId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const editor = params.get('linkEditor');
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LinkDraft | null>(null);
  const [busy, setBusy] = useState(false);
  function navigate(id?: string, replace = false, confirmed = false) {
    if (!replace) setCreatedDraftId(null);
    const next = new URLSearchParams(params.toString());
    next.set('tab', 'links');
    next.delete('stemEditor');
    if (confirmed) next.set('linkSource', 'confirmed');
    else next.delete('linkSource');
    if (id) next.set('linkEditor', id);
    else next.delete('linkEditor');
    router[replace ? 'replace' : 'push'](`${pathname}?${next}`, {
      scroll: !replace,
    });
  }
  if (!drafts.ready)
    return (
      <AttachmentListSkeleton label="탐구줄기 임시저장을 불러오는 중입니다" />
    );
  if (editor)
    return (
      <LinkEditorLoader
        key={editor === createdDraftId ? 'new' : editor}
        editor={editor}
        confirmed={params.get('linkSource') === 'confirmed'}
        drafts={drafts.drafts}
        save={drafts.save}
        remove={drafts.remove}
        userId={userId}
        onSaved={(id, confirmed = false) => {
          if (editor === 'new') {
            // Keep the new editor mounted when its URL gains the saved ID.
            setCreatedDraftId(id);
          }
          navigate(id, true, confirmed);
        }}
        onBack={() => navigate()}
      />
    );
  return (
    <section className="space-y-6" aria-labelledby="link-management-title">
      <CollectionHeader
        id="link-management-title"
        category={<DashboardPageCategory view="exploration" />}
        title="탐구줄기 관리"
        description="탐구활동을 연결해 하나의 탐구 흐름을 만들어 보세요."
        action={
          <Button onClick={() => navigate('new')}>
            <Plus />
            탐구줄기 추가
          </Button>
        }
      />
      <ExplorationNavigation links />
      <p className="text-sm text-muted-foreground">
        임시저장은 현재 계정의 이 브라우저에만 보관됩니다. 브라우저 데이터를
        지우면 삭제되며 다른 기기에는 공유되지 않습니다.
      </p>
      {drafts.errors.map((error, i) => (
        <p key={i} role="alert">
          {error}
        </p>
      ))}
      <ExplorationLinkTable
        canViewOthers={canViewOthers}
        drafts={drafts.drafts}
        userId={userId}
        onOpen={(draft) => navigate(draft.id)}
        onOpenConfirmed={(id) => navigate(id, false, true)}
        onDelete={setDeleting}
      />
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>임시저장을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 브라우저에 저장한 탐구줄기가 삭제됩니다. 탐구활동 원본은
              유지됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!deleting) return;
                setBusy(true);
                try {
                  await drafts.remove(deleting);
                  setDeleting(null);
                } catch (error) {
                  toast.add({
                    title:
                      error instanceof Error
                        ? error.message
                        : '삭제하지 못했습니다.',
                    type: 'error',
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
function LinkEditorLoader({
  editor,
  drafts,
  confirmed,
  ...props
}: { editor: string; drafts: LinkDraft[]; confirmed: boolean } & Omit<
  Parameters<typeof LinkEditor>[0],
  'initial'
>) {
  const [openedAsNew] = useState(editor === 'new');
  const [local] = useState(() =>
    confirmed ? undefined : drafts.find((draft) => draft.id === editor),
  );
  if (openedAsNew || local) return <LinkEditor initial={local} {...props} />;
  return <RemoteLinkEditor editor={editor} {...props} />;
}
function RemoteLinkEditor({
  editor,
  ...props
}: { editor: string } & Omit<Parameters<typeof LinkEditor>[0], 'initial'>) {
  const [data, setData] = useState<LinkRecord>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    readLink(
      editor,
      AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result.link);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : '탐구줄기를 불러오지 못했습니다.',
          );
      });
    return () => controller.abort();
  }, [editor, attempt]);
  if (data) return <LinkEditor initial={recordDraft(data)} {...props} />;
  if (error)
    return (
      <div className="space-y-3">
        <p role="alert">{error}</p>
        <Button
          onClick={() => {
            setError('');
            setAttempt(attempt + 1);
          }}
        >
          다시 시도
        </Button>
        <Button onClick={props.onBack}>목록</Button>
      </div>
    );
  return <AttachmentListSkeleton label="탐구줄기를 불러오는 중입니다" />;
}
function restoreGraph(draft?: LinkDraft): LinkGraph {
  if (!draft) return { nodes: [], edges: [], skills: [] };
  const positions = layoutLink(
    draft.content.graph.nodes,
    draft.content.graph.edges,
  )!;
  return {
    ...draft.content.graph,
    nodes: draft.content.graph.nodes.map((node, index) => ({
      ...positions[index],
      activity: {
        clientKey: node.explorationId,
        revision: 0,
        status: 'confirmed',
        updatedAt: draft.updatedAt,
        values: { ...emptyValues(), topic: node.title },
      },
    })),
  };
}
function linkEditorContent(
  name: string,
  description: string,
  graph: LinkGraph,
): LinkContent {
  return {
    name,
    description,
    graph: {
      nodes: graph.nodes.map(({ activity }) => ({
        explorationId: activity.clientKey,
        title: explorationTitle(activity),
      })),
      edges: graph.edges.map(({ from, to, skillId }) => ({
        from,
        to,
        skillId,
      })),
      skills: graph.skills ?? [],
    },
  };
}
function LinkEditor({
  initial,
  save,
  remove,
  userId,
  onSaved,
  onBack,
}: {
  initial?: LinkDraft;
  save: ReturnType<typeof useLinkDrafts>['save'];
  remove: ReturnType<typeof useLinkDrafts>['remove'];
  userId: string;
  onSaved: (id: string, confirmed?: boolean) => void;
  onBack: () => void;
}) {
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [revision, setRevision] = useState(initial?.localRevision ?? 0);
  const [serverRevision, setServerRevision] = useState(
    initial?.serverRevision ?? 0,
  );
  const readOnly = !!initial && initial.ownerId !== userId;
  const confirmAttempt = useRef<{ fingerprint: string; saveId: string } | null>(
    null,
  );
  const latestDraft = useRef(initial?.localRevision ? initial : undefined);
  const [name, setName] = useState(initial?.content.name ?? '');
  const [description, setDescription] = useState(
    initial?.content.description ?? '',
  );
  const [graph, setGraph] = useState<LinkGraph>(() => restoreGraph(initial));
  const content = linkEditorContent(name, description, graph);
  const fingerprint = JSON.stringify(content);
  const [baseline, setBaseline] = useState(fingerprint);
  const [confirmedBaseline, setConfirmedBaseline] = useState<string | null>(
    initial?.serverRevision && !initial.localRevision ? fingerprint : null,
  );
  const [skillDirty, setSkillDirty] = useState(false);
  const dirty = fingerprint !== baseline || skillDirty;
  const unchangedConfirmed = fingerprint === confirmedBaseline && !skillDirty;
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const approvedExit = useRef(false);
  const pendingExit = useRef<(() => void) | null>(null);
  useEffect(() => {
    approvedExit.current = false;
  }, [fingerprint, skillDirty]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const [error, setError] = useState('');
  const activities = graph.nodes.map((node) => node.activity);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (approvedExit.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const intercept = (event: MouseEvent) => {
      if (approvedExit.current) return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        !shouldConfirmLinkExit(
          window.location.href,
          anchor.href,
          anchor.target,
          anchor.hasAttribute('download'),
          event,
        )
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) {
        pendingExit.current = () => {
          approvedExit.current = true;
          anchor.click();
        };
        setLeaving(true);
      }
    };
    document.addEventListener('click', intercept, true);
    return () => document.removeEventListener('click', intercept, true);
  }, [dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const cleanup = guardLinkHistory(
      window,
      busy,
      (proceed) => {
        pendingExit.current = proceed;
        setLeaving(true);
      },
      () => approvedExit.current,
    );
    return () => {
      cleanup();
      pendingExit.current = null;
    };
  }, [dirty, busy, currentUrl]);
  useEffect(() => {
    const request = (event: Event) => {
      if ((!dirty && !busy) || approvedExit.current) return;
      event.preventDefault();
      if (busy) return;
      const proceed = (event as CustomEvent<{ proceed: () => void }>).detail
        .proceed;
      pendingExit.current = () => {
        approvedExit.current = true;
        proceed();
      };
      setLeaving(true);
    };
    const submit = (event: SubmitEvent) => {
      if ((!dirty && !busy) || approvedExit.current) return;
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        !form.hasAttribute('data-navigation-exit')
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      const submitter = event.submitter;
      pendingExit.current = () => {
        approvedExit.current = true;
        form.requestSubmit(submitter);
      };
      setLeaving(true);
    };
    const failed = () => {
      approvedExit.current = false;
    };
    window.addEventListener(NAVIGATION_EXIT_REQUEST, request);
    window.addEventListener(NAVIGATION_EXIT_FAILED, failed);
    document.addEventListener('submit', submit, true);
    return () => {
      window.removeEventListener(NAVIGATION_EXIT_REQUEST, request);
      window.removeEventListener(NAVIGATION_EXIT_FAILED, failed);
      document.removeEventListener('submit', submit, true);
    };
  }, [dirty, busy]);
  async function persist() {
    setBusy(true);
    setError('');
    try {
      const saved = await save(id, revision, content, serverRevision);
      latestDraft.current = saved;
      setRevision(saved.localRevision);
      setBaseline(fingerprint);
      toast.add({ title: '이 브라우저에 임시저장했습니다.', type: 'success' });
      onSaved(saved.id);
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === 'QuotaExceededError'
          ? '브라우저 저장 공간이 부족합니다. 작성 내용은 유지했습니다.'
          : error instanceof Error
            ? error.message
            : '임시저장하지 못했습니다. 작성 내용은 유지했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (busy || readOnly || unchangedConfirmed) return;
    const validationMessage = skillDirty
      ? '작성 중인 연계 스킬을 먼저 적용해 주세요.'
      : !name.trim()
        ? '탐구줄기 이름을 입력해 주세요.'
        : !graph.edges.length
          ? '탐구활동을 하나 이상 연결해 주세요.'
          : null;
    if (validationMessage) {
      toast.add({ title: validationMessage, type: 'error' });
      return;
    }
    const missingSkills = graph.edges.filter(
      (edge) =>
        !edge.skillId ||
        !graph.skills?.some((skill) => skill.id === edge.skillId),
    ).length;
    if (missingSkills) {
      toast.add({
        title: `연계 스킬이 없는 연결이 ${missingSkills}개 있어요. 모든 연결에 스킬을 할당해 주세요.`,
        type: 'error',
      });
      return;
    }
    setBusy(true);
    setError('');
    if (confirmAttempt.current?.fingerprint !== fingerprint)
      confirmAttempt.current = { fingerprint, saveId: crypto.randomUUID() };
    try {
      const { link } = await linkRequest<{ link: LinkRecord }>(
        `/api/exploration-links/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            content,
            expectedRevision: serverRevision,
            saveId: confirmAttempt.current.saveId,
          }),
        },
      );
      const saved = recordDraft(link);
      setServerRevision(link.revision);
      setName(saved.content.name);
      setDescription(saved.content.description);
      // Confirmation intentionally drops isolated cards; keep the positions of surviving ones.
      const restored = restoreGraph(saved);
      setGraph({
        ...restored,
        nodes: restored.nodes.map((n) => ({
          ...n,
          position:
            graph.nodes.find(
              (old) => old.activity.clientKey === n.activity.clientKey,
            )?.position ?? n.position,
        })),
      });
      // Compare the same editor representation on both sides. JSONB may reorder
      // object keys, and displayed activity titles are trimmed by explorationTitle.
      const savedFingerprint = JSON.stringify(
        linkEditorContent(
          saved.content.name,
          saved.content.description,
          restored,
        ),
      );
      setBaseline(savedFingerprint);
      setConfirmedBaseline(savedFingerprint);
      confirmAttempt.current = null;
      let cleanupFailed = false;
      if (latestDraft.current) {
        try {
          await remove(latestDraft.current);
          latestDraft.current = undefined;
          setRevision(0);
        } catch {
          cleanupFailed = true;
        }
      }
      if (cleanupFailed)
        setError(
          'DB에는 확정했습니다. 다른 탭에서 수정했거나 저장소에 접근할 수 없어 임시저장은 보존했습니다. 목록에서 확인해 주세요.',
        );
      toast.add({ title: '탐구줄기를 확정했습니다.', type: 'success' });
      onSaved(id, true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '확정하지 못했습니다. 입력은 유지됩니다.',
      );
    } finally {
      setBusy(false);
    }
  }
  function place(activity: Exploration) {
    setGraph((current) => {
      if (
        current.nodes.some(
          (node) => node.activity.clientKey === activity.clientKey,
        )
      )
        return current;
      const index = current.nodes.length;
      const position = { x: (index % 3) * 400, y: Math.floor(index / 3) * 160 };
      while (
        current.nodes.some((node) => {
          const p = node.position ?? { x: node.column * 400, y: 0 };
          return (
            Math.abs(p.x - position.x) < 280 && Math.abs(p.y - position.y) < 130
          );
        })
      )
        position.y += 160;
      return {
        ...current,
        nodes: [...current.nodes, { activity, column: index % 3, position }],
      };
    });
    setPickerOpen(false);
  }
  return (
    <section
      className="space-y-6"
      aria-labelledby="link-editor-title"
      inert={busy}
    >
      <Button
        variant="ghost"
        onClick={() => {
          pendingExit.current = null;
          if (dirty) setLeaving(true);
          else onBack();
        }}
      >
        <ArrowLeft />
        탐구줄기 목록
      </Button>
      <CollectionHeader
        id="link-editor-title"
        title={
          readOnly
            ? '탐구줄기 보기'
            : initial
              ? '탐구줄기 수정'
              : '탐구줄기 추가'
        }
        description="연결할 탐구활동을 선택하고 탐구가 이어지는 순서로 배치하세요."
      />
      <div className="space-y-6 rounded-xl bg-muted/40 p-4 sm:p-6">
        <Card variant="accent">
          <CardHeader variant="emphasis">
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-name">
                탐구줄기 이름 <span className="text-destructive">*</span>
                <span className="sr-only">필수</span>
              </Label>
              <Input
                id="link-name"
                readOnly={readOnly}
                required
                placeholder="탐구활동들을 연결하는 소재, 핵심 개념 등을 담은 이름을 입력해 주세요."
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">연결된 탐구활동</h2>
          <Badge variant="secondary">{activities.length}개</Badge>
        </div>
        <ExplorationLinkGraph
          userId={userId}
          readOnly={readOnly}
          onDraftChange={setSkillDirty}
          graph={graph}
          onMove={(positions) =>
            setGraph((current) => ({
              ...current,
              nodes: current.nodes.map((node) => {
                const moved = positions.find(
                  (item) => item.id === node.activity.clientKey,
                );
                return moved ? { ...node, position: moved.position } : node;
              }),
            }))
          }
          onAdd={() => setPickerOpen(true)}
          onConnect={(edge) =>
            setGraph((current) => {
              if (
                !current.nodes.some(
                  (node) => node.activity.clientKey === edge.from,
                ) ||
                !current.nodes.some(
                  (node) => node.activity.clientKey === edge.to,
                ) ||
                !canConnectLink(current.edges, edge.from, edge.to)
              )
                return current;
              return { ...current, edges: [...current.edges, edge] };
            })
          }
          onRemove={(id) =>
            setGraph((current) => ({
              ...current,
              nodes: current.nodes.filter(
                (node) => node.activity.clientKey !== id,
              ),
              edges: current.edges.filter(
                (edge) => edge.from !== id && edge.to !== id,
              ),
            }))
          }
          onDetachSkill={(target) =>
            setGraph((current) => ({
              ...current,
              edges: current.edges.map((edge) =>
                edge.from === target.from && edge.to === target.to
                  ? { ...edge, skillId: undefined }
                  : edge,
              ),
            }))
          }
          onReuseSkill={(target, skillId) =>
            setGraph((current) => ({
              ...current,
              edges: current.edges.map((edge) =>
                edge.from === target.from && edge.to === target.to
                  ? { ...edge, skillId }
                  : edge,
              ),
            }))
          }
          onSkillsetChange={(target, skillset) =>
            setGraph((current) => ({
              ...current,
              skills: [
                ...(current.skills ?? []).filter(
                  (skill) => skill.id !== skillset.id,
                ),
                skillset,
              ],
              edges: current.edges.map((edge) =>
                edge.from === target.from && edge.to === target.to
                  ? { ...edge, skillId: skillset.id }
                  : edge,
              ),
            }))
          }
          onDisconnect={(removed) =>
            setGraph((current) => ({
              ...current,
              edges: current.edges.filter(
                (edge) => edge.from !== removed.from || edge.to !== removed.to,
              ),
            }))
          }
        />
        <Card>
          <CardHeader variant="emphasis">
            <CardTitle>
              <Label
                htmlFor="link-description"
                className="text-base font-semibold"
              >
                설명{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  (선택)
                </span>
              </Label>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="link-description"
              readOnly={readOnly}
              placeholder="필요하다면 탐구줄기에 대한 설명을 남겨 주세요."
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </CardContent>
        </Card>
      </div>
      {!readOnly && (
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground" role="status">
            {busy
              ? '저장 중…'
              : dirty
                ? '저장하지 않은 변경사항이 있어요.'
                : serverRevision && !revision
                  ? '확정된 내용입니다.'
                  : revision
                    ? '임시저장된 내용입니다.'
                    : '작성 중인 내용은 이 브라우저에 임시저장할 수 있어요.'}{' '}
            이름을 비워 두어도 임시저장할 수 있습니다.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              disabled={busy || skillDirty || (!dirty && revision > 0)}
              onClick={() => void persist()}
            >
              임시저장
            </Button>
            <Button
              disabled={busy || unchangedConfirmed}
              onClick={() => void confirm()}
            >
              확정하기
            </Button>
          </div>
        </div>
      )}
      {!readOnly && (
        <p className="text-sm text-muted-foreground">
          확정 시 연결된 활동만 저장합니다. 연결되지 않은 활동{' '}
          {
            graph.nodes.filter(
              (n) =>
                !graph.edges.some(
                  (e) =>
                    e.from === n.activity.clientKey ||
                    e.to === n.activity.clientKey,
                ),
            ).length
          }
          개는 확정본에서 제외됩니다. 임시저장은 모두 보관합니다.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <AlertDialog
        open={leaving}
        onOpenChange={(open) => {
          setLeaving(open);
          if (!open) pendingExit.current = null;
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않고 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>
              마지막 저장 이후 변경한 내용은 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 작성</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingExit.current) {
                  const exit = pendingExit.current;
                  pendingExit.current = null;
                  setLeaving(false);
                  exit();
                } else onBack();
              }}
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85dvh] flex flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>탐구활동 배치하기</DialogTitle>
            <DialogDescription>
              캔버스에 배치할 탐구활동을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          {pickerOpen && (
            <div className="min-h-0 space-y-4 overflow-y-auto">
              <div className="space-y-4">
                <ActivityPicker selected={activities} onSelect={place} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
