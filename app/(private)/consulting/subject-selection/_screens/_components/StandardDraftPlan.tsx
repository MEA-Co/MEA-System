import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type {
  DraftCourse,
  StandardDraftTerm,
} from '../../_lib/course-selection-draft';
import type { CurriculumCourse } from '../../_lib/curriculum';

import { ImportedCourseInfo } from './CourseSelectionCourseInfo';

export function StandardDraftPlan({
  terms,
  combined = false,
}: {
  terms: StandardDraftTerm[];
  combined?: boolean;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">전체 선택 초안</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {combined
              ? '양쪽 코어와 보완 과목을 검토한 초안입니다. 기존 확정 과목은 유지했습니다.'
              : '남은 선택군은 Sub core, 추천 과목군, 전공과 가까운 영역 순으로 채웠습니다.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline">학교지정</Badge>
          <Badge
            variant="outline"
            className="border-emerald-200 text-emerald-800"
          >
            1단계 확정
          </Badge>
          <Badge variant="outline" className="border-sky-200 text-sky-800">
            2단계 추천
          </Badge>
        </div>
      </div>
      <div className="mt-5 space-y-8">
        <DraftStage
          title="학교지정"
          description="학교가 지정한 과목으로, 초안에서 변경하지 않습니다."
          terms={terms}
          getCourses={(term) => term.requiredCourses}
        />
        <DraftStage
          title="1단계 확정"
          description="코어, 진로 관련 과목과 필수 이수 조건을 위해 이미 확정한 선택 과목입니다."
          accent="emerald"
          terms={terms}
          getCourses={(term) => term.confirmedCourses}
        />
        <DraftStage
          title="2단계 추천"
          description={
            combined
              ? '추가 학과와 지원 우선순위를 반영한 검토용 추천 과목입니다.'
              : '남은 선택군을 전공 기본형 기준으로 채운 추천 과목입니다.'
          }
          accent="sky"
          terms={terms}
          getCourses={(term) => term.recommendedCourses}
          getNotice={(term) =>
            term.unfilledCount
              ? `${term.unfilledCount}과목은 중복 없이 추천할 후보가 부족해 비워 두었습니다.`
              : null
          }
        />
        <section className="border-t-2 pt-4">
          <h3 className="text-base font-semibold">미선택 과목</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            추천 과목과 비교해볼 교체 후보입니다. 같은 학기·선택군의 과목부터
            살펴보고, 어떤 과목과 바꾸고 싶은지 이야기해 주세요. 과목에 마우스를
            올리면 설명을 볼 수 있습니다.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {terms.map((term) => (
              <div key={term.label} className="min-w-0">
                <p className="text-sm font-semibold">{term.label}</p>
                {term.unselectedGroups.length ? (
                  term.unselectedGroups.map((group) => (
                    <div key={group.id} className="mt-3 rounded-lg border p-3">
                      <DraftCourseList
                        label={group.name}
                        courses={group.courses}
                      />
                    </div>
                  ))
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    미선택 과목 없음
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DraftStage({
  title,
  description,
  accent,
  terms,
  getCourses,
  getNotice,
}: {
  title: string;
  description: string;
  accent?: 'emerald' | 'sky';
  terms: StandardDraftTerm[];
  getCourses: (term: StandardDraftTerm) => CurriculumCourse[] | DraftCourse[];
  getNotice?: (term: StandardDraftTerm) => string | null;
}) {
  return (
    <section className="border-t-2 pt-4">
      <div>
        <h3
          className={cn(
            'text-base font-semibold',
            accent === 'emerald' && 'text-emerald-800',
            accent === 'sky' && 'text-sky-800',
          )}
        >
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {terms.map((term) => (
          <div key={term.label} className="min-w-0">
            <p className="text-sm font-semibold">{term.label}</p>
            <DraftCourseList
              label={title}
              courses={getCourses(term)}
              accent={accent}
            />
            {getNotice?.(term) ? (
              <p className="mt-3 text-xs text-amber-800">{getNotice(term)}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function DraftCourseList({
  label,
  courses,
  accent,
}: {
  label: string;
  courses: CurriculumCourse[] | DraftCourse[];
  accent?: 'emerald' | 'sky';
}) {
  return (
    <div className="mt-2">
      <p
        className={cn(
          'text-xs font-semibold text-muted-foreground',
          accent === 'emerald' && 'text-emerald-800',
          accent === 'sky' && 'text-sky-800',
        )}
      >
        {label}
      </p>
      <div className="mt-1.5 divide-y border-y">
        {courses.length ? (
          courses.map((item) => {
            const isDraftCourse = 'course' in item;
            const course = isDraftCourse ? item.course : item;
            return (
              <ImportedCourseInfo key={course.id} course={course}>
                <div
                  tabIndex={0}
                  className="cursor-help rounded py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words">{course.name}</span>
                    {course.credit !== null ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {course.credit}학점
                      </span>
                    ) : null}
                  </div>
                  {isDraftCourse &&
                  item.groupName &&
                  item.groupName !== label ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {item.groupName}
                    </p>
                  ) : null}
                  {isDraftCourse && item.note ? (
                    <p className="mt-1 text-xs text-amber-800">{item.note}</p>
                  ) : null}
                </div>
              </ImportedCourseInfo>
            );
          })
        ) : (
          <p className="py-2 text-xs text-muted-foreground">해당 과목 없음</p>
        )}
      </div>
    </div>
  );
}
