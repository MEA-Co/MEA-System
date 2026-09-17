'use client';

import { TooltipProvider } from '@/components/ui/tooltip';

import { useCourseSelectionSession } from '../_hooks/useCourseSelectionSession';
import type { ConfirmedCurriculum } from '../_lib/curriculum';
import { CourseDraftScreen } from '../_screens/CourseDraftScreen';
import { RequiredCoursesScreen } from '../_screens/RequiredCoursesScreen';

export function CourseSelectionSession({
  curriculum,
  onRequiredConfirmed,
}: {
  curriculum: ConfirmedCurriculum;
  onRequiredConfirmed?: () => void;
}) {
  const session = useCourseSelectionSession(curriculum, onRequiredConfirmed);
  if (session.confirmed)
    return (
      <TooltipProvider>
        <CourseDraftScreen
          schoolName={curriculum.schoolName}
          department={session.department}
          curriculum={curriculum}
          profile={session.profile}
          confirmedCourseIds={[...session.selected]}
          onAdjustConfirmed={session.applyConfirmedAdjustment}
        />
      </TooltipProvider>
    );
  return <RequiredCoursesScreen curriculum={curriculum} session={session} />;
}
