'use client';
import { useEffect, useMemo, useState } from 'react';

import {
  courseMatchesSchoolRequirement,
  schoolCourseRequirements,
} from '@/features/subject-selection/graduation';
import {
  coreChoiceStatuses,
  findPriorityProfile,
  findUniversityMatches,
  PRIORITY_PROFILES,
} from '@/features/subject-selection/recommendations';
import {
  scienceSequenceGaps,
  scienceSequenceMessage,
} from '@/features/subject-selection/science-sequence';

import {
  courseCredit,
  courseDescriptor,
  type CourseOccurrence,
  getCourseTags,
  graduationAreaForCourse,
  graduationAreaRequirements,
  sameCourse,
} from '../_lib/course-selection-utils';
import type { ConfirmedCurriculum } from '../_lib/curriculum';
import type {
  CareerGuideStep,
  RequiredStage as Stage,
  RequirementGuideStep,
  SelectionSnapshot as Snapshot,
  StageIntro,
} from '../_lib/session-types';
const departments = [
  ...new Set(PRIORITY_PROFILES.flatMap((profile) => profile.departments)),
].sort((a, b) => a.localeCompare(b, 'ko'));

import {
  type ConfirmedAdjustment,
  validateConfirmedAdjustment,
} from '../_lib/confirmed-adjustment';

export function useCourseSelectionSession(
  curriculum: ConfirmedCurriculum,
  onRequiredConfirmed?: () => void,
) {
  const [input, setInput] = useState('');
  const [department, setDepartment] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'core' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [notice, setNotice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [universityOpen, setUniversityOpen] = useState(true);
  const [guideStep, setGuideStep] = useState<CareerGuideStep | null>(null);
  const [stageIntro, setStageIntro] = useState<StageIntro>(null);
  const [requirementGuideStep, setRequirementGuideStep] =
    useState<RequirementGuideStep | null>(null);
  const profile = useMemo(
    () =>
      department ? (findPriorityProfile(department)?.profile ?? null) : null,
    [department],
  );
  const universities = useMemo(
    () =>
      department ? findUniversityMatches(department, profile?.id ?? null) : [],
    [department, profile?.id],
  );
  const guideSteps: CareerGuideStep[] = [
    'purpose',
    ...(profile?.subCore.length ? ['subcore' as const] : []),
    ...(universities.length ? ['university' as const] : []),
    'capacity',
  ];
  useEffect(() => {
    if (!stageIntro) return;
    document
      .getElementById('required-stage-intro')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [stageIntro]);

  function finishStageIntro() {
    if (stageIntro === 'career') setGuideStep('purpose');
    if (stageIntro === 'requirement') setRequirementGuideStep('credits');
    setStageIntro(null);
  }
  useEffect(() => {
    if (stage.kind !== 'career' || !guideStep) return;
    document
      .getElementById(`career-guide-${guideStep}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [stage.kind, guideStep]);

  function moveGuide(next: CareerGuideStep | null) {
    if (next === 'university') setUniversityOpen(true);
    setGuideStep(next);
  }
  const occurrences = useMemo<CourseOccurrence[]>(
    () =>
      curriculum.terms.flatMap((term) => [
        ...term.requiredCourses.map((course) => ({
          term,
          course,
          group: null,
          required: true,
        })),
        ...term.selectionGroups.flatMap((group) =>
          group.courses.map((course) => ({
            term,
            course,
            group,
            required: false,
          })),
        ),
      ]),
    [curriculum],
  );
  const completed = useMemo(
    () => [
      ...curriculum.priorRequiredCourses,
      ...occurrences
        .filter((item) => item.required || selected.has(item.course.id))
        .map((item) => item.course),
    ],
    [curriculum.priorRequiredCourses, occurrences, selected],
  );
  const coreNames = profile?.core ?? [];
  const coreChoices = coreChoiceStatuses(profile, completed);
  const missingCoreChoices = coreChoices.some((rule) => !rule.satisfied);
  const scienceGaps = scienceSequenceGaps(completed);
  const missingCore = coreNames.filter(
    (name) => !completed.some((course) => sameCourse(name, course.name)),
  );
  const unavailableCore = missingCore.filter(
    (name) => !occurrences.some((item) => sameCourse(name, item.course.name)),
  );
  const schoolRequirements = useMemo(
    () => schoolCourseRequirements(curriculum.linkedRules),
    [curriculum.linkedRules],
  );
  const requirements = [
    ...graduationAreaRequirements.map((requirement) => {
      const matches = (item: CourseOccurrence) =>
        graduationAreaForCourse(item.course) === requirement.id;
      const current = completed
        .filter((course) => graduationAreaForCourse(course) === requirement.id)
        .reduce((sum, course) => sum + (courseCredit(course) ?? 0), 0);
      return {
        id: requirement.id,
        label: requirement.label,
        current,
        minimum: requirement.minimumCredit,
        unit: '학점',
        matches,
      };
    }),
    ...schoolRequirements.map((requirement) => {
      const matches = (item: CourseOccurrence) =>
        (requirement.grade === null ||
          item.term.id ===
            `grade-${requirement.grade}-semester-${requirement.semester}`) &&
        courseMatchesSchoolRequirement(
          courseDescriptor(item.course),
          requirement,
        );
      return {
        id: requirement.id,
        label: requirement.label,
        current: occurrences.filter(
          (item) =>
            (item.required || selected.has(item.course.id)) && matches(item),
        ).length,
        minimum: requirement.minimumCourses,
        unit: '과목',
        matches,
      };
    }),
  ];
  const unmet = requirements.filter((item) => item.current < item.minimum);
  const activeRequirement =
    stage.kind === 'requirement'
      ? requirements.find((item) => item.id === stage.id)
      : undefined;
  const isCore = (item: CourseOccurrence) =>
    coreNames.some((name) => sameCourse(name, item.course.name));
  const candidates = occurrences.filter((item) => {
    if (item.required || locked.has(item.course.id)) return false;
    if (
      curriculum.priorRequiredCourses.some((course) =>
        sameCourse(course.name, item.course.name),
      ) ||
      occurrences.some(
        (other) =>
          other.required && sameCourse(other.course.name, item.course.name),
      )
    )
      return false;
    if (stage.kind === 'core')
      return (
        isCore(item) ||
        coreChoices.some((rule) =>
          rule.courses.some((name) => sameCourse(name, item.course.name)),
        )
      );
    if (stage.kind === 'career')
      return (
        scienceGaps.some((gap) => sameCourse(gap.basic, item.course.name)) ||
        (!isCore(item) &&
          getCourseTags(item.course, profile, universities).some((tag) =>
            ['sub-core', 'internal', 'university-core', 'university'].includes(
              tag.kind,
            ),
          ))
      );
    if (stage.kind === 'requirement') return activeRequirement?.matches(item);
    return false;
  });
  const remaining = activeRequirement
    ? Math.max(0, activeRequirement.minimum - activeRequirement.current)
    : 0;
  const candidateCredits = candidates
    .filter((item) => !selected.has(item.course.id))
    .map((item) => courseCredit(item.course));
  const uniformCredit =
    candidateCredits.length > 0 &&
    candidateCredits.every(
      (credit) =>
        credit !== null && credit > 0 && credit === candidateCredits[0],
    )
      ? candidateCredits[0]
      : null;
  const neededCount =
    activeRequirement?.unit === '과목'
      ? remaining
      : uniformCredit
        ? Math.ceil(remaining / uniformCredit)
        : null;

  const requirementGuideSteps: RequirementGuideStep[] = [
    'credits',
    'courses',
    ...(candidates.some((item) => item.term.id === 'grade-3-semester-2')
      ? ['late-term' as const]
      : []),
  ];
  useEffect(() => {
    if (stage.kind !== 'requirement' || !requirementGuideStep) return;
    document
      .getElementById(
        `requirement-guide-${requirementGuideStep === 'late-term' ? 'courses' : requirementGuideStep}`,
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: requirementGuideStep === 'credits' ? 'center' : 'start',
      });
  }, [stage, requirementGuideStep]);

  function infoCourse(name: string) {
    return (
      occurrences.find((item) => sameCourse(item.course.name, name))?.course ??
      curriculum.priorRequiredCourses.find((course) =>
        sameCourse(course.name, name),
      ) ?? { id: name, name, credit: null, domain: null, description: null }
    );
  }

  function applyDepartment() {
    if (!input.trim()) return;
    const nextProfile = findPriorityProfile(input.trim())?.profile;
    const next = new Set<string>();
    for (const name of nextProfile?.core ?? []) {
      if (
        curriculum.priorRequiredCourses.some((course) =>
          sameCourse(course.name, name),
        )
      )
        continue;
      const matches = occurrences.filter((item) =>
        sameCourse(item.course.name, name),
      );
      if (matches.some((item) => item.required)) continue;
      if (matches.length === 1) {
        const item = matches[0];
        if (
          item.group &&
          item.group.courses.filter((course) => next.has(course.id)).length <
            item.group.choose
        )
          next.add(item.course.id);
      }
    }
    setGuideStep(null);
    setRequirementGuideStep(null);
    setUniversityOpen(true);
    setDepartment(input.trim());
    setStageIntro('core');
    setSelected(next);
    setLocked(new Set());
    setHistory([]);
    setStage({ kind: 'core' });
    setNotice('');
  }

  function disabledReason(item: CourseOccurrence) {
    if (item.required) return '학교지정 · 고정';
    if (locked.has(item.course.id)) return '이전 단계 확정 · 고정';
    if (
      selected.has(item.course.id) &&
      isCore(item) &&
      occurrences.filter((other) =>
        sameCourse(other.course.name, item.course.name),
      ).length === 1
    )
      return '필수 코어 · 자동 확정';
    if (selected.has(item.course.id)) return '';
    if (
      occurrences.some(
        (other) =>
          locked.has(other.course.id) &&
          sameCourse(other.course.name, item.course.name),
      )
    )
      return '다른 학기에 확정한 과목';
    if (
      item.group &&
      item.group.courses.filter(
        (course) =>
          selected.has(course.id) && !sameCourse(course.name, item.course.name),
      ).length >= item.group.choose
    )
      return '선택군 정원 충족';
    return '';
  }

  function toggle(item: CourseOccurrence) {
    if (disabledReason(item)) return;
    if (selected.has(item.course.id)) {
      const newGaps = scienceSequenceGaps(
        completed.filter((course) => course.id !== item.course.id),
      ).filter(
        (gap) =>
          !scienceGaps.some((previous) => previous.advanced === gap.advanced),
      );
      if (newGaps.length) {
        setNotice(
          `${scienceSequenceMessage(newGaps)} 연결된 심화 과목을 먼저 해제해 주세요. 이전에 확정한 과목은 이전 단계에서 수정할 수 있어요.`,
        );
        return;
      }
    }
    const reason = disabledReason(item);
    if (reason) {
      setNotice(reason);
      return;
    }
    const next = new Set(selected);
    if (next.has(item.course.id)) next.delete(item.course.id);
    else {
      for (const other of occurrences)
        if (
          sameCourse(other.course.name, item.course.name) &&
          !locked.has(other.course.id)
        )
          next.delete(other.course.id);
      next.add(item.course.id);
    }
    setSelected(next);
    setNotice('');
  }

  function advance() {
    if (stage.kind === 'core' && (missingCore.length || missingCoreChoices))
      return;
    if (stage.kind === 'requirement' && remaining > 0) return;
    if (
      stage.kind === 'career' &&
      scienceGaps.length &&
      !window.confirm(
        `${scienceSequenceMessage(scienceGaps)} 기초 과목을 먼저 듣는 것을 추천합니다. 기초 과목 없이 현재 선택을 유지하고 넘어갈까요?`,
      )
    )
      return;
    setHistory([
      ...history,
      { stage, selected: new Set(selected), locked: new Set(locked) },
    ]);
    setLocked(new Set(selected));
    setGuideStep(null);
    setStageIntro(
      stage.kind === 'core'
        ? 'career'
        : stage.kind === 'career'
          ? unmet.length
            ? 'requirement'
            : 'review'
          : unmet.length
            ? null
            : 'review',
    );
    if (stage.kind !== 'core') setUniversityOpen(!unmet.length);
    setRequirementGuideStep(
      stage.kind === 'requirement' && unmet.length ? 'credits' : null,
    );
    setStage(
      stage.kind === 'core'
        ? { kind: 'career' }
        : unmet.length
          ? { kind: 'requirement', id: unmet[0].id }
          : { kind: 'review' },
    );
    setNotice('');
  }

  function back() {
    const previous = history.at(-1);
    if (!previous) return;
    setStageIntro(null);
    setGuideStep(null);
    setRequirementGuideStep(null);
    if (previous.stage.kind === 'requirement') setUniversityOpen(false);
    setStage(previous.stage);
    setSelected(previous.selected);
    setLocked(previous.locked);
    setHistory(history.slice(0, -1));
    setNotice('');
  }

  const stageIndex =
    stage.kind === 'core'
      ? 0
      : stage.kind === 'career'
        ? 1
        : stage.kind === 'requirement'
          ? 2
          : 3;

  function confirmRequired() {
    if (
      scienceGaps.length &&
      !window.confirm(
        `${scienceSequenceMessage(scienceGaps)} 이 내용을 확인하고 현재 선택을 확정할까요?`,
      )
    )
      return;
    setConfirmed(true);
    onRequiredConfirmed?.();
  }
  return {
    applyConfirmedAdjustment: (proposal: ConfirmedAdjustment) => {
      if (!profile) return '희망 학과를 먼저 확인해 주세요.';
      const problem = validateConfirmedAdjustment(
        curriculum,
        [...selected],
        profile,
        proposal,
      );
      if (problem) return problem;
      setSelected(new Set(proposal.nextIds));
      setLocked(new Set(proposal.nextIds));
      setHistory([]);
      return null;
    },
    input,
    setInput,
    department,
    stage,
    selected,
    locked,
    history,
    notice,
    universityOpen,
    setUniversityOpen,
    guideStep,
    stageIntro,
    setStageIntro,
    requirementGuideStep,
    setRequirementGuideStep,
    profile,
    universities,
    guideSteps,
    occurrences,
    completed,
    coreNames,
    coreChoices,
    missingCoreChoices,
    scienceGaps,
    missingCore,
    unavailableCore,
    requirements,
    unmet,
    activeRequirement,
    candidates,
    remaining,
    candidateCredits,
    uniformCredit,
    neededCount,
    requirementGuideSteps,
    finishStageIntro,
    moveGuide,
    infoCourse,
    applyDepartment,
    disabledReason,
    toggle,
    advance,
    back,
    stageIndex,
    departments,
    confirmRequired,
    confirmed,
  };
}
export type CourseSelectionSessionState = ReturnType<
  typeof useCourseSelectionSession
>;
