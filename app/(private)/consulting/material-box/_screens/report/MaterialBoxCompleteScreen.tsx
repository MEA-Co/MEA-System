'use client';

import {
  BookOpen,
  BrainCircuit,
  Compass,
  Download,
  ExternalLink,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useState } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { isMaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import { createMaterialBoxExampleReportRequest } from '@/app/(private)/consulting/material-box/_report/content';
import { exampleMaterialBoxReport as engineeringReport } from '@/app/(private)/consulting/material-box/_screens/report/example-report';
import { humanitiesExampleMaterialBoxReport as humanitiesReport } from '@/app/(private)/consulting/material-box/_screens/report/humanities-example-report';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';
import { downloadConsultingReport } from '@/features/consulting/report/client';

type MaterialBoxReportType = 'engineering' | 'humanities';

function ReportSection({
  number,
  eyebrow,
  title,
  icon,
  children,
}: {
  number: string;
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 px-5 py-8 md:px-9 md:py-10">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          {icon}
        </span>
        <div>
          <p className="text-[0.68rem] font-bold tracking-[0.16em] text-blue-600">
            {number} · {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 md:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MaterialBoxExampleReport() {
  const shouldReduceMotion = useReducedMotion();
  const [reportType, setReportType] = useState<'engineering' | 'humanities'>(
    'engineering',
  );
  const [downloadingReport, setDownloadingReport] =
    useState<MaterialBoxReportType | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const report =
    reportType === 'engineering' ? engineeringReport : humanitiesReport;

  const handlePdfDownload = async (type: MaterialBoxReportType) => {
    setDownloadError(null);
    setDownloadingReport(type);

    try {
      const selectedReport =
        type === 'engineering' ? engineeringReport : humanitiesReport;
      await downloadConsultingReport(
        createMaterialBoxExampleReportRequest(selectedReport),
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : 'PDF를 만드는 중 문제가 발생했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setDownloadingReport(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.12em] text-slate-500">
          예시 리포트 선택
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
            role="group"
            aria-label="예시 리포트 계열 선택"
          >
            <button
              type="button"
              aria-pressed={reportType === 'engineering'}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                reportType === 'engineering'
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
              onClick={() => setReportType('engineering')}
            >
              공학계열 학생
            </button>
            <button
              type="button"
              aria-pressed={reportType === 'humanities'}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                reportType === 'humanities'
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
              onClick={() => setReportType('humanities')}
            >
              인문계열 학생
            </button>
          </div>

          <button
            type="button"
            disabled={downloadingReport !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-55"
            onClick={() => handlePdfDownload('engineering')}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {downloadingReport === 'engineering'
              ? 'PDF 생성 중'
              : '공학계열 PDF'}
          </button>
          <button
            type="button"
            disabled={downloadingReport !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-55"
            onClick={() => handlePdfDownload('humanities')}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {downloadingReport === 'humanities'
              ? 'PDF 생성 중'
              : '인문계열 PDF'}
          </button>
        </div>
      </div>

      {downloadError ? (
        <p
          className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {downloadError}
        </p>
      ) : null}

      <motion.article
        key={reportType}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-950/5"
        aria-label={`${report.persona.name} 학생 생활기록부 브랜딩 컨설팅 재료함 설계 리포트`}
      >
        <header className="relative overflow-hidden bg-slate-950 px-6 py-9 text-white md:px-10 md:py-12">
          <div
            className="absolute -top-24 -right-20 size-64 rounded-full border border-blue-300/20"
            aria-hidden="true"
          />
          <div
            className="absolute -top-6 -right-8 size-40 rounded-full bg-blue-500/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold tracking-[0.18em] text-blue-300">
                MEA · CONSULTING REPORT
              </p>
            </div>

            <h1 className="mt-8 max-w-4xl text-2xl font-bold leading-tight tracking-[-0.035em] text-white md:text-4xl md:leading-tight">
              생활기록부 브랜딩 컨설팅 [재료함 설계]
            </h1>

            <div className="mt-9 grid gap-5 border-t border-white/15 pt-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-400">학생 이름</p>
                <p className="mt-1.5 font-semibold text-white">
                  {report.persona.name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">학년</p>
                <p className="mt-1.5 font-semibold text-white">
                  {report.persona.grade}
                </p>
              </div>
            </div>
          </div>
        </header>

        <ReportSection
          number="01"
          eyebrow="KEYWORDS"
          title="전공 세부 분야 키워드"
          icon={<Compass className="size-5" aria-hidden="true" />}
        >
          <div className="mt-5 space-y-5">
            {report.fieldMap.map((field) => (
              <article
                key={field.major}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="border-b border-slate-200 bg-slate-50 p-5 md:flex md:items-start md:justify-between md:gap-8">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                      {field.rank}
                    </span>
                    <div>
                      <p className="text-[0.65rem] font-bold tracking-[0.12em] text-blue-600">
                        {field.rank}순위 희망 전공
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-slate-950">
                        {field.major}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2">
                  <div className="p-5 md:border-r md:border-slate-200">
                    <p className="text-xs font-bold text-blue-600">
                      01 · 시스템의 탐색 지원
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {field.systemSupport.sources.map((source) => (
                        <a
                          key={source.href}
                          href={source.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[0.68rem] font-semibold text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          {source.label}
                          <ExternalLink
                            className="size-2.5 shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {field.systemSupport.summary}
                    </p>
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[0.65rem] font-bold tracking-wide text-slate-400">
                        탐색한 후보
                      </p>
                      <p className="mt-1.5 text-xs leading-5 text-slate-600">
                        {field.systemSupport.candidates.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 p-5 md:border-t-0">
                    <p className="text-xs font-bold text-blue-600">
                      02 · 멘토의 전공 조언
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                        {field.mentor.name.slice(0, 1)}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {field.mentor.name} 멘토
                        </p>
                        <p className="mt-0.5 text-[0.68rem] font-medium text-slate-500">
                          {field.mentor.affiliation}
                        </p>
                      </div>
                    </div>
                    <blockquote className="mt-4 border-l-2 border-blue-200 pl-3 text-sm leading-6 text-slate-600">
                      “{field.mentor.advice}”
                    </blockquote>
                  </div>

                  <div className="border-t border-slate-200 bg-blue-50/50 p-5 md:col-span-2">
                    <p className="text-xs font-bold text-blue-700">
                      03 · 학생의 최종 선택
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {field.selectedKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 md:p-6 mt-6">
            <p className="text-xs font-bold tracking-[0.12em] text-blue-600">
              스토리텔링
            </p>
            <h3 className="mt-3 text-lg font-bold leading-8 text-slate-950 md:text-xl">
              {report.majorStory.differentiator}
            </h3>
            <p className="mt-4 border-t border-blue-100 pt-4 text-sm leading-7 text-slate-600">
              {report.majorStory.explanation}
            </p>
          </div>
        </ReportSection>

        <ReportSection
          number="02"
          eyebrow="CORE VALUE"
          title="전공 가치관"
          icon={<Target className="size-5" aria-hidden="true" />}
        >
          <p className="text-xs font-bold tracking-[0.12em] text-slate-500">
            내가 선택한 멘토의 조언
          </p>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
            {report.coreValue.mentorAdvice.map((mentorAdvice) => (
              <article
                key={`${mentorAdvice.affiliation}-${mentorAdvice.name}`}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                    {mentorAdvice.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {mentorAdvice.name} 멘토
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">
                      {mentorAdvice.affiliation}
                    </p>
                  </div>
                </div>
                <blockquote className="mt-3 border-l-2 border-slate-200 pl-3 text-xs leading-6 text-slate-600">
                  “{mentorAdvice.advice}”
                </blockquote>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-bold tracking-[0.12em] text-blue-600">
              나만의 전공 가치관
            </p>
            <blockquote className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-lg font-bold leading-8 text-slate-950 md:p-6 md:text-xl">
              “{report.coreValue.statement}”
            </blockquote>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {report.coreValue.guidingQuestions.map(([question, answer]) => (
              <div
                key={question}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <p className="text-xs font-bold text-blue-600">{question}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                  {answer}
                </p>
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection
          number="03"
          eyebrow="COMPETENCY"
          title="계열 적합 역량"
          icon={<BrainCircuit className="size-5" aria-hidden="true" />}
        >
          <div className="mt-4 grid gap-4 ">
            {report.competencyMentorAdvice.map((mentorAdvice) => (
              <article
                key={`${mentorAdvice.affiliation}-${mentorAdvice.name}`}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {mentorAdvice.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {mentorAdvice.name} 멘토
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-500">
                      {mentorAdvice.affiliation}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[0.65rem] font-bold tracking-wide text-blue-600">
                    좋게 평가받았다고 생각하는 역량
                  </p>
                  <h3 className="mt-1.5 text-sm font-bold leading-6 text-slate-900">
                    {mentorAdvice.strength}
                  </h3>
                </div>

                <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <div>
                    <dt className="text-[0.65rem] font-bold text-slate-400">
                      과목
                    </dt>
                    <dd className="mt-1 text-xs font-semibold text-slate-700">
                      {mentorAdvice.course}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.65rem] font-bold text-slate-400">
                      방법
                    </dt>
                    <dd className="mt-1 text-xs leading-5 text-slate-600">
                      {mentorAdvice.method}
                    </dd>
                  </div>
                </dl>

                <blockquote className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  “{mentorAdvice.reflection}”
                </blockquote>
              </article>
            ))}
          </div>

          <p className="mt-7 text-xs font-bold tracking-[0.12em] text-blue-600">
            나만의 역량
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {report.competencies.map((competency, index) => (
              <article
                key={competency.type}
                className="rounded-2xl border border-slate-200 p-5"
              >
                <span className="text-xs font-bold text-blue-600">
                  0{index + 1} · {competency.type}
                </span>
                <h3 className="mt-3 font-bold leading-6 text-slate-950">
                  {competency.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {competency.content}
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-[0.65rem] font-bold tracking-wide text-slate-400">
                    EVIDENCE
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {competency.evidence}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </ReportSection>

        <section className="border-t border-slate-200 bg-blue-600 px-6 py-9 text-white md:px-10 md:py-11">
          <div className="flex items-center gap-2 text-blue-100">
            <Sparkles className="size-4" aria-hidden="true" />
            <p className="text-xs font-bold tracking-[0.16em]">
              BRANDING · ONE-LINE BRAND
            </p>
          </div>
          <h2 className="mt-4 max-w-4xl text-2xl font-bold leading-10 tracking-[-0.03em] md:text-3xl md:leading-12">
            {report.oneLineBrand}
          </h2>
        </section>

        <ReportSection
          number="01"
          eyebrow="SCHOOL RECORD STRATEGY"
          title="생기부 전반 전략"
          icon={<Route className="size-5" aria-hidden="true" />}
        >
          <div className="space-y-3">
            {report.schoolRecordStrategy.map((strategy, index) => (
              <article
                key={strategy.title}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[2rem_15rem_1fr] md:items-start md:gap-4 md:p-5"
              >
                <span className="text-sm font-bold text-blue-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-bold leading-6 text-slate-900">
                    {strategy.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {strategy.basis.map((basis) => (
                      <span
                        key={basis}
                        className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.65rem] font-semibold text-blue-700"
                      >
                        {basis}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  {strategy.description}
                </p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection
          number="02"
          eyebrow="SUPPORTING VALUES"
          title="브랜드를 구체화하는 보조 가치"
          icon={<Sparkles className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {report.supportingValues.map((item) => (
              <article
                key={item.value}
                className={`rounded-2xl border p-5 ${
                  item.role === '선택'
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-950">{item.value}</h3>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-bold text-blue-600 shadow-sm">
                    {item.role}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </ReportSection>

        <ReportSection
          number="03"
          eyebrow="PROJECT"
          title="브랜드 기반 장기 탐구 주제"
          icon={<Compass className="size-5" aria-hidden="true" />}
        >
          <div className="rounded-2xl bg-slate-950 p-5 text-white md:p-6">
            <p className="text-xs font-bold tracking-[0.14em] text-blue-300">
              최종 탐구 목표
            </p>
            <h3 className="mt-3 text-lg font-bold leading-8 md:text-xl">
              {report.projectRoadmap.finalGoal}
            </h3>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-4">
              {report.projectRoadmap.basis.map((basis) => (
                <span
                  key={basis}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"
                >
                  {basis}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {report.projectRoadmap.steps.map((project, index) => (
              <div key={project.title}>
                <article
                  className={`rounded-2xl border p-5 md:p-6 ${
                    project.stage === '최종 탐구'
                      ? 'border-blue-200 bg-blue-50/60'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        project.stage === '최종 탐구'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-950 text-white'
                      }`}
                    >
                      {project.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-600">
                        {project.stage}
                      </p>
                      <h3 className="mt-1.5 font-bold leading-6 text-slate-950">
                        {project.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {project.question}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-4 md:ml-13">
                    <p className="text-[0.65rem] font-bold tracking-wide text-slate-400">
                      이 탐구에서 확보할 것
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">
                      {project.deliverable}
                    </p>
                  </div>
                </article>

                {index < report.projectRoadmap.steps.length - 1 && (
                  <div className="flex items-center gap-3 py-3 pl-4 text-xs font-semibold text-slate-500">
                    <span
                      className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-blue-600"
                      aria-hidden="true"
                    >
                      ↓
                    </span>
                    이 탐구를 위하여
                  </div>
                )}
              </div>
            ))}
          </div>
        </ReportSection>

        <ReportSection
          number="04"
          eyebrow="COURSE STRATEGY"
          title="브랜드 기반 선택과목 후보"
          icon={<BookOpen className="size-5" aria-hidden="true" />}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {report.courses.map((course) => (
              <div
                key={course.course}
                className="rounded-2xl border border-slate-200 p-4 md:p-5"
              >
                <h3 className="font-bold text-slate-950">{course.course}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {course.reason}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            실제 개설 과목과 선택 가능 여부는 학교 교육과정 편성표를 기준으로
            확인합니다.
          </p>
        </ReportSection>
      </motion.article>
    </div>
  );
}

function MaterialBoxCompleteScreen() {
  return (
    <ConsultingScreenView>
      <MaterialBoxExampleReport />
      <ConsultingPrompter
        animateTyping
        message={{
          segments: [
            {
              text: '좋습니다! 진로의 모습, 중요 가치, 분야 역량, 평소의 장점이 어떻게 하나의 브랜드와 생기부 전략으로 이어지는지 리포트 예시로 정리했습니다.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

export const materialBoxCompleteScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxProgressScreenData,
  render: () => <MaterialBoxCompleteScreen />,
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
