import { type ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  catalogCourseFor,
  type CourseTag,
} from '../../_lib/course-selection-utils';
import type { CurriculumCourse } from '../../_lib/curriculum';

const selectionTypeLabel = {
  general: '일반선택',
  career: '진로선택',
  convergence: '융합선택',
} as const;

export function ImportedCourseInfo({
  course,
  children,
}: {
  course: CurriculumCourse;
  children: ReactElement;
}) {
  const catalogCourse = catalogCourseFor(course);
  const description =
    course.description?.trim() ||
    catalogCourse?.description ||
    '아직 등록된 과목 설명이 없습니다. 학교의 과목 안내를 확인해 주세요.';

  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side="right"
        sideOffset={10}
        align="start"
        className="block max-w-sm space-y-2 bg-background p-4 text-foreground shadow-lg ring-1 ring-border"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{course.name}</p>
          {catalogCourse ? (
            <Badge variant="outline" className="text-[11px]">
              {selectionTypeLabel[catalogCourse.selectionType]}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {course.domain || catalogCourse?.domain}
        </p>
        <p className="text-xs leading-5">{description}</p>
        {catalogCourse?.coreArea ? (
          <p className="border-t pt-2 text-xs leading-5 text-muted-foreground">
            주요 영역 · {catalogCourse.coreArea}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function CourseTags({ tags }: { tags: CourseTag[] }) {
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
