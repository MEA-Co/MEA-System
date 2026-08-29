import {
  BookOpen,
  BrainCircuit,
  Compass,
  ExternalLink,
  MessageSquareText,
  School,
  Sparkles,
  Target,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import { createExplorationReportSections } from '@/app/(private)/consulting/material-box/_report/exploration';

function SimpleReportSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 px-5 py-7 md:px-8 md:py-8">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-blue-700">
          {number}
        </span>
        <h2 className="text-lg font-bold tracking-tight text-slate-950 md:text-xl">
          {title}
        </h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MaterialBoxSimpleReport({
  data,
}: {
  data: MaterialBoxProgressScreenData;
}) {
  const explorationSections = createExplorationReportSections(data);
  const strengths = [
    {
      label: '순수 계열 적합 역량',
      value: data.fieldStrength,
      icon: <Compass className="size-4" aria-hidden="true" />,
    },
    {
      label: '전공 계열 적합 역량',
      value: data.majorFieldStrength,
      icon: <BrainCircuit className="size-4" aria-hidden="true" />,
    },
    {
      label: '차별화 역량',
      value: data.personalStrength,
      icon: <Sparkles className="size-4" aria-hidden="true" />,
    },
  ];

  return (
    <article
      className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-xl shadow-slate-950/5"
      aria-label="상담 과정에서 완성한 나의 재료함 리포트"
    >
      <header className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white md:px-9 md:py-10">
        <div
          className="absolute -top-24 -right-16 size-64 rounded-full bg-blue-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-300">
            MEA
          </p>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.03em] md:text-3xl">
            나의 재료함
          </h1>
        </div>
      </header>

      <SimpleReportSection number="01" title="전공별 세부 키워드">
        <div className="space-y-4">
          {data.majorKeywords.map((entry, index) => (
            <article
              key={`${entry.major}-${index}`}
              className="overflow-hidden rounded-2xl border border-slate-200"
            >
              <div className="grid gap-4 bg-slate-50 p-4 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center md:p-5">
                <div>
                  <p className="text-[0.65rem] font-bold tracking-[0.12em] text-blue-600">
                    {index + 1}순위 희망 전공
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-950">
                    {entry.major}
                  </h3>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[0.65rem] font-bold tracking-wide text-slate-400">
                    최종 작성 키워드
                  </p>
                  <p className="mt-1.5 text-sm font-bold leading-6 text-slate-900">
                    {entry.keyword}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 p-4 md:p-5">
                <p className="text-xs font-bold text-blue-700">
                  {entry.explorationState
                    ? '탐구 대화로 정리한 키워드'
                    : 'MEA의 추천 키워드'}
                </p>
                {entry.selectedSuggestions.length > 0 ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {entry.selectedSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.keyword}
                        className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"
                      >
                        <span className="inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                          {suggestion.keyword}
                        </span>
                        <p className="mt-2.5 text-xs leading-5 text-slate-600">
                          {suggestion.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                          {suggestion.links.map((link) => (
                            <a
                              key={`${suggestion.keyword}-${link.type}-${link.url}`}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                            >
                              {link.title}
                              <ExternalLink
                                className="size-2.5 shrink-0"
                                aria-hidden="true"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {entry.explorationState
                      ? '전공 탐구 코치와의 대화에서 출발해 학생이 확인하고 수정한 키워드입니다.'
                      : '추천 항목을 선택하지 않고 직접 작성한 키워드입니다.'}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </SimpleReportSection>

      {explorationSections.length > 0 && (
        <SimpleReportSection number="02" title="전공 탐구 대화 결과">
          <div className="space-y-6">
            {explorationSections.map(({ state, goalStatement, profileItems }) => (
              <article
                key={state.department}
                className="overflow-hidden rounded-2xl border border-slate-200"
              >
                <div className="bg-slate-50 p-5">
                  <p className="text-[0.65rem] font-bold tracking-[0.12em] text-blue-600">
                    GENERAL DEPARTMENT OVERVIEW
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    {state.department}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {state.departmentMap?.overview}
                  </p>
                </div>

                {state.departmentMap && (
                  <div className="border-t border-slate-200 p-5">
                    <div className="flex items-center gap-2 text-blue-700">
                      <BookOpen aria-hidden="true" className="size-4" />
                      <p className="text-xs font-bold">일반적인 주요 분야</p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {state.departmentMap.fields.map((field) => (
                        <div
                          key={field.fieldName}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="text-sm font-bold text-slate-900">
                            {field.fieldName}
                          </p>
                          <p className="mt-1.5 text-xs leading-5 text-slate-600">
                            {field.explanation}
                          </p>
                          <p className="mt-2 text-[0.68rem] leading-5 text-blue-700">
                            {field.keywords
                              .map((item) => item.keyword)
                              .join(' · ')}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-blue-700">
                        <School aria-hidden="true" className="size-4" />
                        <p className="text-xs font-bold">학교 맥락의 연결 예시</p>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
                        {state.departmentMap.schoolContextExamples.map(
                          (example) => (
                            <li key={example}>• {example}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 p-5">
                  <div className="rounded-xl bg-slate-950 p-4 text-white">
                    <p className="text-[0.65rem] font-bold tracking-wide text-blue-300">
                      최종 탐구 목표
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-7">
                      {goalStatement}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {profileItems.map(({ title, trait }) => (
                      <div
                        key={title}
                        className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"
                      >
                        <p className="text-[0.65rem] font-bold text-blue-700">
                          {title}
                        </p>
                        <p className="mt-1.5 text-sm font-bold text-slate-900">
                          {trait.label}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {trait.description}
                        </p>
                        <p className="mt-2 border-t border-blue-100 pt-2 text-[0.68rem] leading-5 text-slate-500">
                          근거 · {trait.evidence}
                        </p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-4 rounded-xl border border-slate-200 p-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-900">
                      <MessageSquareText
                        aria-hidden="true"
                        className="size-4 text-blue-700"
                      />
                      학생과 탐구 코치의 전체 대화
                    </summary>
                    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                      {state.conversation.map((turn, index) => (
                        <div
                          key={`${turn.role}-${index}`}
                          className="grid gap-1 md:grid-cols-[4rem_minmax(0,1fr)]"
                        >
                          <p className="text-[0.68rem] font-bold text-blue-700">
                            {turn.role === 'student' ? '학생' : '탐구 코치'}
                          </p>
                          <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">
                            {turn.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        </SimpleReportSection>
      )}

      <SimpleReportSection
        number={explorationSections.length > 0 ? '03' : '02'}
        title="나의 탐구 방향"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center gap-2 text-blue-700">
              <Sparkles className="size-4" aria-hidden="true" />
              <p className="text-xs font-bold tracking-widest">학생 스토리</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-900">
              {data.studentStory ?? '아직 저장된 학생 스토리가 없습니다.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-blue-700">
              <Target className="size-4" aria-hidden="true" />
              <p className="text-xs font-bold tracking-widest">전공 가치관</p>
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-900">
              {data.coreValue ?? '아직 저장된 전공 가치관이 없습니다.'}
            </p>
          </div>
        </div>
      </SimpleReportSection>

      <SimpleReportSection
        number={explorationSections.length > 0 ? '04' : '03'}
        title="나의 계열 적합 역량"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {strengths.map((strength) => (
            <div
              key={strength.label}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex items-center gap-2 text-blue-700">
                {strength.icon}
                <p className="text-xs font-bold">{strength.label}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {strength.value ?? '아직 저장된 역량이 없습니다.'}
              </p>
            </div>
          ))}
        </div>
      </SimpleReportSection>
    </article>
  );
}
