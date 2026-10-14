'use client';

import { ArrowLeft, Download, Eye, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import { CollectionTableState } from '@/components/patterns/collection-table-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useQuestionnaireResource } from '../../lib/questionnaire/api-client';
import {
  closeSubmittedResponse,
  openSubmittedResponse,
  SUBMITTED_RESPONSE_PARAM,
} from '../../lib/questionnaire/submitted-navigation';
import type { SubmittedResponse } from '../../lib/submitted-response-export';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';

const readOnly = () => {};
const submittedDate = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

export function SubmittedQuestionnaireResponses({
  questionnaireId,
}: {
  questionnaireId: string;
}) {
  const { data, error } = useQuestionnaireResource<SubmittedResponse[]>(
    `/${questionnaireId}/submitted-responses`,
  );
  const selectedId = useSearchParams().get(SUBMITTED_RESPONSE_PARAM);
  const downloading = useRef(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  async function download(items: SubmittedResponse[], archive: boolean) {
    if (downloading.current) return;
    downloading.current = true;
    setProgress('PDF 준비 중…');
    setDownloadError(null);
    try {
      const { downloadSubmissions } =
        await import('./export/download-submissions');
      await downloadSubmissions(items, archive, (done, total) =>
        setProgress(`PDF 생성 중 ${done} / ${total}`),
      );
    } catch {
      setDownloadError(
        'PDF를 다운로드하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      downloading.current = false;
      setProgress(null);
    }
  }
  const downloadStatus = (
    <>
      {downloadError && (
        <p role="alert" className="text-sm text-destructive">
          {downloadError}
        </p>
      )}
    </>
  );
  if (error) return <p role="alert">{error.message}</p>;
  if (!data) return <QuestionnaireLoading />;
  const selected = data.find((item) => item.id === selectedId);
  if (selected)
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={closeSubmittedResponse}>
            <ArrowLeft aria-hidden="true" /> 제출 목록으로
          </Button>
          <Button
            className="w-48"
            aria-busy={!!progress}
            disabled={!!progress}
            onClick={() => void download([selected], false)}
          >
            {progress ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Download aria-hidden="true" />
            )}
            <span aria-live="polite">{progress || 'PDF 다운로드'}</span>
          </Button>
        </div>
        {downloadStatus}
        <div className="space-y-2 rounded-lg border bg-background p-4 sm:p-5">
          <h2 className="text-lg font-semibold">
            {selected.respondentName || '이름 없음'}의 답변
          </h2>
          <p className="text-sm text-muted-foreground">
            {submittedDate.format(new Date(selected.submittedAt))} 최종 제출
          </p>
        </div>
        <QuestionnairePreview
          submittedView
          key={`${selected.id}:${selected.submittedAt}`}
          title={selected.title}
          sections={selected.sections}
          library={selected.questions.map((q) => q.definition)}
          response={{
            rows: Object.fromEntries(
              selected.questions.map((q) => [q.questionId, q.rows]),
            ),
            onChange: readOnly,
            disabled: true,
          }}
        />
      </div>
    );
  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            제출된 답변 <Badge variant="count">{data.length}</Badge>
          </h2>
          <Button
            className="w-48"
            aria-busy={!!progress}
            disabled={!data.length || !!progress}
            onClick={() => void download(data, true)}
          >
            {progress ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Download aria-hidden="true" />
            )}
            <span aria-live="polite">{progress || '전체 PDF 다운로드'}</span>
          </Button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          제출한 답변만 표시됩니다. 작성 중이거나 저장만 한 내용은 공개되지
          않습니다.
        </p>
      </div>
      {downloadStatus}
      <div className="overflow-hidden rounded-lg border bg-background">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="pl-4">응답자 · 제출일</TableHead>
              <TableHead className="w-16 pr-4 text-center">보기</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => openSubmittedResponse(item.id)}
              >
                <TableCell className="whitespace-normal py-4 pl-4">
                  <button
                    type="button"
                    className="max-w-full cursor-pointer text-left font-semibold wrap-anywhere hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={(event) => {
                      event.stopPropagation();
                      openSubmittedResponse(item.id);
                    }}
                  >
                    {item.respondentName || '이름 없음'}
                  </button>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {submittedDate.format(new Date(item.submittedAt))} 제출
                  </p>
                </TableCell>
                <TableCell className="pr-4 text-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${item.respondentName || '이름 없음'}의 답변 보기`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openSubmittedResponse(item.id);
                    }}
                  >
                    <Eye aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!data.length && (
              <CollectionTableState
                colSpan={2}
                title="아직 제출된 답변이 없습니다"
                description="응답자가 질문지를 제출하면 이곳에서 확인할 수 있습니다."
              />
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
