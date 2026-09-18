import { Badge } from '@/components/ui/badge';
import {
  ruleMatchesCourse,
  type UniversityMatch,
} from '@/features/subject-selection/recommendations';
import { universityRuleStatus } from '@/features/subject-selection/university-status';

import {
  courseDescriptor,
  type CourseOccurrence,
  sameCourse,
} from '../../_lib/course-selection-utils';
import type { CurriculumCourse } from '../../_lib/curriculum';

import { ImportedCourseInfo } from './CourseSelectionCourseInfo';

export function UniversityRecommendationReview({
  matches,
  completed,
  occurrences,
  selected,
  locked,
  disabledReason,
  onToggle,
}: {
  matches: UniversityMatch[];
  completed: CurriculumCourse[];
  occurrences: CourseOccurrence[];
  selected: Set<string>;
  locked: Set<string>;
  disabledReason: (item: CourseOccurrence) => string;
  onToggle: (item: CourseOccurrence) => void;
}) {
  if (!matches.length) return null;
  const outstanding = matches.flatMap((match) =>
    match.rules.flatMap((rule, index) => {
      const { count, target, missingNames, satisfied } = universityRuleStatus(
        rule,
        completed.map(courseDescriptor),
      );
      if (satisfied) return [];
      const candidates = occurrences.filter(
        (item) =>
          !item.required &&
          !selected.has(item.course.id) &&
          !completed.some((course) =>
            sameCourse(course.name, item.course.name),
          ) &&
          ruleMatchesCourse(rule, courseDescriptor(item.course)),
      );
      return [
        {
          id: `${match.university}-${index}`,
          match,
          rule,
          count,
          target,
          missingNames,
          candidates,
        },
      ];
    }),
  );
  const added = occurrences.filter(
    (item) =>
      !item.required &&
      selected.has(item.course.id) &&
      !locked.has(item.course.id),
  );
  if (!outstanding.length && !added.length) return null;
  return (
    <section
      className="space-y-4 border-b pb-5"
      aria-label="대학별 권장과목 마지막 확인"
    >
      <div>
        <h3 className="font-semibold">대학별 권장과목, 더 선택할까요?</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          대학이 안내하는 과목은 가능하면 듣는 것을 추천하지만, 반드시 모두
          선택해야 하는 것은 아니에요.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          하지만 혹시 놓쳤다면 지금 추가할 수 있어요. 또는 아직 고민된다면
          선택하지 않고 넘어가도 괜찮아요. 다음 단계에서 남은 선택군을 설계하며
          더 이야기해 볼 수 있습니다.
        </p>
      </div>
      {outstanding.length ? (
        outstanding.map(
          ({ id, match, rule, count, target, missingNames, candidates }) => (
            <div key={id} className="border-l-2 border-amber-400 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">
                  {match.university} · {match.matchedDepartment}
                </h4>
                <Badge
                  variant="outline"
                  className="border-amber-300 text-amber-800"
                >
                  {rule.category === 'core' ? '대학 핵심' : '대학 권장'} ·{' '}
                  {count}/{target}과목
                </Badge>
              </div>
              <p className="mt-2 text-sm">{rule.note}</p>
              <p className="mt-1 text-xs text-amber-800">
                {Math.max(0, target - count)}과목 추가 필요
                {missingNames.length
                  ? ` · 포함 필요: ${missingNames.join(', ')}`
                  : ''}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {candidates.map((item) => {
                  const reason = disabledReason(item);
                  return (
                    <ImportedCourseInfo
                      key={item.course.id}
                      course={item.course}
                    >
                      <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={false}
                          disabled={Boolean(reason)}
                          onChange={() => onToggle(item)}
                        />
                        <span className="min-w-0 break-words">
                          <span className="font-medium">
                            {item.course.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {item.term.label} · {item.group?.name} ·{' '}
                            {item.course.credit ?? '?'}학점
                          </span>
                          {reason ? (
                            <span className="mt-1 block text-xs text-amber-800">
                              {reason}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </ImportedCourseInfo>
                  );
                })}
              </div>
              {!candidates.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  현재 편제에서 추가로 선택할 후보가 없어요. 지금은 그대로
                  넘어갈 수 있습니다.
                </p>
              ) : null}
            </div>
          ),
        )
      ) : (
        <p role="status" className="text-sm text-emerald-800">
          등록된 대학별 권장조건을 모두 충족했어요.
        </p>
      )}
      {added.length ? (
        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-medium">
            이번 최종 확인에서 추가한 과목
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {added.map((item) => (
              <label
                key={item.course.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => onToggle(item)}
                />
                {item.course.name} · {item.term.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
