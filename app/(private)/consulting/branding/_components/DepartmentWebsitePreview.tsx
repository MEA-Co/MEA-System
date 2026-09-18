'use client';

import { ExternalLink, PanelsTopLeft } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function DepartmentWebsitePreview({
  department,
  url,
  previewSites,
}: {
  department: string;
  url: string;
  previewSites: { department: string; url: string }[];
}) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const preview = previewSites[selected] ?? previewSites[0];
  const externalLink = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-violet-500"
    >
      {department} 새 탭에서 보기{' '}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
  return (
    <div className="my-5 flex flex-wrap items-center gap-4">
      {preview && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="border-violet-200 text-violet-700 hover:bg-violet-50"
              />
            }
          >
            <PanelsTopLeft aria-hidden="true" /> 학과 홈페이지 살펴보기
          </DialogTrigger>
          <DialogContent className="h-[88dvh] grid-rows-[auto_minmax(0,1fr)] gap-4 rounded-2xl p-4 shadow-none sm:max-w-6xl sm:p-6">
            <DialogHeader className="pr-10">
              <DialogTitle className="leading-6">
                {preview.department}
              </DialogTitle>
              <DialogDescription>
                학교의 보안 설정에 따라 미리보기가 제한될 수 있어요. 사이트가
                보이지 않으면 다른 대학을 선택하거나 새 탭에서 열어주세요.
                등록된 학과 참고 사이트를 자유롭게 살펴보세요.
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="sr-only" htmlFor={selectId}>
                  미리보기 대학
                </label>
                <select
                  id={selectId}
                  value={selected}
                  onChange={(event) => setSelected(Number(event.target.value))}
                  className="max-w-full rounded-lg border border-violet-200 bg-white p-2 text-violet-800"
                >
                  {previewSites.map((site, index) => (
                    <option key={site.url} value={index}>
                      {site.department}
                    </option>
                  ))}
                </select>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-violet-700 underline underline-offset-4"
                >
                  새 탭에서 열기
                </a>
              </div>
            </DialogHeader>
            {open && (
              <iframe
                key={preview.url}
                src={preview.url}
                title={`${preview.department} 공식 홈페이지 미리보기`}
                className="h-full w-full rounded-xl border border-violet-100 bg-white"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
      {!preview && (
        <p className="text-sm text-slate-500">
          관련 미리보기 사이트를 찾지 못했어요. 출처 링크를 이용해주세요.
        </p>
      )}
      {externalLink}
    </div>
  );
}
