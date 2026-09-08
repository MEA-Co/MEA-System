'use client';

import {
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  GraduationCap,
  LockKeyhole,
  Search,
  Square,
} from 'lucide-react';
import { type ReactElement, useMemo, useState } from 'react';

import type {
  ConfirmedCurriculum,
  CurriculumCourse,
  CurriculumSelectionGroup,
  CurriculumTerm,
} from '@/app/(private)/consulting/subject-selection/_lib/curriculum';
import { subjectSelectionCourses } from '@/app/(private)/consulting/subject-selection/_lib/subjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  findPriorityProfile,
  findUniversityMatches,
  normalizeCourseName,
  PRIORITY_PROFILES,
  type PriorityProfile,
  RECOMMENDATION_SOURCES,
  ruleMatchesCourse,
  type UniversityMatch,
} from '@/features/subject-selection/recommendations';
import { cn } from '@/lib/utils';

type CourseOccurrence = {
  course: CurriculumCourse;
  term: CurriculumTerm;
  group: CurriculumSelectionGroup | null;
  required: boolean;
};

type CourseTag = {
  id: string;
  label: string;
  kind:
    | 'core'
    | 'sub-core'
    | 'internal'
    | 'university-core'
    | 'university'
    | 'graduation';
};

type GraduationAreaId =
  | 'arts'
  | 'integrated';

type GraduationAreaRequirement = {
  id: GraduationAreaId;
  label: string;
  minimumCredit: number;
};

const graduationAreaRequirements: GraduationAreaRequirement[] = [
  { id: 'arts', label: '예술', minimumCredit: 10 },
  {
    id: 'integrated',
    label: '기술·가정·정보·제2외국어·한문·교양',
    minimumCredit: 16,
  },
];

const departmentSuggestions = Array.from(
  new Set(PRIORITY_PROFILES.flatMap((profile) => profile.departments)),
).sort((left, right) => left.localeCompare(right, 'ko-KR'));

const selectionTypeLabel = {
  general: '일반선택',
  career: '진로선택',
  convergence: '융합선택',
} as const;

function catalogCourseFor(course: CurriculumCourse) {
  return subjectSelectionCourses.find(
    (candidate) =>
      normalizeCourseName(candidate.name) === normalizeCourseName(course.name),
  );
}

function courseDescriptor(course: CurriculumCourse) {
  const catalogCourse = catalogCourseFor(course);
  return {
    name: course.name,
    domain: course.domain || catalogCourse?.domain || null,
    selectionType: catalogCourse?.selectionType || null,
  };
}

function ImportedCourseInfo({
  course,
  children,
}: {
  course: CurriculumCourse;
  children: ReactElement;
}) {
  const catalogCourse = catalogCourseFor(course);
  if (!catalogCourse?.description) return children;

  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side="right"
        align="start"
        className="block max-w-sm space-y-2 bg-background p-4 text-foreground shadow-lg ring-1 ring-border"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{catalogCourse.name}</p>
          <Badge variant="outline" className="text-[11px]">
            {selectionTypeLabel[catalogCourse.selectionType]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {catalogCourse.domain}
        </p>
        <p className="text-xs leading-5">{catalogCourse.description}</p>
        {catalogCourse.coreArea ? (
          <p className="border-t pt-2 text-xs leading-5 text-muted-foreground">
            주요 영역 · {catalogCourse.coreArea}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function sameCourse(left: string, right: string) {
  return normalizeCourseName(left) === normalizeCourseName(right);
}

function courseCredit(course: CurriculumCourse) {
  return typeof course.credit === 'number' && Number.isFinite(course.credit)
    ? Math.max(0, course.credit)
    : null;
}

function creditLabel(credit: number | null) {
  return credit === null ? '학점 미확인' : `${credit}학점`;
}

function graduationAreaForCourse(
  course: CurriculumCourse,
): GraduationAreaId | null {
  const descriptor = courseDescriptor(course);
  const domain = descriptor.domain?.replaceAll(/\s+/g, '') ?? '';
  const name = normalizeCourseName(course.name);

  if (domain.includes('예술') || domain.includes('음악') || domain.includes('미술')) {
    return 'arts';
  }
  if (
    /기술가정|정보|제2외국어|외국어|한문|교양/.test(domain)
  ) {
    return 'integrated';
  }

  if (/미술|음악|예술/.test(name)) return 'arts';
  if (
    /정보|인공지능|소프트웨어|데이터|기술|가정|한문|중국어|일본어|스페인어|외국어|교양|보건|진로|생태|철학|심리|종교/.test(
      name,
    )
  ) {
    return 'integrated';
  }

  return null;
}

function getCourseTags(
  course: CurriculumCourse,
  profile: PriorityProfile | null,
  universityMatches: UniversityMatch[],
  graduationNeeds: GraduationAreaRequirement[] = [],
) {
  const tags: CourseTag[] = [];
  const descriptor = courseDescriptor(course);
  const isCore = profile?.core.some((name) => sameCourse(name, course.name));
  const isSubCore = profile?.subCore.some((name) =>
    sameCourse(name, course.name),
  );

  if (isCore) {
    tags.push({ id: 'core', label: '필수 Core', kind: 'core' });
  } else if (isSubCore) {
    tags.push({ id: 'sub-core', label: 'Sub core', kind: 'sub-core' });
  } else if (
    profile &&
    (profile.recommendCourses?.some((name) => sameCourse(name, course.name)) ||
      (descriptor.domain &&
        profile.recommendDomains.includes(descriptor.domain)))
  ) {
    tags.push({ id: 'internal', label: '추가 추천', kind: 'internal' });
  }

  for (const match of universityMatches) {
    const matchingRules = match.rules.filter(
      (rule) =>
        rule.choose === undefined &&
        !rule.domain &&
        ruleMatchesCourse(rule, descriptor),
    );
    if (!matchingRules.length) continue;
    const category = matchingRules.some((rule) => rule.category === 'core')
      ? 'core'
      : 'recommended';
    tags.push({
      id: `${match.university}-${category}`,
      label: `${match.university} ${category === 'core' ? '핵심' : '권장'}`,
      kind: category === 'core' ? 'university-core' : 'university',
    });
  }

  const graduationNeed = graduationNeeds.find(
    (requirement) => graduationAreaForCourse(course) === requirement.id,
  );
  if (graduationNeed) {
    tags.push({
      id: `graduation-${graduationNeed.id}`,
      label: `${graduationNeed.label} 이수 필요`,
      kind: 'graduation',
    });
  }

  return tags;
}

function CourseTags({ tags }: { tags: CourseTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className={cn(
            'text-[11px]',
            tag.kind === 'core' && 'border-red-200 bg-red-50 text-red-700',
            tag.kind === 'sub-core' &&
              'border-amber-200 bg-amber-50 text-amber-800',
            tag.kind === 'internal' && 'border-sky-200 bg-sky-50 text-sky-700',
            tag.kind === 'university-core' &&
              'border-rose-200 bg-rose-50 text-rose-700',
            tag.kind === 'university' &&
              'border-teal-200 bg-teal-50 text-teal-700',
            tag.kind === 'graduation' &&
              'border-amber-300 bg-amber-50 text-amber-900',
          )}
        >
          {tag.label}
        </Badge>
      ))}
    </div>
  );
}

export function CourseSelectionSession({
  curriculum,
}: {
  curriculum: ConfirmedCurriculum;
}) {
  const [departmentInput, setDepartmentInput] = useState('');
  const [desiredDepartment, setDesiredDepartment] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectionNotice, setSelectionNotice] = useState('');

  const profileMatch = useMemo(
    () => (desiredDepartment ? findPriorityProfile(desiredDepartment) : null),
    [desiredDepartment],
  );
  const profile = profileMatch?.profile ?? null;
  const universityMatches = useMemo(
    () =>
      desiredDepartment
        ? findUniversityMatches(desiredDepartment, profile?.id ?? null)
        : [],
    [desiredDepartment, profile?.id],
  );
  const occurrences = useMemo<CourseOccurrence[]>(
    () =>
      curriculum.terms.flatMap((term) => [
        ...term.requiredCourses.map((course) => ({
          course,
          term,
          group: null,
          required: true,
        })),
        ...term.selectionGroups.flatMap((group) =>
          group.courses.map((course) => ({
            course,
            term,
            group,
            required: false,
          })),
        ),
      ]),
    [curriculum.terms],
  );

  const termCreditPlans = useMemo(
    () =>
      curriculum.terms.map((term) => {
        const requiredCredits = term.requiredCourses.map(courseCredit);
        const selectedCredits = term.selectionGroups.flatMap((group) =>
          group.courses
            .filter((course) => selectedCourseIds.has(course.id))
            .map(courseCredit),
        );
        const selectionTargets = term.selectionGroups.map((group) => {
          const candidateCredits = group.courses.map(courseCredit);
          const knownCredits = candidateCredits.filter(
            (credit): credit is number => credit !== null,
          );
          const uniformCredit =
            knownCredits.length === group.courses.length &&
            new Set(knownCredits).size === 1;
          const targetCredit = uniformCredit
            ? group.choose * knownCredits[0]
            : null;
          const selectedCredit = group.courses
            .filter((course) => selectedCourseIds.has(course.id))
            .map(courseCredit)
            .reduce<number | null>(
              (total, credit) => (total === null || credit === null ? null : total + credit),
              0,
            );
          return {
            targetCredit,
            selectedCredit,
            remainingCount: Math.max(
              group.choose - group.courses.filter((course) => selectedCourseIds.has(course.id)).length,
              0,
            ),
          };
        });
        const sumKnown = (credits: (number | null)[]) =>
          credits.every((credit) => credit !== null)
            ? credits.reduce<number>((total, credit) => total + (credit ?? 0), 0)
            : null;
        const fixedCredit = sumKnown(requiredCredits);
        const selectedCredit = sumKnown(selectedCredits);
        const targetSelectionCredit = sumKnown(
          selectionTargets.map((target) => target.targetCredit),
        );
        const remainingSelectionCredit = sumKnown(
          selectionTargets.map((target) =>
            target.targetCredit !== null && target.selectedCredit !== null
              ? Math.max(target.targetCredit - target.selectedCredit, 0)
              : null,
          ),
        );

        return {
          term,
          fixedCredit,
          selectedCredit,
          targetSelectionCredit,
          remainingSelectionCredit,
          remainingCount: selectionTargets.reduce(
            (total, target) => total + target.remainingCount,
            0,
          ),
        };
      }),
    [curriculum.terms, selectedCourseIds],
  );

  const currentSubjectCredits = useMemo(
    () =>
      [
        ...curriculum.priorRequiredCourses.map(courseCredit),
        ...occurrences
          .filter(
            (occurrence) =>
              occurrence.required || selectedCourseIds.has(occurrence.course.id),
          )
          .map((occurrence) => courseCredit(occurrence.course)),
      ]
        .reduce<number | null>(
          (total, credit) => (total === null || credit === null ? null : total + credit),
          0,
        ),
    [curriculum.priorRequiredCourses, occurrences, selectedCourseIds],
  );

  const firstYearRequiredCredit = useMemo(
    () =>
      curriculum.priorRequiredCourses.length
        ? curriculum.priorRequiredCourses
            .map(courseCredit)
            .reduce<number | null>(
              (total, credit) =>
                total === null || credit === null ? null : total + credit,
              0,
            )
        : null,
    [curriculum.priorRequiredCourses],
  );

  const graduationAreaCredits = useMemo(
    () => {
      const current = Object.fromEntries(
        graduationAreaRequirements.map((requirement) => [requirement.id, 0]),
      ) as Record<GraduationAreaId, number>;
      for (const course of curriculum.priorRequiredCourses) {
        const area = graduationAreaForCourse(course);
        const credit = courseCredit(course);
        if (area && credit !== null) current[area] += credit;
      }
      for (const occurrence of occurrences) {
        if (!occurrence.required && !selectedCourseIds.has(occurrence.course.id)) {
          continue;
        }
        const area = graduationAreaForCourse(occurrence.course);
        const credit = courseCredit(occurrence.course);
        if (area && credit !== null) current[area] += credit;
      }
      return current;
    }, [curriculum.priorRequiredCourses, occurrences, selectedCourseIds]);

  const plannedCurriculumCredit = useMemo(
    () =>
      termCreditPlans.reduce<number | null>(
        (total, plan) =>
          total === null ||
          plan.fixedCredit === null ||
          plan.targetSelectionCredit === null
            ? null
            : total + plan.fixedCredit + plan.targetSelectionCredit,
        0,
      ),
    [termCreditPlans],
  );

  const groupSelectedCount = (group: CurriculumSelectionGroup) =>
    group.courses.filter((course) => selectedCourseIds.has(course.id)).length;

  const toggleCourse = (occurrence: CourseOccurrence) => {
    if (occurrence.required || !occurrence.group) return;
    const isSelected = selectedCourseIds.has(occurrence.course.id);
    if (
      isSelected &&
      profile?.core.some((name) => sameCourse(name, occurrence.course.name))
    )
      return;
    if (
      !isSelected &&
      groupSelectedCount(occurrence.group) >= occurrence.group.choose
    ) {
      setSelectionNotice(
        `${occurrence.term.label} ${occurrence.group.name}: ${occurrence.group.choose}과목까지 선택할 수 있습니다.`,
      );
      return;
    }

    setSelectedCourseIds((current) => {
      const next = new Set(current);
      if (isSelected) {
        next.delete(occurrence.course.id);
      } else {
        for (const candidate of occurrences) {
          if (
            sameCourse(candidate.course.name, occurrence.course.name) &&
            candidate.course.id !== occurrence.course.id
          ) {
            next.delete(candidate.course.id);
          }
        }
        next.add(occurrence.course.id);
      }
      return next;
    });
    setSelectionNotice('');
  };

  const applyDepartment = () => {
    const value = departmentInput.trim();
    if (!value) return;
    setDesiredDepartment(value);
    const next = new Set<string>();
    const conflicts: string[] = [];
    for (const name of findPriorityProfile(value)?.profile.core ?? []) {
      const candidates = occurrences.filter((item) =>
        sameCourse(item.course.name, name),
      );
      if (candidates.some((item) => item.required)) continue;
      if (candidates.length !== 1 || !candidates[0].group) continue;
      const candidate = candidates[0];
      const group = candidate.group!;
      if (
        group.courses.filter((course) => next.has(course.id)).length >=
        group.choose
      ) {
        conflicts.push(name);
      } else next.add(candidate.course.id);
    }
    setSelectedCourseIds(next);
    setSelectionNotice(
      conflicts.length
        ? `선택군 정원과 Core가 충돌합니다: ${conflicts.join(', ')}. 편제 확인이 필요합니다.`
        : '',
    );
  };

  const coreStatuses =
    profile?.core.map((courseName) => {
      const courseOccurrences = occurrences.filter((occurrence) =>
        sameCourse(occurrence.course.name, courseName),
      );
      const required = courseOccurrences.some(
        (occurrence) => occurrence.required,
      );
      const selected = courseOccurrences.some((occurrence) =>
        selectedCourseIds.has(occurrence.course.id),
      );
      return { courseName, occurrences: courseOccurrences, required, selected };
    }) ?? [];
  const completedCoreCount = coreStatuses.filter(
    (status) => status.required || status.selected,
  ).length;
  const totalSubjectCredit = currentSubjectCredits;
  const subjectCreditShortfall =
    totalSubjectCredit === null ? null : Math.max(174 - totalSubjectCredit, 0);
  const unmetGraduationAreas = graduationAreaRequirements.filter(
    (requirement) =>
      graduationAreaCredits[requirement.id] < requirement.minimumCredit,
  );

  return (
    <TooltipProvider>
      <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="size-4" aria-hidden="true" />
              {curriculum.schoolName}
            </p>
            <p className="text-sm text-muted-foreground">
              {curriculum.currentGrade
                ? `현재 ${curriculum.currentGrade}학년`
                : curriculum.targetCohort
                  ? `${curriculum.targetCohort}학년도 입학생`
                  : '학년 미지정'}
            </p>
            {curriculum.track ? (
              <Badge variant="outline">{curriculum.track}</Badge>
            ) : null}
          </div>
          {curriculum.targetCohort && curriculum.currentGrade ? (
            <p className="text-xs text-muted-foreground">
              {curriculum.targetCohort}학년도 입학생
            </p>
          ) : null}
        </div>

        <form
          className="w-full space-y-2 lg:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            applyDepartment();
          }}
        >
          <label
            htmlFor="desired-department"
            className="block text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <GraduationCap className="size-4" aria-hidden="true" />
              희망 학과
            </span>
          </label>
          <div className="flex gap-2">
            <Input
              id="desired-department"
              list="department-suggestions"
              value={departmentInput}
              maxLength={100}
              placeholder="예: 컴퓨터공학과"
              onChange={(event) => setDepartmentInput(event.target.value)}
            />
            <Button type="submit" disabled={!departmentInput.trim()}>
              <Search aria-hidden="true" />
              {desiredDepartment ? '다시 적용' : '시작'}
            </Button>
          </div>
          <datalist id="department-suggestions">
            {departmentSuggestions.map((department) => (
              <option key={department} value={department} />
            ))}
          </datalist>
        </form>
      </div>

      {!desiredDepartment ? (
        <div className="flex min-h-52 flex-col items-center justify-center border-y px-4 text-center">
          <GraduationCap
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold">
            희망 학과를 선택해 주세요.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            학과 기준이 정해지면 필수 Core와 대학별 권장과목을 표시합니다.
          </p>
        </div>
      ) : (
        <>
          <section className="border-b pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">희망 학과</p>
                <h2 className="mt-1 text-lg font-semibold">
                  {desiredDepartment}
                </h2>
              </div>
              {profile ? (
                <Badge variant="secondary">{profile.label} 기준</Badge>
              ) : (
                <Badge variant="outline">내부 분류 없음</Badge>
              )}
            </div>
            {!profile ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                가까운 내부 분류를 찾지 못해 필수 Core는 적용하지 않았습니다.
              </p>
            ) : null}
          </section>

          {profile ? (
            <section className="border-b pb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">필수 Core</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {completedCoreCount}/{coreStatuses.length}과목 반영
                  </p>
                </div>
                <Badge
                  variant={
                    completedCoreCount === coreStatuses.length
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {completedCoreCount === coreStatuses.length
                    ? 'Core 충족'
                    : '필수 선택'}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {coreStatuses.map((status) => {
                  const selectable = status.occurrences.filter(
                    (occurrence) => !occurrence.required,
                  );
                  const complete = status.required || status.selected;
                  return (
                    <div key={status.courseName} className="border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {status.courseName}
                        </p>
                        {complete ? (
                          <CircleCheck
                            className="size-4 shrink-0 text-emerald-600"
                            aria-label="반영됨"
                          />
                        ) : (
                          <CircleAlert
                            className="size-4 shrink-0 text-red-600"
                            aria-label="미반영"
                          />
                        )}
                      </div>
                      {status.required ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <LockKeyhole className="size-3" aria-hidden="true" />
                          학교지정으로 충족
                        </p>
                      ) : selectable.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectable.map((occurrence) => {
                            const selected = selectedCourseIds.has(
                              occurrence.course.id,
                            );
                            return (
                              <Button
                                key={occurrence.course.id}
                                type="button"
                                size="xs"
                                variant={selected ? 'default' : 'outline'}
                                disabled={selected}
                                onClick={() => toggleCourse(occurrence)}
                              >
                                {selected ? (
                                  <LockKeyhole aria-label="필수 Core 잠김" />
                                ) : null}
                                {occurrence.term.label}
                                {occurrence.group
                                  ? ` · ${occurrence.group.name}`
                                  : ''}
                              </Button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-red-700">
                          편제 내 미개설
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {profile.subCore.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Sub core
                  </span>
                  {profile.subCore.map((course) => (
                    <Badge key={course} variant="outline">
                      {course}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {universityMatches.length ? (
            <section className="border-b pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">대학별 권장과목</h2>
                <Badge variant="outline">가장 가까운 모집단위</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {universityMatches.map((match) => {
                  const ruleStatuses = match.rules.map((rule) => {
                    const selectedNames = new Set(
                      occurrences
                        .filter(
                          (item) =>
                            (item.required ||
                              selectedCourseIds.has(item.course.id)) &&
                            ruleMatchesCourse(
                              rule,
                              courseDescriptor(item.course),
                            ),
                        )
                        .map((item) => normalizeCourseName(item.course.name)),
                    );
                    const target =
                      rule.choose ??
                      (rule.courses
                        ? new Set(rule.courses.map(normalizeCourseName)).size
                        : 0);
                    return {
                      count: selectedNames.size,
                      target,
                      satisfied:
                        selectedNames.size >= target &&
                        (rule.requiredCourses ?? []).every((name) =>
                          selectedNames.has(normalizeCourseName(name)),
                        ),
                    };
                  });
                  const satisfied = ruleStatuses.every(
                    (status) => status.satisfied,
                  );
                  return (
                    <details
                      key={`${desiredDepartment}-${match.university}`}
                      className={cn(
                        'group self-start rounded-md border p-3',
                        satisfied
                          ? 'border-emerald-300 bg-emerald-50/70'
                          : 'border-amber-300 bg-amber-50/70',
                      )}
                    >
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {match.university}
                          </p>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                satisfied
                                  ? 'border-emerald-300 text-emerald-800'
                                  : 'border-amber-300 text-amber-800'
                              }
                            >
                              {satisfied ? '충족' : '부족'}
                            </Badge>
                            <ChevronDown
                              className="size-4 transition-transform group-open:rotate-180"
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm">
                          {match.matchedDepartment}
                        </p>
                      </summary>
                      <ul className="mt-3 space-y-1.5 border-t pt-2 text-xs text-muted-foreground">
                        {match.rules.map((rule, index) => (
                          <li key={`${rule.note}-${index}`}>
                            <span
                              className={cn(
                                'font-medium',
                                rule.category === 'core'
                                  ? 'text-rose-700'
                                  : 'text-teal-700',
                              )}
                            >
                              {rule.category === 'core'
                                ? '대학 핵심'
                                : '대학 권장'}
                            </span>{' '}
                            {rule.note}
                            <span
                              className={cn(
                                'ml-1 font-medium',
                                ruleStatuses[index].satisfied
                                  ? 'text-emerald-700'
                                  : 'text-amber-800',
                              )}
                            >
                              ·{' '}
                              {ruleStatuses[index].satisfied ? '충족' : '부족'}
                              {ruleStatuses[index].target > 0
                                ? ` (${ruleStatuses[index].count}/${ruleStatuses[index].target})`
                                : ''}
                            </span>
                            {(rule.choose !== undefined || rule.domain) && (
                              <details className="mt-1 border-l-2 pl-2">
                                <summary className="cursor-pointer">
                                  {rule.choose !== undefined
                                    ? `현재 ${new Set(occurrences.filter((item) => (item.required || selectedCourseIds.has(item.course.id)) && ruleMatchesCourse(rule, courseDescriptor(item.course))).map((item) => normalizeCourseName(item.course.name))).size} / ${rule.choose}과목 · 선택 조건`
                                    : '자율선택 과목군'}
                                </summary>
                                <p className="mt-1">
                                  편제 내 대상:{' '}
                                  {Array.from(
                                    new Set(
                                      occurrences
                                        .filter((item) =>
                                          ruleMatchesCourse(
                                            rule,
                                            courseDescriptor(item.course),
                                          ),
                                        )
                                        .map((item) => item.course.name),
                                    ),
                                  ).join(', ') || '없음'}
                                </p>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="border-b pb-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">이수 학점 점검</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  학교지정 과목을 기본으로 반영하고, 선택군에서 아직 채워야 할
                  학점을 확인합니다.
                </p>
              </div>
              <Badge
                variant={
                  termCreditPlans.every((plan) => plan.remainingCount === 0)
                    ? 'secondary'
                    : 'outline'
                }
              >
                {termCreditPlans.reduce(
                  (total, plan) => total + plan.remainingCount,
                  0,
                )}과목 선택 남음
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  학교지정 기본 이수
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {creditLabel(
                    termCreditPlans.reduce<number | null>(
                      (total, plan) =>
                        total === null || plan.fixedCredit === null
                          ? null
                          : total + plan.fixedCredit,
                      0,
                    ),
                  )}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  선택 반영 완료
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {creditLabel(
                    termCreditPlans.reduce<number | null>(
                      (total, plan) =>
                        total === null || plan.selectedCredit === null
                          ? null
                          : total + plan.selectedCredit,
                      0,
                    ),
                  )}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  선택으로 남은 학점
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-800">
                  {creditLabel(
                    termCreditPlans.reduce<number | null>(
                      (total, plan) =>
                        total === null || plan.remainingSelectionCredit === null
                          ? null
                          : total + plan.remainingSelectionCredit,
                      0,
                    ),
                  )}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  2-3학년 편제상 예정
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {creditLabel(plannedCurriculumCredit)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-x-5 gap-y-3 border-y py-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              {termCreditPlans.map((plan) => (
                <div key={plan.term.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 font-medium">
                    <span>{plan.term.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.remainingCount
                        ? `${plan.remainingCount}과목 남음`
                        : '선택 완료'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    기본 {creditLabel(plan.fixedCredit)} · 선택{' '}
                    {creditLabel(plan.selectedCredit)}
                    {plan.remainingSelectionCredit !== null
                      ? ` · 남은 ${plan.remainingSelectionCredit}학점`
                      : ' · 남은 학점 확인 필요'}
                  </p>
                </div>
              ))}
            </div>

            <details className="mt-4 border p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                졸업 이수 기준까지 함께 점검
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                {curriculum.priorRequiredCourses.length
                  ? `가져온 편제의 1학년 학교지정 ${curriculum.priorRequiredCourses.length}과목은 자동 반영했습니다.`
                  : '1학년 학교지정 과목이 편제에 없어 자동 반영할 수 없습니다.'}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    교과 174학점 이상
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {creditLabel(totalSubjectCredit)} / 174학점
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      subjectCreditShortfall === 0
                        ? 'text-emerald-700'
                        : 'text-amber-800',
                    )}
                  >
                    {subjectCreditShortfall === null
                      ? '편제 학점 확인 필요'
                      : subjectCreditShortfall === 0
                        ? '기준 충족'
                        : `${subjectCreditShortfall}학점 남음`}
                  </p>
                </div>
                <div className="border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    현재 편제 반영 교과
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {creditLabel(currentSubjectCredits)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    1학년 학교지정 {creditLabel(firstYearRequiredCredit)} 자동 반영
                    · 2-3학년 선택 완료 시 {creditLabel(plannedCurriculumCredit)} 예정
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">영역별 남은 이수 학점</p>
                  <span className="text-xs text-muted-foreground">
                    가져온 편제 기준
                  </span>
                </div>
                {unmetGraduationAreas.length ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {unmetGraduationAreas.map((requirement) => {
                      const current =
                        graduationAreaCredits[requirement.id];
                      return (
                        <div
                          key={requirement.id}
                          className="border border-amber-200 bg-amber-50/60 p-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium">{requirement.label}</span>
                            <span className="text-amber-800">
                              {requirement.minimumCredit - current}학점 남음
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {current} / {requirement.minimumCredit}학점
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-emerald-700">
                    영역별 최소 이수 기준을 모두 충족했습니다.
                  </p>
                )}
              </div>

            </details>
          </section>

          {selectionNotice ? (
            <p
              role="status"
              className="flex items-start gap-2 border-l-2 border-amber-400 pl-3 text-sm text-amber-800"
            >
              <CircleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {selectionNotice}
            </p>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">학기별 과목 선택</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  학교지정 {occurrences.filter((item) => item.required).length}
                  과목 · 학생선택 {selectedCourseIds.size}과목
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-50 text-red-700"
                >
                  필수 Core
                </Badge>
                <Badge
                  variant="outline"
                  className="border-rose-200 bg-rose-50 text-rose-700"
                >
                  대학 핵심
                </Badge>
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 text-teal-700"
                >
                  대학 권장
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {curriculum.terms.map((term) => (
                <section key={term.id} className="min-w-0 border-t-2 pt-3">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{term.label}</h3>
                    <Badge variant="secondary">
                      {term.requiredCourses.length +
                        term.selectionGroups.reduce(
                          (total, group) => total + group.courses.length,
                          0,
                        )}
                      과목
                    </Badge>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        학교지정 과목
                      </p>
                      <div className="divide-y border-y">
                        {term.requiredCourses.length ? (
                          term.requiredCourses.map((course) => (
                            <div key={course.id} className="py-2.5 text-sm">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 break-words">
                                  {course.name}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                  {course.credit !== null
                                    ? `${course.credit}학점`
                                    : '학점 미확인'}
                                  <LockKeyhole
                                    className="size-3.5"
                                    aria-label="학교지정"
                                  />
                                </span>
                              </div>
                              <CourseTags
                                tags={getCourseTags(
                                  course,
                                  profile,
                                  universityMatches,
                                )}
                              />
                            </div>
                          ))
                        ) : (
                          <p className="py-3 text-sm text-muted-foreground">
                            없음
                          </p>
                        )}
                      </div>
                    </div>

                    {term.selectionGroups.map((group) => {
                      const selectedCount = groupSelectedCount(group);
                      const selectedCourses = group.courses.filter((course) =>
                        selectedCourseIds.has(course.id),
                      );
                      const availableCourses = group.courses.filter(
                        (course) => !selectedCourseIds.has(course.id),
                      );
                      const renderCourse = (course: CurriculumCourse) => {
                        const occurrence: CourseOccurrence = {
                          course,
                          term,
                          group,
                          required: false,
                        };
                        const selected = selectedCourseIds.has(course.id);
                        const locked =
                          selected &&
                          Boolean(
                            profile?.core.some((name) =>
                              sameCourse(name, course.name),
                            ),
                          );
                        const graduationNeed = unmetGraduationAreas.find(
                          (requirement) =>
                            graduationAreaForCourse(course) === requirement.id,
                        );
                        return (
                          <ImportedCourseInfo key={course.id} course={course}>
                            <button
                            key={course.id}
                            type="button"
                            disabled={locked}
                            aria-pressed={selected}
                            title={
                              locked ? '필수 Core: 선택 잠김' : undefined
                            }
                            className={cn(
                              'flex min-h-12 w-full items-start gap-2 py-2.5 text-left text-sm transition-colors',
                              selected && 'bg-emerald-50/70',
                              !selected && graduationNeed && 'bg-amber-50/70',
                            )}
                            onClick={() => toggleCourse(occurrence)}
                          >
                            {locked ? (
                              <LockKeyhole
                                className="mt-0.5 size-4 shrink-0 text-emerald-700"
                                aria-label="필수 Core 잠김"
                              />
                            ) : selected ? (
                              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center bg-emerald-600 text-white">
                                <Check
                                  className="size-3"
                                  aria-hidden="true"
                                />
                              </span>
                            ) : (
                              <Square
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block break-words">
                                {course.name}
                              </span>
                              <CourseTags
                                tags={getCourseTags(
                                  course,
                                  profile,
                                  universityMatches,
                                  unmetGraduationAreas,
                                )}
                              />
                            </span>
                            {course.credit !== null ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {course.credit}학점
                              </span>
                            ) : null}
                            </button>
                          </ImportedCourseInfo>
                        );
                      };
                      return (
                        <div
                          key={group.id}
                          className="border-l-2 border-emerald-500 pl-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {group.name}
                            </p>
                            <Badge
                              variant={
                                selectedCount === group.choose
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="shrink-0"
                            >
                              {selectedCount}/{group.choose} 선택
                            </Badge>
                          </div>
                          {group.rule ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.rule}
                            </p>
                          ) : null}
                          <div className="mt-3">
                            <p className="mb-1.5 text-xs font-semibold text-emerald-800">
                              선택됨
                            </p>
                            <div className="divide-y border-y border-emerald-200">
                              {selectedCourses.length ? (
                                selectedCourses.map(renderCourse)
                              ) : (
                                <p className="py-2.5 text-xs text-muted-foreground">
                                  아직 선택한 과목이 없습니다.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3">
                            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                              선택 가능 과목
                            </p>
                            <div className="divide-y border-y">
                              {availableCourses.length ? (
                                availableCourses.map(renderCourse)
                              ) : (
                                <p className="py-2.5 text-xs text-muted-foreground">
                                  이 선택군의 선택을 모두 채웠습니다.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!term.requiredCourses.length &&
                    !term.selectionGroups.length ? (
                      <p className="text-sm text-muted-foreground">과목 없음</p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </section>

          {curriculum.linkedRules.length ? (
            <section className="border-t pt-4">
              <h2 className="text-sm font-semibold">학기 간 이수 조건</h2>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {curriculum.linkedRules.map((rule, index) => (
                  <li key={`${rule}-${index}`}>{rule}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <details className="border-t pt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              대학별 자료 기준
            </summary>
            <ul className="mt-2 space-y-1.5">
              {RECOMMENDATION_SOURCES.map((source) => (
                <li key={source.university}>
                  {source.university} · {source.title}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      </section>
    </TooltipProvider>
  );
}
