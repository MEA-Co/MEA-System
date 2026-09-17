'use client';
import { Tabs } from '@base-ui/react/tabs';
import { Download, ListChecks } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ConfirmedCurriculum } from '../_lib/curriculum';

import { CurriculumImportScreen } from './CurriculumImportScreen';
import { ManualCurriculumScreen } from './ManualCurriculumScreen';

export function CurriculumSetupScreen({
  introActive,
  onConfirm,
}: {
  introActive: boolean;
  onConfirm: (curriculum: ConfirmedCurriculum) => void;
}) {
  const tabClass =
    'flex min-h-11 items-center justify-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground data-[active]:border-primary data-[active]:font-semibold data-[active]:text-foreground';
  return (
    <div
      id="curriculum-entry"
      inert={introActive}
      aria-hidden={introActive}
      className={cn('scroll-mt-4', introActive && 'opacity-40')}
    >
      <Tabs.Root defaultValue="import">
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
          <ManualCurriculumScreen onConfirm={onConfirm} />
        </Tabs.Panel>
        <Tabs.Panel
          id="curriculum-import-panel"
          value="import"
          keepMounted
          className="data-[hidden]:hidden"
        >
          <CurriculumImportScreen onConfirm={onConfirm} />
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
