'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { AttachmentListSkeleton } from '@/components/patterns/attachment-list-skeleton';
import { CollectionSearch } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import type { LinkSummary } from '@/lib/exploration-links/model';

import { linkRequest } from '../lib/link-api';
import type { LinkDraft } from '../lib/link-drafts';

export function ExplorationLinkTable({
  canViewOthers,
  userId,
  onOpenConfirmed,
  drafts,
  onOpen,
  onDelete,
}: {
  canViewOthers: boolean;
  userId: string;
  onOpenConfirmed: (id: string) => void;
  drafts: LinkDraft[];
  onOpen: (draft: LinkDraft) => void;
  onDelete: (draft: LinkDraft) => void;
}) {
  const [selectedScope, setScope] = useState('own');
  const scope = canViewOthers ? selectedScope : 'own';
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<LinkSummary | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const [status, setStatus] = useState('all');
  const matches =
    scope === 'others' || status === 'confirmed'
      ? []
      : drafts.filter((draft) =>
          `${draft.content.name} ${draft.content.description}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
        );
  const localOnly = scope === 'own' && status === 'drafts';
  const request = {
    scope,
    query: search,
    page,
    excluded:
      scope === 'own' && status === 'all' ? drafts.map((d) => d.id) : [],
    localCount: matches.length,
  };
  const { data, error, isLoading, mutate } = useSWR(
    localOnly
      ? null
      : ['exploration-links', userId, canViewOthers, JSON.stringify(request)],
    () =>
      linkRequest<{ items: LinkSummary[]; total: number; page: number }>(
        '/api/exploration-links',
        { method: 'POST', body: JSON.stringify(request) },
      ),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const loading = search !== query.trim() || (!localOnly && isLoading);
  const total = localOnly ? matches.length : (data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 10));
  const current = localOnly ? Math.min(page, pages) : (data?.page ?? page);
  const shownDrafts = matches.slice((current - 1) * 10, current * 10);
  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <CollectionSearch
          value={query}
          maxLength={200}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          aria-label="탐구줄기 검색"
          placeholder="탐구줄기 이름, 설명 검색"
          containerClassName="sm:w-auto sm:flex-1"
        />
        <Select
          value={scope === 'others' ? 'all' : status}
          onValueChange={(value) => {
            setStatus(value ?? 'all');
            setPage(1);
          }}
        >
          <SelectTrigger
            className="w-full sm:w-56"
            aria-label={
              scope === 'others' ? '탐구줄기 작성자 필터' : '탐구줄기 저장 상태'
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scope === 'others' ? (
              <SelectItem value="all">전체 작성자</SelectItem>
            ) : (
              <>
                <SelectItem value="all">전체 탐구줄기</SelectItem>
                <SelectItem value="confirmed">확정된 탐구줄기</SelectItem>
                <SelectItem value="drafts">
                  임시저장 ({drafts.length})
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="relative h-[862px] overflow-hidden rounded-lg border border-border sm:h-[662px]">
        <Table className="table-fixed">
          <TableHeader className="bg-muted">
            <TableRow className="h-10">
              <TableHead className="sm:w-[38%]">탐구줄기 이름</TableHead>
              <TableHead className="hidden sm:table-cell">
                연결된 탐구활동
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {scope === 'others' ? '작성자' : '상태'}
              </TableHead>
              <TableHead className="hidden sm:table-cell">수정일</TableHead>
              <TableHead className="w-24 text-right sm:w-[14%]">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading &&
              !error &&
              shownDrafts.map((draft) => (
                <TableRow
                  key={draft.id}
                  tabIndex={-1}
                  className="h-[80px] cursor-pointer focus-visible:outline-2 focus-visible:outline-ring sm:h-[60px]"
                  onClick={(event) => {
                    if (
                      busy ||
                      (event.target as HTMLElement).closest(
                        'button, a, input, select, textarea',
                      )
                    )
                      return;
                    onOpen(draft);
                  }}
                >
                  <TableCell>
                    <button
                      type="button"
                      disabled={busy}
                      className="block w-full cursor-pointer truncate text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      onClick={() => onOpen(draft)}
                    >
                      {draft.content.name.trim() || '이름 없는 탐구줄기'}
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {draft.content.graph.nodes.length}개
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">임시저장</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {new Date(draft.updatedAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => onOpen(draft)}
                        aria-label={`${draft.content.name || '이름 없는 탐구줄기'} 상세 · 수정`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => onDelete(draft)}
                        aria-label={`${draft.content.name || '이름 없는 탐구줄기'} 임시저장 삭제`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!loading &&
              !error &&
              !localOnly &&
              data?.items.map((item) => (
                <TableRow
                  key={item.id}
                  tabIndex={-1}
                  className="h-[80px] cursor-pointer focus-visible:outline-2 focus-visible:outline-ring sm:h-[60px]"
                  onClick={(event) => {
                    if (
                      busy ||
                      (event.target as HTMLElement).closest(
                        'button, a, input, select, textarea',
                      )
                    )
                      return;
                    onOpenConfirmed(item.id);
                  }}
                >
                  <TableCell>
                    <button
                      type="button"
                      disabled={busy}
                      className="block w-full cursor-pointer truncate text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      onClick={() => onOpenConfirmed(item.id)}
                    >
                      {item.name}
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {item.node_count}개
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {scope === 'others' ? (
                      (item.owner_name ?? '작성자')
                    ) : (
                      <Badge variant="success">확정</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {new Date(item.updated_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        onClick={() => onOpenConfirmed(item.id)}
                        aria-label={`${item.name} ${scope === 'own' ? '상세 · 수정' : '상세 보기'}`}
                      >
                        {scope === 'own' ? <Pencil /> : <Eye />}
                      </Button>
                      {scope === 'own' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          onClick={() => setDeleting(item)}
                          aria-label={`${item.name} 삭제`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {loading ? (
          <div className="absolute inset-x-0 top-10">
            <AttachmentListSkeleton label="탐구줄기 목록을 불러오는 중입니다" />
          </div>
        ) : error ? (
          <div className="absolute inset-x-0 top-16 text-center">
            <p role="alert">{error.message}</p>
            <Button variant="outline" onClick={() => void mutate()}>
              다시 시도
            </Button>
          </div>
        ) : (
          !total && (
            <div className="absolute inset-x-0 top-10 bottom-0 flex items-center justify-center bg-background px-4 text-center">
              <div role="status" className="max-w-md space-y-3">
                <p className="font-semibold">
                  {query.trim()
                    ? '검색 결과가 없습니다'
                    : scope === 'own' && status === 'drafts'
                      ? '임시저장한 탐구줄기가 없습니다'
                      : '등록된 탐구줄기가 없습니다'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {query.trim()
                    ? '검색어나 작성자 조건을 바꿔 보세요.'
                    : scope === 'others'
                      ? '다른 작성자가 확정한 탐구줄기가 여기에 표시됩니다.'
                      : '임시저장하거나 확정한 탐구줄기가 여기에 표시됩니다.'}
                </p>
              </div>
            </div>
          )
        )}
      </div>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>탐구줄기를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              확정본이 삭제됩니다. 탐구활동 원본과 재사용 스킬은 유지됩니다.
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
                  await linkRequest(`/api/exploration-links/${deleting.id}`, {
                    method: 'DELETE',
                    body: JSON.stringify({
                      expectedRevision: deleting.revision,
                    }),
                  });
                  setDeleting(null);
                  await mutate();
                } catch (e) {
                  toast.add({
                    title:
                      e instanceof Error ? e.message : '삭제하지 못했습니다.',
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
      <CollectionPagination
        label="탐구줄기 페이지"
        total={total}
        page={current}
        pages={pages}
        loading={loading}
        onPageChange={setPage}
      />
    </div>
  );
  if (!canViewOthers) return content;
  return (
    <Tabs
      value={scope}
      onValueChange={(value) => {
        if (value === 'own' || value === 'others') {
          setScope(value);
          setPage(1);
          setQuery('');
          setStatus('all');
        }
      }}
    >
      <TabsList
        className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
        aria-label="탐구줄기 구분"
      >
        <TabsTrigger value="own" className="min-w-0 px-3 sm:flex-none sm:px-4">
          나의 탐구줄기
        </TabsTrigger>
        <TabsTrigger
          value="others"
          className="min-w-0 px-3 sm:flex-none sm:px-4"
          aria-label="다른 사람의 탐구줄기"
        >
          <span className="sm:hidden">다른 사람</span>
          <span className="hidden sm:inline">다른 사람의 탐구줄기</span>
        </TabsTrigger>
      </TabsList>
      {['own', 'others'].map((value) => (
        <TabsContent key={value} value={value}>
          {content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
