'use client';

import { Eye, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Study, studySummary, studyTitle } from '@/lib/study/fields';
import { fromRow } from '@/lib/study/storage-model';

import { useStudyList } from '../hooks/useStudyList';

export function StudySelectList({
  busy,
  onSelect,
  onOpen,
  onCreate,
}: {
  busy: boolean;
  onSelect: (study: Study) => void;
  onOpen: (study: Study, opener: HTMLElement) => void;
  onCreate: (opener: HTMLElement) => void;
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
  const { data, error, isLoading, mutate } = useStudyList(
    'own',
    true,
    undefined,
    { query: search, page },
  );
  const loading = isLoading || search !== query.trim();
  const current = data?.page ?? page;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));
  return (
    <div className="space-y-3">
      <Input
        value={query}
        maxLength={200}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="학습법 검색"
        placeholder="학습법 검색"
      />
      {error ? (
        <div role="alert">
          학습법을 불러오지 못했어요.{' '}
          <Button variant="outline" onClick={() => void mutate()}>
            다시 시도
          </Button>
        </div>
      ) : loading ? (
        <p role="status">불러오는 중이에요.</p>
      ) : (
        <ul className="divide-y">
          {data?.activities.map((row) => {
            const study = fromRow(row);
            return (
              <li key={row.id} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  className="min-w-0 flex-1 cursor-pointer rounded-lg px-3 py-3 text-left hover:bg-accent"
                  onClick={() => onSelect(study)}
                >
                  <span className="block truncate font-medium">
                    {studyTitle(study.values)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {studySummary(study.values)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={`${studyTitle(study.values)} 상세 보기`}
                  onClick={(event) => onOpen(study, event.currentTarget)}
                >
                  <Eye />
                </Button>
              </li>
            );
          })}
          {!data?.activities.length && (
            <li className="p-3 text-sm text-muted-foreground">
              {search ? '검색 결과가 없어요.' : '첨부할 확정 학습법이 없어요.'}
            </li>
          )}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          disabled={busy}
          onClick={(event) => onCreate(event.currentTarget)}
        >
          <Plus />
          학습법 추가
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !!error || current <= 1}
            onClick={() => setPage(current - 1)}
          >
            이전
          </Button>
          <span className="text-xs">
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
      </div>
    </div>
  );
}
