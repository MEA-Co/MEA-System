'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

import { linkRequest } from '../lib/link-api';

import type { LinkSkillset } from './ExplorationLinkGraph';

export function ExplorationLinkSkillPicker({
  userId,
  local,
  onSelect,
}: {
  userId: string;
  local: LinkSkillset[];
  onSelect: (skill: LinkSkillset) => void;
}) {
  const [scope, setScope] = useState(local.length ? 'current' : 'saved');
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
  const url = `/api/exploration-links/skills?q=${encodeURIComponent(search)}&page=${page}`;
  const { data, error, isLoading, mutate } = useSWR(
    scope === 'saved' ? ['link-skills', userId, url] : null,
    () => linkRequest<{ items: LinkSkillset[]; total: number }>(url),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      keepPreviousData: true,
    },
  );
  const localMatches = local.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const loading = search !== query.trim() || (scope === 'saved' && isLoading);
  const failure = scope === 'saved' ? error : undefined;
  const total = scope === 'current' ? localMatches.length : (data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 10));
  const current = scope === 'current' ? Math.min(page, pages) : page;
  const rows =
    scope === 'current'
      ? localMatches.slice((current - 1) * 10, current * 10)
      : (data?.items ?? []).map((s) => local.find((l) => l.id === s.id) ?? s);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2">
        <Input
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="스킬 이름으로 검색"
          aria-label="연계 스킬 검색"
          className="min-w-0 flex-1"
        />
        <Select
          value={scope}
          onValueChange={(value) => {
            if (value) {
              setScope(value);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-40 shrink-0" aria-label="연계 스킬 범위">
            <SelectValue>
              {scope === 'current' ? '현재 탐구줄기' : '내가 확정한 스킬'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">현재 탐구줄기</SelectItem>
            <SelectItem value="saved">내가 확정한 스킬</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-y-auto rounded-lg border"
        aria-busy={loading}
      >
        <Table className="table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="h-10">
              <TableHead>스킬 이름</TableHead>
              <TableHead className="w-16 text-right">선택</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows.length
              ? Array.from({ length: 5 }, (_, index) => (
                  <TableRow key={index} className="h-12">
                    <TableCell>
                      <Skeleton className="h-4 w-2/3" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto size-7" />
                    </TableCell>
                  </TableRow>
                ))
              : !failure &&
                rows.map((skill) => (
                  <TableRow
                    key={skill.id}
                    className={`h-12 cursor-pointer ${loading ? 'opacity-50' : ''}`}
                    onClick={(event) => {
                      if (
                        !loading &&
                        !(event.target as HTMLElement).closest('button')
                      )
                        onSelect(skill);
                    }}
                  >
                    <TableCell>
                      <button
                        type="button"
                        disabled={loading}
                        className="block w-full cursor-pointer truncate text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        title={skill.name}
                        onClick={() => onSelect(skill)}
                      >
                        {skill.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={loading}
                        aria-label={`${skill.name} 선택`}
                        onClick={() => onSelect(skill)}
                      >
                        <Plus />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {loading && (
          <span className="sr-only" role="status">
            연계 스킬을 불러오는 중입니다
          </span>
        )}
        {!loading && (failure || !rows.length) && (
          <div
            className="absolute inset-x-0 bottom-0 top-10 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground"
            role={failure ? 'alert' : 'status'}
          >
            <p>
              {failure
                ? failure.message
                : search
                  ? '검색 결과가 없습니다.'
                  : '등록된 스킬이 없습니다.'}
            </p>
            {failure && (
              <Button variant="outline" onClick={() => void mutate()}>
                다시 시도
              </Button>
            )}
          </div>
        )}
      </div>
      <CollectionPagination
        label="연계 스킬 페이지"
        total={total}
        page={current}
        pages={pages}
        loading={loading}
        error={failure}
        onPageChange={setPage}
      />
      <p className="text-xs text-muted-foreground">
        저장된 스킬을 수정하고 확정하면 같은 스킬을 참조하는 다른 탐구줄기에도
        반영됩니다.
      </p>
    </div>
  );
}
