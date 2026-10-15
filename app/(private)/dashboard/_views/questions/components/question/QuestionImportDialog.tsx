'use client';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { CollectionPagination } from '@/components/patterns/collection-pagination';
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

import { useQuestionLibraryList } from '../../hooks/useQuestionLibraryList';
import { type QuestionBlockRow, questionName } from '../../lib/question-blocks';
import { richTextPlainText } from '../../lib/rich-text';

export function QuestionImportDialog({
  onClose,
  onImport,
  hasChanges,
}: {
  onClose: () => void;
  onImport: (source: QuestionBlockRow) => void;
  hasChanges: boolean;
}) {
  const list = useQuestionLibraryList();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function importSelected() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/questions/${selected}`, {
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok || !result.block)
        throw new Error(result.error ?? '질문을 불러오지 못했어요.');
      onImport(result.block);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '질문을 불러오지 못했어요.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        nested
        showCloseButton={!busy}
        className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>다른 질문 내용 가져오기</DialogTitle>
          <DialogDescription>
            질문 내용·설명·답변 설정을 새 질문으로 복사합니다. 답변, 검토 요청,
            다른 질문과의 연결은 가져오지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="불러올 질문 검색"
          placeholder="질문 검색"
          value={list.query}
          disabled={busy}
          onChange={(event) => {
            list.setQuery(event.target.value);
            list.setPage(1);
            setSelected(null);
          }}
        />
        <div
          className="h-72 overflow-y-auto overscroll-contain rounded-xl border"
          aria-label="불러올 질문 목록"
        >
          {list.loadError ? (
            <div className="p-4" role="alert">
              질문 목록을 불러오지 못했어요.{' '}
              <Button variant="ghost" onClick={() => void list.loadBlocks()}>
                다시 시도
              </Button>
            </div>
          ) : list.loading || list.fetching ? (
            <div className="space-y-3 p-4" aria-label="질문 목록 로딩">
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : list.blocks.length ? (
            list.blocks.map((question) => (
              <button
                type="button"
                key={question.id}
                disabled={busy || question.purpose === 'study_registration'}
                aria-pressed={selected === question.id}
                onClick={() => setSelected(question.id)}
                className={`block w-full border-b p-4 text-left last:border-0 hover:bg-muted/50 disabled:opacity-50 ${selected === question.id ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-300' : 'bg-background'}`}
              >
                <span className="block truncate font-semibold">
                  {questionName(question)}
                </span>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {richTextPlainText(question.prompt)}
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              불러올 질문이 없습니다.
            </p>
          )}
        </div>
        <CollectionPagination
          label="다른 질문 내용 가져오기 페이지"
          total={list.total}
          page={list.currentPage}
          pages={list.pageCount}
          loading={list.loading || list.fetching || busy}
          error={list.loadError}
          onPageChange={(page) => {
            list.setPage(page);
            setSelected(null);
          }}
        />
        {hasChanges && (
          <p className="text-sm text-muted-foreground">
            불러오면 현재 작성 중인 내용이 선택한 질문 내용으로 바뀝니다.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={
              !selected ||
              busy ||
              list.loading ||
              list.fetching ||
              list.loadError
            }
            onClick={() => void importSelected()}
          >
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? '불러오는 중…' : '불러오기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
