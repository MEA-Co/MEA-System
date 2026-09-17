import { ChevronDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  normalizeCourseName,
  ruleMatchesCourse,
  type UniversityMatch,
} from '@/features/subject-selection/recommendations';
import { universityRuleStatus } from '@/features/subject-selection/university-status';
import { cn } from '@/lib/utils';

import {
  courseDescriptor,
  type CourseOccurrence,
} from '../../_lib/course-selection-utils';
import type { CurriculumCourse } from '../../_lib/curriculum';

export function UniversityGuidance({
  expandUnmet = false,
  department,
  matches,
  completedCourses,
  occurrences,
}: {
  expandUnmet?: boolean;
  department: string;
  matches: UniversityMatch[];
  completedCourses: CurriculumCourse[];
  occurrences: CourseOccurrence[];
}) {
  if (!matches.length) return null;
  return (
    <section id="tutorial-university" className="border-b pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">대학별 권장과목</h2>
        <Badge variant="outline">가장 가까운 모집단위</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {matches.map((match) => {
          const ruleStatuses = match.rules.map((rule) =>
            universityRuleStatus(rule, completedCourses.map(courseDescriptor)),
          );
          const satisfied = ruleStatuses.every((status) => status.satisfied);
          return (
            <details
              key={`${department}-${match.university}`}
              open={expandUnmet && !satisfied ? true : undefined}
              className={cn(
                'group self-start rounded-md border p-3',
                satisfied
                  ? 'border-emerald-300 bg-emerald-50/70'
                  : 'border-amber-300 bg-amber-50/70',
              )}
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{match.university}</p>
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
                <div className="mt-3 space-y-2" aria-live="polite">
                  {match.rules.map((rule, index) =>
                    rule.choose !== undefined || rule.domain ? (
                      <div
                        key={`choice-${index}`}
                        className="rounded border bg-background/80 p-2 text-xs"
                      >
                        <p className="font-medium">
                          선택형 {rule.category === 'core' ? '핵심' : '권장'} ·{' '}
                          {rule.note}
                        </p>
                        <p className="mt-1">
                          현재 {ruleStatuses[index].count}/
                          {ruleStatuses[index].target}과목 ·{' '}
                          {ruleStatuses[index].satisfied
                            ? '충족'
                            : ruleStatuses[index].count <
                                ruleStatuses[index].target
                              ? `${ruleStatuses[index].target - ruleStatuses[index].count}과목 더 선택`
                              : '지정 과목 확인 필요'}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          후보 전체가 아닌 조건에 맞는 과목을 선택합니다.
                        </p>
                      </div>
                    ) : null,
                  )}
                </div>
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
                      {rule.category === 'core' ? '대학 핵심' : '대학 권장'}
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
                      · {ruleStatuses[index].satisfied ? '충족' : '부족'}
                      {ruleStatuses[index].target > 0
                        ? ` (${ruleStatuses[index].count}/${ruleStatuses[index].target})`
                        : ''}
                    </span>
                    {rule.choose !== undefined || rule.domain ? (
                      <details className="mt-1 border-l-2 pl-2">
                        <summary className="cursor-pointer">
                          {rule.choose !== undefined
                            ? `현재 ${new Set(completedCourses.filter((course) => ruleMatchesCourse(rule, courseDescriptor(course))).map((course) => normalizeCourseName(course.name))).size} / ${rule.choose}과목 · 선택 조건`
                            : '자율선택 과목군'}
                        </summary>
                        {rule.requiredCourses?.length ? (
                          <p className="mt-1 font-medium">
                            반드시 포함: {rule.requiredCourses.join(', ')}
                          </p>
                        ) : null}
                        <p className="mt-1">
                          반영한 과목:{' '}
                          {Array.from(
                            new Set(
                              completedCourses
                                .filter((course) =>
                                  ruleMatchesCourse(
                                    rule,
                                    courseDescriptor(course),
                                  ),
                                )
                                .map((course) => course.name),
                            ),
                          ).join(', ') || '아직 없음'}
                        </p>
                        <p className="mt-1">
                          편제 내 후보:{' '}
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
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
