'use client';

import { Download } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { useQuestionnaireResource } from '../../lib/questionnaire/api-client';
import type { SubmittedResponse } from '../../lib/submitted-response-export';

import { QuestionnaireLoading } from './QuestionnaireLoading';
import { QuestionnairePreview } from './QuestionnairePreview';

const readOnly = () => {};

export function SubmittedQuestionnaireResponses({
  questionnaireId,
}: {
  questionnaireId: string;
}) {
  const { data, error } = useQuestionnaireResource<SubmittedResponse[]>(
    `/${questionnaireId}/submitted-responses`,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      {progress && (
        <p role="status" className="text-sm text-muted-foreground">
          {progress}
        </p>
      )}
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
        <Button variant="outline" onClick={() => setSelectedId(null)}>
          제출 목록으로
        </Button>
        <Button
          variant="outline"
          disabled={!!progress}
          onClick={() => void download([selected], false)}
        >
          <Download /> PDF 다운로드
        </Button>
        {downloadStatus}
        <div>
          <h2 className="text-lg font-semibold">
            {selected.respondentName || '이름 없음'}의 답변
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date(selected.submittedAt).toLocaleString('ko-KR')} 제출 ·
            마지막 제출 내용입니다.
          </p>
        </div>
        <QuestionnairePreview
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
      <p className="text-sm text-muted-foreground">
        제출한 답변만 표시됩니다. 작성 중이거나 저장만 한 내용은 공개되지
        않습니다.
      </p>
      <Button
        variant="outline"
        disabled={!data.length || !!progress}
        onClick={() => void download(data, true)}
      >
        <Download /> 사람별 PDF 일괄 다운로드
        {data.length ? ` (${data.length}명)` : ''}
      </Button>
      <p className="text-xs text-muted-foreground">
        사람마다 PDF 한 개를 만들어 ZIP 파일로 내려받습니다. 첨부한
        탐구활동·학습법의 상세 내용은 서비스에서 확인할 수 있습니다.
      </p>
      {downloadStatus}
      {data.length ? (
        <ul className="divide-y rounded-xl border bg-background">
          {data.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-muted/50"
                onClick={() => setSelectedId(item.id)}
              >
                <span className="font-medium">
                  {item.respondentName || '이름 없음'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {new Date(item.submittedAt).toLocaleString('ko-KR')} · 답변
                  보기
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          아직 제출된 답변이 없어요.
        </p>
      )}
    </section>
  );
}
