'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { careerFlowPlaceholder } from '../../lib/career-flow-placeholders';
import type { QuestionBlockDocument } from '../../lib/question-blocks';

export function CareerFlowExampleTable({
  document,
}: {
  document: QuestionBlockDocument;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        작성 예시 보기
      </DialogTrigger>
      <DialogContent className="flex h-[94dvh] w-[96vw] max-w-none flex-col gap-4 rounded-2xl bg-neutral-100 p-4 sm:max-w-none sm:p-6 dark:bg-neutral-950">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>{document.title || '진로 흐름'} · 작성 예시</DialogTitle>
          <DialogDescription>
            모든 시기의 작성 예시입니다. 예시는 실제 답변에 입력되거나 저장되지
            않습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-background">
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
            style={{ minWidth: 240 + document.fields.length * 280 }}
          >
            <caption className="sr-only">진로 흐름 전체 시기 작성 예시</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 w-60 border-r border-b bg-muted p-4"
                >
                  항목
                </th>
                {document.fields.map((field) => (
                  <th
                    key={field.id}
                    scope="col"
                    className="sticky top-0 z-20 w-70 border-r border-b bg-muted p-4"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {document.rowLabels?.map((label, index) => (
                <tr key={`${index}-${label}`}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-b bg-background p-4 align-top font-medium"
                  >
                    {label}
                    {index >= 3 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        (선택)
                      </span>
                    )}
                  </th>
                  {document.fields.map((field) => (
                    <td
                      key={field.id}
                      className="border-r border-b p-4 align-top whitespace-pre-wrap [overflow-wrap:anywhere]"
                    >
                      <div className="min-h-28">
                        {careerFlowPlaceholder(
                          document.id,
                          label,
                          field.id,
                        ) || <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 justify-end">
          <DialogClose render={<Button type="button" />}>닫기</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
