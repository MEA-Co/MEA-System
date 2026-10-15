import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function CollectionPagination({
  label,
  total,
  page,
  pages,
  loading,
  error,
  onPageChange,
}: {
  label: string;
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  error?: unknown;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-3 pt-4"
    >
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {loading
          ? '불러오는 중'
          : error
            ? '조회 실패'
            : `${total}개 · ${page} / ${pages} 페이지`}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="이전 페이지"
          disabled={loading || !!error || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="다음 페이지"
          disabled={loading || !!error || page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
