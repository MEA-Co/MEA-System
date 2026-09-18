import { ArrowLeft, Check } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { StandardDraftTerm } from '../_lib/course-selection-draft';

import { ImportedCourseInfo } from './_components/CourseSelectionCourseInfo';

export function FinalCoursePlanScreen({ schoolName, department, secondaryDepartment, terms, onEdit }: {
  schoolName: string;
  department: string;
  secondaryDepartment?: string;
  terms: StandardDraftTerm[];
  onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start' });
  }, []);
  return (
    <section className="space-y-6">
      <header className="border-b pb-5">
        <p className="text-sm text-muted-foreground">{schoolName}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">과목 선택 확정안</h1>
          <Badge className="bg-emerald-100 text-emerald-900"><Check className="size-3" />선택 확정</Badge>
        </div>
        <p className="mt-2 break-words font-medium">{department}{secondaryDepartment ? ` (우선) · ${secondaryDepartment} (병행)` : ''}</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {terms.map((term) => {
          const groups = [
            { label: '학교지정', courses: term.requiredCourses },
            { label: '1단계 확정', courses: term.confirmedCourses.map((item) => item.course) },
            { label: '2단계 확정', courses: term.recommendedCourses.map((item) => item.course) },
          ];
          const courses = groups.flatMap((group) => group.courses);
          const credits = courses.reduce((sum, course) => sum + (course.credit ?? 0), 0);
          return (
            <section key={term.label} className="min-w-0 border-t-2 pt-4">
              <h2 className="text-lg font-semibold">{term.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{courses.length}과목 · {credits}학점{courses.some((course) => course.credit === null) ? ' + 미확인 학점' : ''}</p>
              {groups.map((group) => (
                <div key={group.label} className="mt-5">
                  <h3 className="text-xs font-semibold text-muted-foreground">{group.label}</h3>
                  <div className="mt-2 divide-y border-y">
                    {group.courses.map((course) => (
                      <ImportedCourseInfo key={course.id} course={course}>
                        <div tabIndex={0} className="flex items-start justify-between gap-3 py-3 text-sm">
                          <span className="min-w-0 break-words">{course.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{course.credit === null ? '학점 미확인' : `${course.credit}학점`}</span>
                        </div>
                      </ImportedCourseInfo>
                    ))}
                    {!group.courses.length && <p className="py-3 text-sm text-muted-foreground">해당 과목 없음</p>}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <div className="border-t pt-5">
        <Button variant="outline" onClick={onEdit}><ArrowLeft />상담으로 돌아가 수정하기</Button>
      </div>
    </section>
  );
}
