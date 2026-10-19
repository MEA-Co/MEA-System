'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { CollectionSearch } from '@/components/patterns/collection';
import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Exploration } from '@/lib/exploration/fields';
import {
  EXPLORATION_PAGE_SIZE,
  matchesExplorationSearch,
} from '@/lib/exploration/list-query';
import { type ExplorationRow, fromRow } from '@/lib/exploration/storage-model';

import { request } from '../lib/api-client';
import { explorationSummary, explorationTitle } from '../lib/list-model';

type Page = {
  userId: string;
  activities: ExplorationRow[];
  total: number;
  page: number;
  pageSize: number;
};
type Summary = {
  mine: number;
  others: number;
  people: { id: string; label: string; count: number }[];
};
type Props = {
  userId: string;
  canViewOthers: boolean;
  local: Exploration[];
  ready: boolean;
  busy: boolean;
  localError: unknown;
  onOpen: (exploration: Exploration, opener: HTMLElement) => void;
  onDelete: (exploration: Exploration) => void;
};

export function ExplorationTable({
  userId,
  canViewOthers,
  local,
  ready,
  busy,
  localError,
  onOpen,
  onDelete,
}: Props) {
  const [selectedScope, setScope] = useState<'own' | 'others'>('own');
  const scope = canViewOthers ? selectedScope : 'own';
  const [status, setStatus] = useState('all');
  const drafts = scope === 'own' && status === 'drafts';
  const combined = scope === 'own' && status === 'all';
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const localVersion = local
    .map((exploration) => `${exploration.clientKey}:${exploration.updatedAt}`)
    .sort()
    .join('|');
  const [seenLocalVersion, setSeenLocalVersion] = useState(localVersion);
  if (seenLocalVersion !== localVersion) {
    setSeenLocalVersion(localVersion);
    setScope('own');
    setStatus('all');
    setPage(1);
    setQuery('');
    setSearch('');
  }
  const summary = useSWR<Summary>(
    ['exploration-summary', userId, canViewOthers],
    () => request('/api/exploration?mode=summary'),
  );
  const params = new URLSearchParams({
    mode: 'table',
    scope,
    page: String(page),
    q: search,
    owner: scope === 'others' ? owner : '',
  });
  const localMatches = local
    .filter((exploration) =>
      matchesExplorationSearch(exploration.values, search),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.clientKey.localeCompare(b.clientKey),
    );
  const localState = JSON.stringify({
    ids: combined
      ? local
          .filter((exploration) => exploration.revision > 0)
          .map((exploration) => exploration.clientKey)
          .sort()
      : [],
    count: combined ? localMatches.length : 0,
  });
  const url = `/api/exploration?${params}`;
  const remote = useSWR<Page>(
    !drafts && ready
      ? ['exploration-page', userId, canViewOthers, url, localState]
      : null,
    () => request(url, { method: 'POST', body: localState }),
  );
  const total = drafts ? localMatches.length : (remote.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / EXPLORATION_PAGE_SIZE));
  const currentPage = drafts
    ? Math.min(page, pages)
    : (remote.data?.page ?? page);
  const rows = drafts
    ? localMatches.slice(
        (currentPage - 1) * EXPLORATION_PAGE_SIZE,
        currentPage * EXPLORATION_PAGE_SIZE,
      )
    : [
        ...(combined
          ? localMatches.slice(
              (currentPage - 1) * EXPLORATION_PAGE_SIZE,
              currentPage * EXPLORATION_PAGE_SIZE,
            )
          : []),
        ...(remote.data?.activities ?? []).map(fromRow),
      ];
  const loading =
    !ready || query.trim() !== search || (!drafts && remote.isLoading);
  const error = drafts ? localError : remote.error;
  const authors = summary.data?.people ?? [];
  const reset = () => {
    setPage(1);
    setQuery('');
    setSearch('');
  };
  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <CollectionSearch
          value={query}
          maxLength={200}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="탐구활동 검색"
          placeholder="주제, 교과명, 활동 내용 검색"
          containerClassName="sm:w-auto sm:flex-1"
        />
        {scope === 'others' ? (
          <Select
            value={owner || 'all'}
            onValueChange={(value) => {
              setOwner(!value || value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="탐구활동 작성자 필터"
            >
              <SelectValue>
                {authors.find((author) => author.id === owner)?.label ??
                  '전체 작성자'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 작성자</SelectItem>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>
                  {author.label} ({author.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? 'all');
              setPage(1);
            }}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="탐구활동 저장 상태"
            >
              <SelectValue>
                {drafts
                  ? `임시저장 (${local.length})`
                  : status === 'all'
                    ? '전체 탐구활동'
                    : '확정된 탐구활동'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 탐구활동</SelectItem>
              <SelectItem value="confirmed">확정된 탐구활동</SelectItem>
              <SelectItem value="drafts">임시저장 ({local.length})</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      {summary.error && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          작성자 목록과 개수를 불러오지 못했습니다.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void summary.mutate()}
          >
            다시 불러오기
          </Button>
        </div>
      )}
      {scope === 'own' && local.length > 0 && (
        <p className="text-xs text-muted-foreground">
          임시저장은 이 브라우저에만 보관됩니다. 항목을 열어 이어서 작성할 수
          있습니다.
        </p>
      )}
      <ExplorationTableRows
        rows={rows}
        loading={loading}
        error={error}
        userId={userId}
        showOthers={scope === 'others'}
        busy={busy}
        onOpen={onOpen}
        onDelete={onDelete}
        onRetry={() => void remote.mutate()}
        filtered={!!search || (scope === 'others' && !!owner)}
        drafts={drafts}
      />
      <CollectionPagination
        label="탐구활동 페이지"
        total={total}
        page={currentPage}
        pages={pages}
        loading={loading}
        error={error}
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
          setStatus('all');
          setOwner('');
          reset();
        }
      }}
    >
      <TabsList
        className="grid w-full grid-cols-2 sm:inline-flex sm:w-fit"
        aria-label="탐구활동 구분"
      >
        <TabsTrigger value="own" className="min-w-0 px-3 sm:flex-none sm:px-4">
          내 탐구활동{' '}
          <Badge variant="count">
            {summary.data
              ? summary.data.mine +
                local.filter((exploration) => exploration.revision === 0).length
              : '—'}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          value="others"
          className="min-w-0 px-3 sm:flex-none sm:px-4"
          aria-label="다른 사람의 탐구활동"
        >
          <span className="sm:hidden">다른 사람</span>
          <span className="hidden sm:inline">다른 사람의 탐구활동</span>
          <Badge variant="count">{summary.data?.others ?? '—'}</Badge>
        </TabsTrigger>
      </TabsList>
      {(['own', 'others'] as const).map((value) => (
        <TabsContent key={value} value={value}>
          {scope === value ? content : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Status({ activity }: { activity: Exploration }) {
  return (
    <Badge
      variant={activity.status === 'draft' ? 'highlight' : 'success'}
      className="shrink-0 text-[10px] sm:text-xs"
    >
      {activity.status === 'draft'
        ? activity.revision > 0
          ? '수정 중 · 임시저장'
          : '임시저장'
        : '확정'}
    </Badge>
  );
}
export function ExplorationTableRows({
  rows,
  loading,
  error,
  userId,
  showOthers,
  busy,
  filtered,
  drafts,
  onOpen,
  onDelete,
  onRetry,
}: {
  rows: Exploration[];
  loading: boolean;
  error: unknown;
  userId: string;
  showOthers: boolean;
  busy: boolean;
  filtered: boolean;
  drafts: boolean;
  onOpen: Props['onOpen'];
  onDelete: Props['onDelete'];
  onRetry: () => void;
}) {
  return (
    <div
      className="relative h-[862px] overflow-hidden rounded-lg border border-border sm:h-[662px]"
      aria-busy={loading}
    >
      <Table className="table-fixed">
        <TableHeader className="bg-muted">
          <TableRow className="h-10">
            <TableHead className="sm:w-[38%]">탐구활동</TableHead>
            <TableHead className="hidden sm:table-cell sm:w-[14%]">
              기재 영역
            </TableHead>
            <TableHead className="hidden sm:table-cell sm:w-[16%]">
              {showOthers ? '작성자' : '상태'}
            </TableHead>
            <TableHead className="hidden sm:table-cell sm:w-[18%]">
              수정일
            </TableHead>
            <TableHead className="w-24 text-right sm:w-[14%]">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b!">
          {loading ? (
            Array.from({ length: EXPLORATION_PAGE_SIZE }, (_, index) => (
              <TableRow key={index} className="h-[80px] sm:h-[60px]">
                {[0, 1, 2, 3, 4].map((column) => (
                  <TableCell
                    key={column}
                    className={
                      column > 0 && column < 4
                        ? 'hidden sm:table-cell'
                        : undefined
                    }
                  >
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error || !rows.length ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-[800px] sm:h-[600px]" />
            </TableRow>
          ) : (
            rows.map((activity) => {
              const editable = !activity.ownerId || activity.ownerId === userId;
              return (
                <TableRow
                  key={activity.clientKey}
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
                    onOpen(activity, event.currentTarget);
                  }}
                >
                  <TableCell className="py-2 sm:py-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="block w-full cursor-pointer truncate text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      title={explorationTitle(activity)}
                      onClick={(event) => onOpen(activity, event.currentTarget)}
                    >
                      {explorationTitle(activity)}
                    </button>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={explorationSummary(activity)}
                    >
                      {explorationSummary(activity)}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs sm:hidden">
                      {showOthers ? (
                        <span className="truncate text-muted-foreground">
                          {activity.ownerName || '이름 비공개'}
                        </span>
                      ) : (
                        <Status activity={activity} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="truncate">
                      {activity.values.recordArea || '—'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {activity.values.recordType}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {showOthers ? (
                      <span className="block truncate">
                        {activity.ownerName || '이름 비공개'}
                      </span>
                    ) : (
                      <Status activity={activity} />
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {activity.updatedAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={`${explorationTitle(activity)} ${editable ? '상세 · 수정' : '상세 보기'}`}
                        onClick={(event) =>
                          onOpen(activity, event.currentTarget)
                        }
                      >
                        {editable ? <Pencil /> : <Eye />}
                      </Button>
                      {editable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          aria-label={`${explorationTitle(activity)} 삭제`}
                          onClick={() => onDelete(activity)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {!loading && (!!error || !rows.length) && (
        <div className="absolute inset-x-0 top-10 bottom-0 flex items-center justify-center bg-background px-4 text-center">
          <div role="status" className="max-w-md space-y-3">
            <p className="font-semibold">
              {error
                ? '목록을 불러오지 못했습니다'
                : filtered
                  ? '검색 결과가 없습니다'
                  : drafts
                    ? '임시저장한 탐구활동이 없습니다'
                    : '등록된 탐구활동이 없습니다'}
            </p>
            <p className="text-sm text-muted-foreground">
              {error
                ? '잠시 후 다시 시도해 주세요.'
                : filtered
                  ? '검색어나 작성자 조건을 바꿔 보세요.'
                  : showOthers
                    ? '다른 작성자가 확정한 탐구활동이 여기에 표시됩니다.'
                    : '임시저장하거나 확정한 탐구활동이 여기에 표시됩니다.'}
            </p>
            {!!error && !drafts && (
              <Button type="button" variant="outline" onClick={onRetry}>
                다시 불러오기
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
