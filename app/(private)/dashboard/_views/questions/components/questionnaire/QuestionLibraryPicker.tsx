'use client';

import { CollectionPagination } from '@/components/patterns/collection-pagination';
import { Input } from '@/components/ui/input';

import { useQuestionLibraryList } from '../../hooks/useQuestionLibraryList';
import { QuestionManagementTable } from '../question/QuestionManagementTable';

export function QuestionLibraryPicker({
  placedIds,
  onAdd,
  error,
  loading,
  refresh,
}: {
  placedIds: Set<string>;
  onAdd: (id: string) => void;
  error?: string;
  loading: boolean;
  refresh: () => void;
}) {
  const list = useQuestionLibraryList();
  const pending = loading || list.loading || list.fetching;
  const failed = !!error || list.loadError;
  return (
    <section
      aria-label="질문 선택"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
    >
      <Input
        aria-label="저장된 질문 검색"
        placeholder="질문 이름이나 내용으로 검색"
        value={list.query}
        onChange={(event) => {
          list.setQuery(event.target.value);
          list.setPage(1);
        }}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <QuestionManagementTable
          questions={list.blocks}
          selection={{ addedIds: placedIds, disabled: pending || failed }}
          canManage={() => false}
          onArchive={() => {}}
          onOpen={(q) => onAdd(q.id)}
          loading={pending}
          error={failed}
          filtered={!!list.query.trim()}
          onRetry={() => { refresh(); void list.loadBlocks(); }}
        />
      </div>
      <CollectionPagination
        label="질문 선택 페이지"
        total={list.total}
        page={list.currentPage}
        pages={list.pageCount}
        loading={pending}
        error={failed}
        onPageChange={list.setPage}
      />
    </section>
  );
}
