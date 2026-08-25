'use client';

import {
  BookOpen,
  BrainCircuit,
  Compass,
  FileText,
  Layers3,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { isMaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import { exampleMaterialBoxReport as report } from '@/app/(private)/consulting/material-box/_screens/report/example-report';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

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
          <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950 md:text-2xl">
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

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-950/5"
      aria-label="가상 페르소나 기반 재료함 컨설팅 리포트 예시"
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
              MATERIAL BOX CONSULTING REPORT
            </p>
            <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
              가상 페르소나 예시
            </span>
          </div>

          <h1 className="mt-8 max-w-4xl text-2xl font-bold leading-tight tracking-[-0.035em] text-white md:text-4xl md:leading-tight">
            {report.oneLineBrand}
          </h1>

          <div className="mt-9 grid gap-5 border-t border-white/15 pt-5 sm:grid-cols-[1fr_2fr]">
            <div>
              <p className="text-xs font-medium text-slate-400">페르소나</p>
              <p className="mt-1.5 font-semibold text-white">
                {report.persona.name} · 고1
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">
                핵심 교집합 키워드
              </p>
              <p className="mt-1.5 font-semibold text-white">
                {report.intersectionKeyword}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="px-5 py-8 md:px-9 md:py-10">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.16em] text-blue-600">
              00 · PERSONA SNAPSHOT
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] md:text-2xl">
              출발점이 되는 학생의 모습
            </h2>
          </div>
        </div>

        <p className="mt-6 text-sm leading-7 text-slate-600 md:text-base">
          {report.persona.description}
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {report.persona.majors.map((major, index) => (
            <div
              key={major}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-xs font-bold text-blue-600">
                {index + 1}순위 전공
              </p>
              <p className="mt-2 font-bold text-slate-900">{major}</p>
            </div>
          ))}
        </div>
      </section>

      <ReportSection
        number="01"
        eyebrow="FIELD KEYWORD MAP"
        title="전공별 세부 분야와 교집합"
        icon={<Compass className="size-5" aria-hidden="true" />}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {report.fieldMap.map((field) => (
            <article
              key={field.major}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-950">{field.major}</h3>
                <span className="text-[0.65rem] font-bold text-slate-400">
                  {field.source}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {field.coreKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                {field.discovery}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white md:p-6">
          <p className="text-xs font-bold tracking-[0.14em] text-blue-300">
            INTERSECTION
          </p>
          <p className="mt-2 text-lg font-bold leading-7">
            {report.intersectionKeyword}
          </p>
        </div>
      </ReportSection>

      <ReportSection
        number="02"
        eyebrow="MAJOR STORYTELLING"
        title="희망 분야 스토리텔링"
        icon={<Layers3 className="size-5" aria-hidden="true" />}
      >
        <div className="space-y-3">
          {report.majorStory.map((story, index) => (
            <div
              key={story}
              className="flex gap-4 rounded-2xl bg-slate-50 p-4 md:p-5"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600 shadow-sm">
                {index + 1}
              </span>
              <p className="text-sm leading-7 text-slate-600">{story}</p>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection
        number="03"
        eyebrow="CORE VALUE"
        title="전공 가치관"
        icon={<Target className="size-5" aria-hidden="true" />}
      >
        <blockquote className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-lg font-bold leading-8 text-slate-950 md:p-6 md:text-xl">
          “{report.coreValue.statement}”
        </blockquote>
        <p className="mt-5 text-sm leading-7 text-slate-600">
          {report.coreValue.explanation}
        </p>

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
        number="04"
        eyebrow="COMPETENCY"
        title="가치를 실행하는 세 가지 역량"
        icon={<BrainCircuit className="size-5" aria-hidden="true" />}
      >
        <div className="grid gap-4 lg:grid-cols-3">
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
          <p className="text-xs font-bold tracking-[0.16em]">ONE-LINE BRAND</p>
        </div>
        <h2 className="mt-4 max-w-4xl text-2xl font-bold leading-10 tracking-[-0.03em] md:text-3xl md:leading-12">
          {report.oneLineBrand}
        </h2>
      </section>

      <ReportSection
        number="05"
        eyebrow="SCHOOL RECORD STRATEGY"
        title="생기부 전반 전략"
        icon={<Route className="size-5" aria-hidden="true" />}
      >
        <div className="space-y-3">
          {report.schoolRecordStrategy.map((strategy, index) => (
            <div
              key={strategy.title}
              className="grid gap-2 rounded-2xl border border-slate-200 p-4 md:grid-cols-[2rem_13rem_1fr] md:items-start md:gap-4 md:p-5"
            >
              <span className="text-sm font-bold text-blue-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-bold leading-6 text-slate-900">
                {strategy.title}
              </h3>
              <p className="text-sm leading-6 text-slate-600">
                {strategy.description}
              </p>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection
        number="06"
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
        number="07"
        eyebrow="PROJECT DIRECTIONS"
        title="브랜드 기반 장기 탐구 주제"
        icon={<Compass className="size-5" aria-hidden="true" />}
      >
        <div className="space-y-4">
          {report.projects.map((project, index) => (
            <article
              key={project.title}
              className="rounded-2xl border border-slate-200 p-5 md:p-6"
            >
              <div className="flex items-start gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-slate-950">{project.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {project.question}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {project.sequence.map((step, stepIndex) => (
                  <span
                    key={step}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    {stepIndex + 1}. {step}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </ReportSection>

      <ReportSection
        number="08"
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
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
