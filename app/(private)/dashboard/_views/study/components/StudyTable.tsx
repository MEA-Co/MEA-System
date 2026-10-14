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
import { type Study, studyTitle } from '@/lib/study/fields';
import { matchesStudySearch, STUDY_PAGE_SIZE } from '@/lib/study/list-query';
import { fromRow, type StudyRow } from '@/lib/study/storage-model';

import { request } from '../lib/api-client';

type Page = {
  userId: string;
  activities: StudyRow[];
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
  local: Study[];
  ready: boolean;
  busy: boolean;
  localError: unknown;
  onOpen: (study: Study, opener: HTMLElement) => void;
  onDelete: (study: Study) => void;
};

export function StudyTable({
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
    .map((study) => `${study.clientKey}:${study.updatedAt}`)
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
    ['study-summary', userId, canViewOthers],
    () => request('/api/study?mode=summary'),
  );
  const params = new URLSearchParams({
    mode: 'table',
    scope,
    page: String(page),
    q: search,
    owner: scope === 'others' ? owner : '',
  });
  const localMatches = local
    .filter((study) => matchesStudySearch(study.values, search))
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.clientKey.localeCompare(b.clientKey),
    );
  const localState = JSON.stringify({
    ids: combined
      ? local
          .filter((study) => study.revision > 0)
          .map((study) => study.clientKey)
          .sort()
      : [],
    count: combined ? localMatches.length : 0,
  });
  const url = `/api/study?${params}`;
  const remote = useSWR<Page>(
    !drafts && ready
      ? ['study-page', userId, canViewOthers, url, localState]
      : null,
    () => request(url, { method: 'POST', body: localState }),
  );
  const total = drafts ? localMatches.length : (remote.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / STUDY_PAGE_SIZE));
  const currentPage = drafts
    ? Math.min(page, pages)
    : (remote.data?.page ?? page);
  const rows = drafts
    ? localMatches.slice(
        (currentPage - 1) * STUDY_PAGE_SIZE,
        currentPage * STUDY_PAGE_SIZE,
      )
    : [
        ...(combined
          ? localMatches.slice(
              (currentPage - 1) * STUDY_PAGE_SIZE,
              currentPage * STUDY_PAGE_SIZE,
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
          aria-label="학습법 검색"
          placeholder="과목, 문제 상황, 학습 전략 검색"
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
              aria-label="학습법 작성자 필터"
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
              aria-label="학습법 저장 상태"
            >
              <SelectValue>
                {drafts
                  ? `임시저장 (${local.length})`
                  : status === 'all'
                    ? '전체 학습법'
                    : '확정된 학습법'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 학습법</SelectItem>
              <SelectItem value="confirmed">확정된 학습법</SelectItem>
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
      <StudyTableRows
        rows={rows}
        loading={loading}
        error={error}
        total={total}
        userId={userId}
        showOthers={scope === 'others'}
        busy={busy}
        onOpen={onOpen}
        onDelete={onDelete}
        onRetry={() => void remote.mutate()}
        query={search}
        owner={scope === 'others' ? owner : ''}
        drafts={drafts}
      />
      <CollectionPagination
        label="학습법 페이지"
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
        aria-label="학습법 구분"
      >
        <TabsTrigger value="own" className="min-w-0 px-3 sm:flex-none sm:px-4">
          내 학습법{' '}
          <Badge variant="count">
            {summary.data
              ? summary.data.mine +
                local.filter((study) => study.revision === 0).length
              : '—'}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          value="others"
          className="min-w-0 px-3 sm:flex-none sm:px-4"
          aria-label="다른 사람의 학습법"
        >
          <span className="sm:hidden">다른 사람</span>
          <span className="hidden sm:inline">다른 사람의 학습법</span>
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

export function StudyTableRows({
  rows,
  loading,
  error,
  userId,
  showOthers,
  busy,
  onOpen,
  onDelete,
  onRetry,
  query,
  owner,
  drafts,
}: {
  rows: Study[];
  loading: boolean;
  error: unknown;
  total: number;
  userId: string;
  showOthers: boolean;
  busy: boolean;
  onOpen: Props['onOpen'];
  onDelete: Props['onDelete'];
  onRetry: () => void;
  query: string;
  owner: string;
  drafts: boolean;
}) {
  return (
    <div
      className="relative h-[862px] overflow-hidden rounded-lg border border-border sm:h-[662px]"
      aria-busy={loading}
    >
      <Table className="table-fixed">
        <TableHeader className="bg-muted">
          <TableRow className="h-10">
            <TableHead className="sm:w-[38%]">학습법</TableHead>
            <TableHead className="hidden sm:table-cell sm:w-[14%]">
              교과
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
            Array.from({ length: STUDY_PAGE_SIZE }, (_, index) => (
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
              <TableCell
                colSpan={5}
                className="h-[800px] text-center sm:h-[600px]"
              ></TableCell>
            </TableRow>
          ) : (
            rows.map((study) => {
              const editable = !study.ownerId || study.ownerId === userId;
              const target = study;
              return (
                <TableRow
                  key={study.clientKey}
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
                    onOpen(target, event.currentTarget);
                  }}
                >
                  <TableCell className="py-2 sm:py-3">
                    <button
                      type="button"
                      className="block w-full cursor-pointer truncate text-left font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                      disabled={busy}
                      title={studyTitle(study.values)}
                      onClick={(event) => onOpen(target, event.currentTarget)}
                    >
                      {studyTitle(study.values)}
                    </button>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={study.values.problem}
                    >
                      {study.values.problem || '기본 정보 미입력'}
                    </p>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs sm:hidden">
                      <span className="truncate text-muted-foreground">
                        {study.values.subject || '교과 미입력'}
                      </span>
                      {showOthers ? (
                        <span className="truncate text-muted-foreground">
                          {study.ownerName || '이름 비공개'}
                        </span>
                      ) : (
                        <Badge
                          variant={
                            target.status === 'draft' ? 'highlight' : 'subtle'
                          }
                          className="shrink-0 text-[10px]"
                        >
                          {target.status === 'draft'
                            ? target.revision > 0
                              ? '수정 중 · 임시저장'
                              : '임시저장'
                            : '확정'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="truncate">
                      {study.values.subject || '—'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {study.values.customSubject}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {showOthers ? (
                      <span className="block truncate">
                        {study.ownerName || '이름 비공개'}
                      </span>
                    ) : (
                      <Badge
                        variant={
                          target.status === 'draft' ? 'highlight' : 'subtle'
                        }
                      >
                        {target.status === 'draft'
                          ? target.revision > 0
                            ? '수정 중 · 임시저장'
                            : '임시저장'
                          : '확정'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {study.updatedAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={`${studyTitle(study.values)} ${editable ? '상세 · 수정' : '상세 보기'}`}
                        onClick={(event) => onOpen(target, event.currentTarget)}
                      >
                        {editable ? <Pencil /> : <Eye />}
                      </Button>
                      {editable && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          aria-label={`${studyTitle(study.values)} 삭제`}
                          onClick={() => onDelete(target)}
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
                : query || owner
                  ? '검색 결과가 없습니다'
                  : drafts
                    ? '임시저장한 학습법이 없습니다'
                    : '등록된 학습법이 없습니다'}
            </p>
            <p className="text-sm text-muted-foreground">
              {error
                ? '잠시 후 다시 시도해 주세요.'
                : query || owner
                  ? '검색어나 작성자 조건을 바꿔 보세요.'
                  : drafts
                    ? '작성 중 임시저장한 학습법이 여기에 표시됩니다.'
                    : '임시저장하거나 확정한 학습법이 여기에 표시됩니다.'}
            </p>
            {!!error && !drafts && (
              <Button variant="outline" onClick={onRetry}>
                다시 불러오기
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
