import { CloudUpload, Paperclip, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

import { type Activity } from '../lib/fields';

type Reports = NonNullable<Activity['reports']>;
const extensions = /\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$/i;

import { ExplorationFieldIcon } from './ExplorationFieldIcon';

export function ExplorationReportInput({
  reports,
  onChange,
}: {
  reports: Reports;
  onChange: (reports: Reports) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(files: File[]) {
    const accepted: Reports = [];
    for (const file of files) {
      if (!extensions.test(file.name) || file.size > 20 * 1024 * 1024) {
        toast.add({
          title: `${file.name}: PDF, HWP, DOC, PPT 계열의 20MB 이하 파일을 선택해 주세요.`,
          type: 'error',
        });
        continue;
      }
      if (
        [...reports, ...accepted].some(
          (item) =>
            item.file.name === file.name &&
            item.file.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
      )
        continue;
      accepted.push({ clientKey: crypto.randomUUID(), file });
    }
    onChange([...reports, ...accepted]);
  }

  return (
    <section
      aria-labelledby="activity-report-heading"
      className="space-y-4 rounded-2xl border p-5 md:p-6"
    >
      <h2
        id="activity-report-heading"
        className="flex items-center gap-2 text-base font-semibold text-foreground"
      >
        <ExplorationFieldIcon field="report" />
        <span>
          보고서 원문 제출{' '}
          <span className="text-sm font-normal text-muted-foreground">
            (선택)
          </span>
        </span>
      </h2>
      <p className="text-sm text-muted-foreground">
        학생 보고서 원문 파일을 첨부할 수 있습니다.
      </p>
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed p-5 ${dragging ? 'border-primary bg-muted' : 'bg-muted/50'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <CloudUpload aria-hidden="true" className="size-8 shrink-0" />
          <div className="space-y-1">
            <p>파일을 드래그하거나 파일 첨부 버튼을 눌러 첨부하세요.</p>
            <p>PDF, HWP, HWPX, DOC, DOCX, PPT, PPTX (파일당 최대 20MB)</p>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx"
          className="hidden"
          aria-label="보고서 원문 파일"
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden="true" />
          파일 첨부
        </Button>
      </div>
      {reports.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {reports.map(({ clientKey, file }) => (
            <li key={clientKey} className="flex items-center gap-3 p-3 text-sm">
              <Paperclip aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 break-all">
                {file.name}{' '}
                <span className="text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`${file.name} 첨부 삭제`}
                onClick={() =>
                  onChange(
                    reports.filter((report) => report.clientKey !== clientKey),
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
