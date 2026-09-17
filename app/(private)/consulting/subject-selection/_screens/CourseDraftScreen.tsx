'use client';

import { Building2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type PriorityProfile } from '@/features/subject-selection/recommendations';
import {
  scienceSequenceGaps,
  scienceSequenceMessage,
} from '@/features/subject-selection/science-sequence';

import type { ConfirmedAdjustment } from '../_lib/confirmed-adjustment';
import { removedCourseIds } from '../_lib/counseling-question';
import { buildStandardDraft } from '../_lib/course-selection-draft';
import { swapProblem } from '../_lib/course-swap';
import type { ConfirmedCurriculum } from '../_lib/curriculum';

import { StandardDraftPlan } from './_components/StandardDraftPlan';
import { CombinedMajorScreen } from './CombinedMajorScreen';
import { CourseCounselingScreen } from './CourseCounselingScreen';

export type DraftTypeId = 'standard' | 'story' | 'combined-major';

const draftTypes: Array<{
  id: DraftTypeId;
  label: string;
  title: string;
  description: string;
  draftDescription: string;
}> = [
  {
    id: 'standard',
    label: '유형 1',
    title: '전공 기본형',
    description: '희망 전공에 지원할 때 일반적으로 선택하는 과목 흐름입니다.',
    draftDescription:
      '전공과 직접 연결되는 과목을 우선으로 남은 선택군을 채우는 초안입니다.',
  },
  {
    id: 'story',
    label: '유형 2',
    title: '스토리 반영형',
    description:
      '학생의 관심 주제, 강점 과목, 탐구 방향을 반영하는 흐름입니다.',
    draftDescription:
      '학생의 이야기와 전공 관심사를 연결해 남은 선택군을 설계하는 초안입니다.',
  },
  {
    id: 'combined-major',
    label: '유형 3',
    title: '복수 학과 지원형',
    description:
      '함께 고민 중인 다른 학과까지 고려해 과목의 폭을 남기는 흐름입니다.',
    draftDescription:
      '희망 전공과 함께 탐색하는 학과의 공통 기반을 남은 선택군에 반영하는 초안입니다.',
  },
];

export function CourseDraftScreen({
  schoolName,
  department,
  curriculum,
  profile,
  confirmedCourseIds,
  onAdjustConfirmed,
}: {
  schoolName: string;
  department: string;
  curriculum: ConfirmedCurriculum;
  profile: PriorityProfile | null;
  confirmedCourseIds: string[];
  onAdjustConfirmed: (proposal: ConfirmedAdjustment) => string | null;
}) {
  const [selectedDraftId, setSelectedDraftId] = useState<DraftTypeId | null>(
    null,
  );
  const [replacementHistory, setReplacementHistory] = useState<
    Record<string, string>[]
  >([{}]);
  const replacements = replacementHistory[replacementHistory.length - 1];
  const removedIds = removedCourseIds(replacementHistory);
  const removedCourses = curriculum.terms.flatMap((term) =>
    term.selectionGroups.flatMap((group) =>
      group.courses.filter((course) => removedIds.has(course.id)),
    ),
  );
  const selectedDraft = draftTypes.find(
    (draft) => draft.id === selectedDraftId,
  );
  const standardDraft = useMemo(
    () =>
      buildStandardDraft(curriculum, confirmedCourseIds, profile, replacements),
    [confirmedCourseIds, curriculum, profile, replacements],
  );
  const recommendedIds = standardDraft.flatMap((term) =>
    term.recommendedCourses.map(({ course }) => course.id),
  );
  function swap(fromId: string, toId: string, acknowledgeScience = false) {
    const problem = swapProblem(
      curriculum,
      confirmedCourseIds,
      recommendedIds,
      fromId,
      toId,
      acknowledgeScience,
    );
    if (problem) return problem;
    const originalId =
      Object.keys(replacements).find((id) => replacements[id] === fromId) ??
      fromId;
    setReplacementHistory((history) => [
      ...history,
      { ...replacements, [originalId]: toId },
    ]);
    return null;
  }
  const scienceGaps = scienceSequenceGaps([
    ...curriculum.priorRequiredCourses,
    ...standardDraft.flatMap((term) => [
      ...term.requiredCourses,
      ...term.confirmedCourses.map((item) => item.course),
      ...term.recommendedCourses.map((item) => item.course),
    ]),
  ]);

  return (
    <section className="w-full min-w-0 space-y-8">
      <header className="border-b pb-5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" aria-hidden="true" />
          {schoolName}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">희망 전공</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{department}</h1>
          <Badge variant="secondary">필수 조건 확정</Badge>
        </div>
      </header>

      {!selectedDraft ? (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">2단계 · 과목 선택</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                확정된 필수 과목을 유지하고, 남은 선택군을 어떤 기준으로 채울지
                골라주세요.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              1단계 확정 {confirmedCourseIds.length}과목
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {draftTypes.map((draft) => {
              const available = draft.id !== 'story';
              return (
                <button
                  key={draft.id}
                  type="button"
                  disabled={!available}
                  className="group min-h-52 border p-5 text-left transition-colors enabled:hover:border-emerald-400 enabled:hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setSelectedDraftId(draft.id)}
                >
                  <Badge
                    variant="outline"
                    className="border-emerald-200 text-emerald-800"
                  >
                    {draft.label}
                  </Badge>
                  {!available ? (
                    <Badge
                      variant="outline"
                      className="ml-2 text-muted-foreground"
                    >
                      준비 중
                    </Badge>
                  ) : null}
                  <h3 className="mt-4 text-base font-semibold group-hover:text-emerald-800">
                    {draft.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {draft.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <section className="border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge
                  variant="outline"
                  className="border-emerald-200 text-emerald-800"
                >
                  {selectedDraft.label}
                </Badge>
                <h2 className="mt-3 text-lg font-semibold">
                  {selectedDraft.title} 초안
                </h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelectedDraftId(null)}
              >
                유형 다시 고르기
              </Button>
            </div>
            {selectedDraft.id === 'standard' ? (
              <>
                {scienceGaps.length ? (
                  <p
                    role="status"
                    className="mt-4 border-l-2 border-amber-400 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                  >
                    {scienceSequenceMessage(scienceGaps)} 기초 과목을 먼저 듣는
                    것을 추천해요. 초안의 과목 조합과 학교의 실제 이수 순서를
                    확인해 주세요.
                  </p>
                ) : null}
                <StandardDraftPlan terms={standardDraft} />
              </>
            ) : selectedDraft.id === 'combined-major' ? (
              <CombinedMajorScreen
                curriculum={curriculum}
                department={department}
                profile={profile}
                confirmedIds={confirmedCourseIds}
                recommendedIds={recommendedIds}
                onViewStandard={() => setSelectedDraftId('standard')}
                onApplyAdjustment={(proposal) => {
                  const problem = onAdjustConfirmed(proposal);
                  if (problem) return problem;
                  setReplacementHistory([{}]);
                  return null;
                }}
              />
            ) : (
              <div className="mt-5 border-l-2 border-emerald-500 pl-4">
                <p className="text-sm font-medium">초안 준비 중</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {selectedDraft.draftDescription}
                </p>
              </div>
            )}
          </section>

          {selectedDraft.id === 'standard' && (
            <CourseCounselingScreen
              curriculum={curriculum}
              department={department}
              profile={profile}
              confirmedIds={confirmedCourseIds}
              recommendedIds={recommendedIds}
              removedCourses={removedCourses}
              onSwap={swap}
              canUndo={replacementHistory.length > 1}
              onUndo={() =>
                setReplacementHistory((history) =>
                  history.length > 1 ? history.slice(0, -1) : history,
                )
              }
            />
          )}
        </>
      )}

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        유형 2는 준비 중이며, 유형 3은 검토용 초안입니다.
      </p>
    </section>
  );
}
