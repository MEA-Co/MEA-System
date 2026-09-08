'use client';

import { Tabs } from '@base-ui/react/tabs';
import { Download, ListChecks } from 'lucide-react';
import { useState } from 'react';

import type { ConfirmedCurriculum } from '@/app/(private)/consulting/subject-selection/_lib/curriculum';

import { CourseSelectionSession } from './CourseSelectionSession';
import { CurriculumImport } from './CurriculumImport';
import { SubjectSelectionPlanner } from './SubjectSelectionPlanner';

export function SubjectSelectionWorkspace() {
  const [confirmedCurriculum, setConfirmedCurriculum] =
    useState<ConfirmedCurriculum | null>(null);
  const tabClass =
    'flex min-h-11 items-center justify-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[active]:border-primary data-[active]:font-semibold data-[active]:text-foreground';

  if (confirmedCurriculum) {
    return <CourseSelectionSession curriculum={confirmedCurriculum} />;
  }

  return (
    <Tabs.Root defaultValue="manual">
      <Tabs.List
        className="mb-5 grid grid-cols-2 border-b sm:flex"
        aria-label="수강 후보군 구성 방식"
      >
        <Tabs.Tab value="manual" className={tabClass}>
          <ListChecks className="size-4 shrink-0" />
          직접 선택
        </Tabs.Tab>
        <Tabs.Tab value="import" className={tabClass}>
          <Download className="size-4 shrink-0" />
          학교 편제표 가져오기
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="manual" keepMounted className="data-[hidden]:hidden">
        <SubjectSelectionPlanner onConfirm={setConfirmedCurriculum} />
      </Tabs.Panel>
      <Tabs.Panel value="import" keepMounted className="data-[hidden]:hidden">
        <CurriculumImport onConfirm={setConfirmedCurriculum} />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
