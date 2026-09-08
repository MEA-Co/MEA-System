'use client';

import { Check, CheckCircle2, Plus, RotateCcw, Search, X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMemo, useRef, useState } from 'react';

import type { ConfirmedCurriculum } from '@/app/(private)/consulting/subject-selection/_lib/curriculum';
import {
  SUBJECT_SELECTION_TERMS,
  SUBJECT_SELECTION_TYPES,
  type SubjectSelectionCourse,
  subjectSelectionCourses,
  type SubjectSelectionTermId,
  type SubjectSelectionType,
} from '@/app/(private)/consulting/subject-selection/_lib/subjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type CandidatePlan = Record<SubjectSelectionTermId, string[]>;
type ManualGroup = {
  id: string;
  name: string;
  courseIds: string[];
  choose: number;
};
type RequirementPlan = Record<
  SubjectSelectionTermId,
  { requiredCourseIds: string[]; groups: ManualGroup[] }
>;

const initialCandidatePlan = SUBJECT_SELECTION_TERMS.reduce(
  (plan, term) => ({ ...plan, [term.id]: [] }),
  {} as CandidatePlan,
);

const selectionTypeMeta = {
  general: {
    label: '일반선택',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    dotClassName: 'bg-blue-400',
  },
  career: {
    label: '진로선택',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClassName: 'bg-amber-400',
  },
  convergence: {
    label: '융합선택',
    className: 'border-teal-200 bg-teal-50 text-teal-800',
    dotClassName: 'bg-teal-400',
  },
} satisfies Record<
  SubjectSelectionType,
  { label: string; className: string; dotClassName: string }
>;

function getCourseById(courseId: string) {
  return subjectSelectionCourses.find((course) => course.id === courseId);
}

function findCandidateTerm(plan: CandidatePlan, courseId: string) {
  return SUBJECT_SELECTION_TERMS.find((term) =>
    plan[term.id].includes(courseId),
  );
}

function createRequirementPlan(candidatePlan: CandidatePlan): RequirementPlan {
  return SUBJECT_SELECTION_TERMS.reduce(
    (plan, term) => ({
      ...plan,
      [term.id]: {
        requiredCourseIds: [],
        groups: [
          {
            id: `${term.id}-group-1`,
            name: '선택군 1',
            courseIds: [...candidatePlan[term.id]],
            choose: Math.min(1, candidatePlan[term.id].length),
          },
        ],
      },
    }),
    {} as RequirementPlan,
  );
}

function CourseInfoTooltip({
  course,
  side,
  children,
}: {
  course: SubjectSelectionCourse;
  side: 'left' | 'right';
  children: ReactElement;
}) {
  const meta = selectionTypeMeta[course.selectionType];
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={side}
        align="start"
        className="block max-w-sm space-y-2 bg-background p-4 text-foreground shadow-lg ring-1 ring-border"
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{course.name}</p>
          <Badge variant="outline" className={cn('border', meta.className)}>
            <span className={cn('size-1.5 rounded-full', meta.dotClassName)} />
            {meta.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{course.domain}</p>
        <p className="text-xs leading-5">
          {course.description || '설명 미등록'}
        </p>
        <p className="border-t pt-2 text-xs leading-5 text-muted-foreground">
          {course.coreArea || '핵심 영역 미등록'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function SubjectSelectionPlanner({
  onConfirm,
}: {
  onConfirm: (curriculum: ConfirmedCurriculum) => void;
}) {
  const [activeTermId, setActiveTermId] =
    useState<SubjectSelectionTermId>('grade-2-semester-1');
  const [candidatePlan, setCandidatePlan] = useState<CandidatePlan>(() => ({
    ...initialCandidatePlan,
  }));
  const [requirementPlan, setRequirementPlan] =
    useState<RequirementPlan | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [currentGrade, setCurrentGrade] = useState<1 | 2 | 3>(1);
  const [query, setQuery] = useState('');
  const [activeDomain, setActiveDomain] = useState('전체');
  const [activeType, setActiveType] = useState<SubjectSelectionType | 'all'>(
    'all',
  );
  const groupSequence = useRef(2);
  const isStructuring = requirementPlan !== null;

  const domains = useMemo(
    () => [
      '전체',
      ...Array.from(
        new Set(subjectSelectionCourses.map((course) => course.domain)),
      ),
    ],
    [],
  );
  const selectedCourseCount = Object.values(candidatePlan).reduce(
    (total, ids) => total + ids.length,
    0,
  );
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    return subjectSelectionCourses.filter(
      (course) =>
        (activeDomain === '전체' || course.domain === activeDomain) &&
        (activeType === 'all' || course.selectionType === activeType) &&
        (!normalizedQuery ||
          course.name.toLocaleLowerCase('ko-KR').includes(normalizedQuery)),
    );
  }, [activeDomain, activeType, query]);

  const selectCandidateCourse = (courseId: string) => {
    if (isStructuring) return;
    setCandidatePlan((current) => {
      const next = SUBJECT_SELECTION_TERMS.reduce(
        (result, term) => ({
          ...result,
          [term.id]: current[term.id].filter((id) => id !== courseId),
        }),
        {} as CandidatePlan,
      );
      return { ...next, [activeTermId]: [...next[activeTermId], courseId] };
    });
  };

  const updateTerm = (
    termId: SubjectSelectionTermId,
    update: (
      term: RequirementPlan[SubjectSelectionTermId],
    ) => RequirementPlan[SubjectSelectionTermId],
  ) =>
    setRequirementPlan((current) =>
      current ? { ...current, [termId]: update(current[termId]) } : current,
    );

  const toggleRequired = (termId: SubjectSelectionTermId, courseId: string) => {
    updateTerm(termId, (term) => {
      const isRequired = term.requiredCourseIds.includes(courseId);
      const groups = term.groups.map((group) => ({
        ...group,
        courseIds: group.courseIds.filter((id) => id !== courseId),
      }));
      if (!isRequired)
        return {
          requiredCourseIds: [...term.requiredCourseIds, courseId],
          groups,
        };

      const first = groups[0] ?? {
        id: `${termId}-group-${groupSequence.current++}`,
        name: '선택군 1',
        courseIds: [],
        choose: 1,
      };
      const nextGroups = groups.length ? [...groups] : [first];
      nextGroups[0] = {
        ...nextGroups[0],
        courseIds: [...nextGroups[0].courseIds, courseId],
        choose: Math.max(1, nextGroups[0].choose),
      };
      return {
        requiredCourseIds: term.requiredCourseIds.filter(
          (id) => id !== courseId,
        ),
        groups: nextGroups,
      };
    });
  };

  const moveToGroup = (
    termId: SubjectSelectionTermId,
    courseId: string,
    groupId: string,
  ) => {
    updateTerm(termId, (term) => ({
      requiredCourseIds: term.requiredCourseIds.filter((id) => id !== courseId),
      groups: term.groups.map((group) => ({
        ...group,
        courseIds:
          group.id === groupId
            ? [...group.courseIds.filter((id) => id !== courseId), courseId]
            : group.courseIds.filter((id) => id !== courseId),
      })),
    }));
  };

  const addGroup = (termId: SubjectSelectionTermId) => {
    updateTerm(termId, (term) => {
      const source = [...term.groups]
        .sort((a, b) => b.courseIds.length - a.courseIds.length)
        .find((group) => group.courseIds.length >= 2);
      if (!source) return term;
      const courseId = source.courseIds[source.courseIds.length - 1];
      return {
        ...term,
        groups: [
          ...term.groups.map((group) =>
            group.id === source.id
              ? {
                  ...group,
                  courseIds: group.courseIds.slice(0, -1),
                  choose: Math.min(group.choose, group.courseIds.length - 1),
                }
              : group,
          ),
          {
            id: `${termId}-group-${groupSequence.current++}`,
            name: `선택군 ${term.groups.length + 1}`,
            courseIds: [courseId],
            choose: 1,
          },
        ],
      };
    });
  };

  const removeGroup = (termId: SubjectSelectionTermId, groupId: string) => {
    updateTerm(termId, (term) => {
      if (term.groups.length <= 1) return term;
      const removed = term.groups.find((group) => group.id === groupId);
      const remaining = term.groups.filter((group) => group.id !== groupId);
      return {
        ...term,
        groups: remaining.map((group, index) =>
          index === 0
            ? {
                ...group,
                courseIds: [...group.courseIds, ...(removed?.courseIds ?? [])],
              }
            : group,
        ),
      };
    });
  };

  const updateGroup = (
    termId: SubjectSelectionTermId,
    groupId: string,
    values: Partial<Pick<ManualGroup, 'name' | 'choose'>>,
  ) =>
    updateTerm(termId, (term) => ({
      ...term,
      groups: term.groups.map((group) =>
        group.id === groupId ? { ...group, ...values } : group,
      ),
    }));

  const canConfirm =
    Boolean(schoolName.trim()) &&
    Boolean(requirementPlan) &&
    SUBJECT_SELECTION_TERMS.every((term) => {
      const setup = requirementPlan?.[term.id];
      if (!setup || candidatePlan[term.id].length === 0) return false;
      return setup.groups
        .filter((group) => group.courseIds.length)
        .every(
          (group) =>
            Boolean(group.name.trim()) &&
            group.choose >= 1 &&
            group.choose <= group.courseIds.length,
        );
    });

  const confirmCurriculum = () => {
    if (!canConfirm || !requirementPlan) return;
    onConfirm({
      schoolName: schoolName.trim(),
      currentGrade,
      targetCohort: null,
      track: null,
      source: 'manual',
      linkedRules: [],
      priorRequiredCourses: [],
      terms: SUBJECT_SELECTION_TERMS.map((term) => {
        const setup = requirementPlan[term.id];
        const toCourse = (courseId: string) => {
          const course = getCourseById(courseId);
          return course
            ? {
                id: course.id,
                name: course.name,
                credit: null,
                domain: course.domain,
                description: course.description || null,
              }
            : null;
        };
        return {
          id: term.id,
          label: term.label,
          requiredCourses: setup.requiredCourseIds
            .map(toCourse)
            .filter((course): course is NonNullable<typeof course> =>
              Boolean(course),
            ),
          selectionGroups: setup.groups
            .filter((group) => group.courseIds.length)
            .map((group) => ({
              id: group.id,
              name: group.name.trim(),
              choose: group.choose,
              rule: null,
              courses: group.courseIds
                .map(toCourse)
                .filter((course): course is NonNullable<typeof course> =>
                  Boolean(course),
                ),
            })),
        };
      }),
    });
  };

  return (
    <TooltipProvider>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {isStructuring ? '학교 편제 구성' : '학기별 과목 후보 구성'}
              </p>
              {isStructuring ? (
                <Badge variant="secondary">후보군 완료</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isStructuring
                ? '학교지정 과목과 선택군별 선택 개수를 설정합니다.'
                : `${selectedCourseCount}개 과목이 배치되어 있습니다.`}
            </p>
          </div>
          {isStructuring ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequirementPlan(null)}
              >
                <RotateCcw aria-hidden="true" />
                후보군 수정
              </Button>
              <Button
                type="button"
                disabled={!canConfirm}
                onClick={confirmCurriculum}
              >
                <CheckCircle2 aria-hidden="true" />
                편제표 확정
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              disabled={
                selectedCourseCount === 0 ||
                SUBJECT_SELECTION_TERMS.some(
                  (term) => candidatePlan[term.id].length === 0,
                )
              }
              onClick={() =>
                setRequirementPlan(createRequirementPlan(candidatePlan))
              }
            >
              <CheckCircle2 aria-hidden="true" />
              후보군 완료
            </Button>
          )}
        </div>

        {isStructuring ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>학교명</span>
              <Input
                value={schoolName}
                maxLength={100}
                placeholder="예: 서울고등학교"
                onChange={(event) => setSchoolName(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>현재 학년</span>
              <select
                value={currentGrade}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                onChange={(event) =>
                  setCurrentGrade(Number(event.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>1학년</option>
                <option value={2}>2학년</option>
                <option value={3}>3학년</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {SUBJECT_SELECTION_TERMS.map((term, termIndex) => {
            const courses = candidatePlan[term.id]
              .map(getCourseById)
              .filter((course): course is SubjectSelectionCourse =>
                Boolean(course),
              );
            const setup = requirementPlan?.[term.id];
            const side = termIndex >= 2 ? 'left' : 'right';
            const canAddGroup = Boolean(
              setup?.groups.some((group) => group.courseIds.length >= 2),
            );
            return (
              <section
                key={term.id}
                className={cn(
                  'min-w-0 border-t-2 pt-3',
                  !isStructuring && activeTermId === term.id
                    ? 'border-primary'
                    : 'border-border',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => !isStructuring && setActiveTermId(term.id)}
                >
                  <span className="text-base font-semibold">{term.label}</span>
                  <Badge variant="outline">{courses.length}과목</Badge>
                </button>

                {!isStructuring ? (
                  <div className="mt-3 space-y-2">
                    {courses.length ? (
                      courses.map((course) => (
                        <div
                          key={course.id}
                          className="flex min-h-10 items-center justify-between gap-2 border-b py-2 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {course.name}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${course.name} 제거`}
                            onClick={() =>
                              setCandidatePlan((current) => ({
                                ...current,
                                [term.id]: current[term.id].filter(
                                  (id) => id !== course.id,
                                ),
                              }))
                            }
                          >
                            <X className="size-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="py-5 text-sm text-muted-foreground">
                        선택된 과목 없음
                      </p>
                    )}
                  </div>
                ) : setup ? (
                  <div className="mt-4 space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        학교지정 과목
                      </p>
                      <div className="space-y-2">
                        {setup.requiredCourseIds.length ? (
                          setup.requiredCourseIds.map((courseId) => {
                            const course = getCourseById(courseId);
                            return course ? (
                              <CourseInfoTooltip
                                key={course.id}
                                course={course}
                                side={side}
                              >
                                <button
                                  type="button"
                                  className="flex min-h-10 w-full items-center justify-between gap-2 border-b py-2 text-left text-sm"
                                  onClick={() =>
                                    toggleRequired(term.id, course.id)
                                  }
                                >
                                  <span className="min-w-0 truncate">
                                    {course.name}
                                  </span>
                                  <Badge variant="outline">필수</Badge>
                                </button>
                              </CourseInfoTooltip>
                            ) : null;
                          })
                        ) : (
                          <p className="py-2 text-xs text-muted-foreground">
                            아래 과목에서 필수로 지정
                          </p>
                        )}
                      </div>
                    </div>

                    {setup.groups.map((group) => (
                      <div
                        key={group.id}
                        className="border-l-2 border-emerald-500 pl-3"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={group.name}
                            maxLength={50}
                            aria-label={`${term.label} 선택군 이름`}
                            className="min-w-0 flex-1"
                            onChange={(event) =>
                              updateGroup(term.id, group.id, {
                                name: event.target.value,
                              })
                            }
                          />
                          {setup.groups.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`${group.name} 삭제`}
                              onClick={() => removeGroup(term.id, group.id)}
                            >
                              <X className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{group.courseIds.length}과목 중</span>
                          <Input
                            type="number"
                            min={1}
                            max={Math.max(1, group.courseIds.length)}
                            value={group.choose}
                            aria-label={`${group.name} 선택 개수`}
                            className="h-8 w-16"
                            onChange={(event) =>
                              updateGroup(term.id, group.id, {
                                choose: Math.min(
                                  group.courseIds.length,
                                  Math.max(
                                    1,
                                    Number.parseInt(event.target.value, 10) ||
                                      1,
                                  ),
                                ),
                              })
                            }
                          />
                          <span>과목 선택</span>
                        </label>
                        <div className="mt-2 space-y-2">
                          {group.courseIds.map((courseId) => {
                            const course = getCourseById(courseId);
                            return course ? (
                              <div key={course.id} className="border-b py-2">
                                <CourseInfoTooltip course={course} side={side}>
                                  <button
                                    type="button"
                                    className="flex min-h-8 w-full items-center justify-between gap-2 text-left text-sm"
                                    onClick={() =>
                                      toggleRequired(term.id, course.id)
                                    }
                                  >
                                    <span className="min-w-0 truncate">
                                      {course.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      필수 지정
                                    </span>
                                  </button>
                                </CourseInfoTooltip>
                                {setup.groups.length > 1 ? (
                                  <select
                                    value={group.id}
                                    aria-label={`${course.name} 선택군`}
                                    className="mt-1 h-7 w-full rounded-md border bg-background px-2 text-xs"
                                    onChange={(event) =>
                                      moveToGroup(
                                        term.id,
                                        course.id,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {setup.groups.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canAddGroup}
                      onClick={() => addGroup(term.id)}
                    >
                      <Plus className="size-4" />
                      선택군 추가
                    </Button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {!isStructuring ? (
          <section className="border-t pt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">과목 후보군</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  현재 학기:{' '}
                  {
                    SUBJECT_SELECTION_TERMS.find(
                      (term) => term.id === activeTermId,
                    )?.label
                  }
                </p>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  placeholder="과목명 검색"
                  className="pl-9"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {domains.map((domain) => (
                <Button
                  key={domain}
                  type="button"
                  size="sm"
                  variant={activeDomain === domain ? 'default' : 'outline'}
                  onClick={() => setActiveDomain(domain)}
                >
                  {domain}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeType === 'all' ? 'default' : 'outline'}
                onClick={() => setActiveType('all')}
              >
                전체
              </Button>
              {SUBJECT_SELECTION_TYPES.map((selectionType) => (
                <Button
                  key={selectionType}
                  type="button"
                  size="sm"
                  variant={activeType === selectionType ? 'default' : 'outline'}
                  onClick={() => setActiveType(selectionType)}
                >
                  {selectionTypeMeta[selectionType].label}
                </Button>
              ))}
            </div>
            <div className="mt-4 grid max-h-[32rem] gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredCourses.map((course) => {
                const selectedTerm = findCandidateTerm(
                  candidatePlan,
                  course.id,
                );
                return (
                  <button
                    key={course.id}
                    type="button"
                    className={cn(
                      'flex h-11 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm font-medium transition-colors',
                      selectedTerm?.id === activeTermId
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-foreground/30',
                    )}
                    onClick={() => selectCandidateCourse(course.id)}
                  >
                    <span className="truncate">{course.name}</span>
                    {selectedTerm ? (
                      <Check className="size-4 shrink-0" />
                    ) : (
                      <Plus className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </TooltipProvider>
  );
}
