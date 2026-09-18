'use client';

import { useState } from 'react';

import {
  coreChoiceStatuses,
  type PriorityProfile,
} from '@/features/subject-selection/recommendations';
import { scienceSequenceGaps } from '@/features/subject-selection/science-sequence';

import {
  buildStandardDraft,
  type StandardDraftTerm,
} from '../_lib/course-selection-draft';
import { sameCourse } from '../_lib/course-selection-utils';
import { allocatedCourses } from '../_lib/course-swap';
import type { ConfirmedCurriculum } from '../_lib/curriculum';
import { replaceDraftCourse } from '../_lib/draft-counseling';
import { evaluateMajorDepth } from '../_lib/major-depth';

import { StandardDraftPlan } from './_components/StandardDraftPlan';
import { CourseCounselingScreen } from './CourseCounselingScreen';

export function CombinedDraftCounselingScreen({
  curriculum,
  department,
  secondaryDepartment,
  profile,
  secondaryProfile,
  confirmedIds,
  initialTerms,
  onFinalize,
}: {
  curriculum: ConfirmedCurriculum;
  department: string;
  secondaryDepartment: string;
  profile: PriorityProfile;
  secondaryProfile: PriorityProfile;
  confirmedIds: string[];
  initialTerms: StandardDraftTerm[];
  onFinalize: (terms: StandardDraftTerm[]) => void;
}) {
  const [history, setHistory] = useState<StandardDraftTerm[][]>([initialTerms]);
  const terms = history[history.length - 1];
  const ids = (draft: StandardDraftTerm[]) =>
    draft.flatMap((term) =>
      term.recommendedCourses.map(({ course }) => course.id),
    );
  const recommendedIds = ids(terms);
  const removed = new Set(
    history.flatMap(ids).filter((id) => !recommendedIds.includes(id)),
  );
  const removedCourses = curriculum.terms.flatMap((term) =>
    term.selectionGroups.flatMap((group) =>
      group.courses.filter((course) => removed.has(course.id)),
    ),
  );
  const completed = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...recommendedIds,
  ]);
  const baseline = allocatedCourses(curriculum, [
    ...confirmedIds,
    ...ids(buildStandardDraft(curriculum, confirmedIds, profile)),
  ]);
  const depth = evaluateMajorDepth(
    profile,
    secondaryProfile,
    baseline,
    completed,
  );
  const missingCore = [profile, secondaryProfile].flatMap((policy) => [
    ...policy.core.filter(
      (name) => !completed.some((course) => sameCourse(course.name, name)),
    ),
    ...coreChoiceStatuses(policy, completed)
      .filter((rule) => !rule.satisfied)
      .map((rule) => rule.label),
  ]);
  const gaps = scienceSequenceGaps(completed);
  const prepared = !missingCore.length && !gaps.length && depth.supported;
  return (
    <div className="space-y-6">
      <div
        role="status"
        className={`border-l-4 p-4 text-sm ${prepared ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-amber-500 bg-amber-50 text-amber-900'}`}
      >
        <p className="font-semibold">
          {department} 우선 · {secondaryDepartment} 병행
        </p>
        <p className="mt-1">
          {prepared
            ? '현재 선택은 두 학과의 과목 준비 기준을 유지하고 있어요.'
            : '교체 후 두 학과의 준비 조건을 다시 확인해 주세요.'}
        </p>
        {!!missingCore.length && (
          <p className="mt-1">
            미확보 코어: {[...new Set(missingCore)].join(', ')}
          </p>
        )}
        {gaps.map((gap) => (
          <p key={gap.advanced}>
            {gap.advanced}의 기초 과목 {gap.basic}이 빠져 있어요.
          </p>
        ))}
        {!depth.supported && (
          <p className="mt-1">
            전공별 보완 과목 또는 기존 초안의 준비 깊이가 부족해졌어요. 교체를
            되돌리거나 다른 대안을 확인해 주세요.
          </p>
        )}
      </div>
      <StandardDraftPlan terms={terms} combined />
      <CourseCounselingScreen
        onFinalize={() => onFinalize(terms)}
        unfilledCount={terms.reduce((sum, term) => sum + term.unfilledCount, 0)}
        curriculum={curriculum}
        department={department}
        secondaryMajor={{ department: secondaryDepartment, profile: secondaryProfile }}
        profile={profile}
        draftLabel="복수 학과 지원형"
        confirmedIds={confirmedIds}
        recommendedIds={recommendedIds}
        removedCourses={removedCourses}
        onSwap={(fromId, toId, acknowledgeScience, source) => {
          const result = replaceDraftCourse(
            curriculum,
            confirmedIds,
            terms,
            fromId,
            toId,
            acknowledgeScience,
            source,
          );
          if (result.problem) return result.problem;
          setHistory((previous) => [...previous, result.terms]);
          return null;
        }}
        canUndo={history.length > 1}
        onUndo={() =>
          setHistory((previous) =>
            previous.length > 1 ? previous.slice(0, -1) : previous,
          )
        }
      />
    </div>
  );
}
