'use client';

import {
  ArrowUpRight,
  Check,
  Download,
  FileText,
  LoaderCircle,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { MaterialBoxMemory } from '@/features/material-box-consulting/model/types';
import {
  createMaterialBoxReport,
  formatMaterialBoxReportDate,
  materialBoxReportFileName,
} from '@/features/material-box-consulting/report/content';

type MaterialBoxReportScreenProps = {
  memory: MaterialBoxMemory;
};

type DownloadStatus = 'idle' | 'loading' | 'error';

export function MaterialBoxReportScreen({
  memory,
}: MaterialBoxReportScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const report = createMaterialBoxReport(memory);
  const issuedDate = formatMaterialBoxReportDate(new Date());
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');

  const downloadPdf = async () => {
    if (downloadStatus === 'loading') return;

    setDownloadStatus('loading');

    try {
      const response = await fetch('/api/consulting/material-box/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memory),
      });

      if (!response.ok) {
        throw new Error('PDF 생성에 실패했습니다.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = materialBoxReportFileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setDownloadStatus('idle');
    } catch {
      setDownloadStatus('error');
    }
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="mx-auto w-full max-w-5xl pt-2 pb-56 md:pt-4 md:pb-48"
    >
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border bg-background/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">컨설팅 리포트가 완성됐어요</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              화면에서 확인하거나 PDF로 보관할 수 있습니다.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          disabled={downloadStatus === 'loading'}
          onClick={downloadPdf}
          className="rounded-xl px-5"
        >
          {downloadStatus === 'loading' ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          {downloadStatus === 'loading' ? 'PDF 만드는 중' : 'PDF 다운로드'}
        </Button>
      </div>

      {downloadStatus === 'error' && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-950/5">
        <section className="relative overflow-hidden bg-slate-950 px-6 py-9 text-white md:px-10 md:py-12">
          <div
            className="absolute -top-20 -right-20 size-56 rounded-full border border-blue-300/20"
            aria-hidden="true"
          />
          <div
            className="absolute -top-8 -right-8 size-32 rounded-full bg-blue-500/15 blur-2xl"
            aria-hidden="true"
          />

          <div className="relative flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-blue-300">
                FINAL CONSULTING REPORT
              </p>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-[-0.035em] text-white md:text-5xl">
                {report.careerIdentity}
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base">
                관심 분야에서 출발해 완성한 나만의 진로 브랜드 방향
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold tracking-[0.2em] text-white">
              MEA
            </span>
          </div>

          <div className="relative mt-10 grid gap-5 border-t border-white/15 pt-5 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-400">
                핵심 세부 키워드
              </p>
              <p className="mt-1.5 font-semibold text-white">
                {report.keyword}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium text-slate-400">
                리포트 발행일
              </p>
              <p className="mt-1.5 font-semibold text-white">{issuedDate}</p>
            </div>
          </div>
        </section>

        <div className="px-5 py-7 md:px-10 md:py-10">
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                진로 브랜드 한눈에 보기
              </h2>
              <p className="hidden text-xs font-semibold tracking-[0.12em] text-slate-400 sm:block">
                BRAND SNAPSHOT
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold tracking-wide text-blue-600">
                  희망 전공
                </p>
                <div className="mt-3 space-y-2">
                  {report.majors.map((major, index) => (
                    <p
                      key={`${major}-${index}`}
                      className="flex items-start gap-2 text-sm font-semibold text-slate-800"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[0.65rem] text-blue-600 shadow-sm">
                        {index + 1}
                      </span>
                      {major}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold tracking-wide text-blue-600">
                  세부 키워드
                </p>
                <p className="mt-3 text-base font-bold leading-6 text-slate-900">
                  {report.keyword}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-bold tracking-wide text-blue-600">
                  진로 명칭
                </p>
                <p className="mt-3 text-base font-bold leading-6 text-slate-900">
                  {report.careerIdentity}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                나의 진로 브랜딩 재료
              </h2>
              <p className="hidden text-xs font-semibold tracking-[0.12em] text-slate-400 sm:block">
                MATERIAL ANALYSIS
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {report.sections.map((section) => (
                <div
                  key={section.number}
                  className="rounded-2xl border border-slate-200 p-5 md:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-sm font-bold text-blue-600">
                      {section.number}
                    </span>
                    <div>
                      <p className="text-[0.65rem] font-bold tracking-[0.13em] text-slate-400">
                        {section.eyebrow}
                      </p>
                      <h3 className="mt-1 text-base font-bold text-slate-950">
                        {section.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-blue-50 p-6 md:p-8">
            <p className="text-xs font-bold tracking-[0.15em] text-blue-600">
              CONSULTANT SUMMARY
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
              컨설턴트 종합 의견
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-700 md:text-base md:leading-8">
              {report.consultantSummary}
            </p>
          </section>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                다음 활동 설계 가이드
              </h2>
              <p className="hidden text-xs font-semibold tracking-[0.12em] text-slate-400 sm:block">
                NEXT ACTIONS
              </p>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {report.nextSteps.map((step) => (
                <div
                  key={step.number}
                  className="group rounded-2xl border border-slate-200 p-5 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                      {step.number}
                    </span>
                    <ArrowUpRight
                      className="size-4 text-slate-300 transition-colors group-hover:text-blue-500"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-5 font-bold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <footer className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2">
              <Check className="size-3.5 text-blue-600" aria-hidden="true" />
              생활기록부 브랜딩 컨설팅 · 재료함 설계 완료
            </p>
            <p className="font-bold tracking-[0.16em] text-slate-700">MEA</p>
          </footer>
        </div>
      </article>
    </motion.div>
  );
}
