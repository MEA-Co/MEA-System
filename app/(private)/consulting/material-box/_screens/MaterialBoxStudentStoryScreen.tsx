'use client';

import { CircleAlert, LoaderCircle, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import { ConsultingPrompter } from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxProgressScreenData,
  isMaterialBoxStudentStoryErrorScreenData,
  isMaterialBoxStudentStoryScreenData,
  type MaterialBoxProgressScreenData,
  type MaterialBoxStudentStoryErrorScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

function StudentStoryMaterialBox({
  data,
}: {
  data: MaterialBoxProgressScreenData;
}) {
  const majors = data.majorKeywords.map((entry) => entry.major);
  const keywords = data.majorKeywords.map((entry) => entry.keyword);
  const majorRowCount =
    data.majorKeywords.length === 1
      ? 1
      : data.majorKeywords.length === 2
        ? 2
        : 3;

  return (
    <MaterialBoxTable
      compact
      focus="story"
      majorRowCount={majorRowCount}
      majors={majors}
      keywords={keywords}
      studentStory={data.studentStory}
    />
  );
}

function MaterialBoxStudentStoryPendingScreen({
  data,
}: {
  data: MaterialBoxProgressScreenData;
}) {
  return (
    <ConsultingScreenView>
      <div className="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
        <section
          className="flex min-h-56 flex-col items-center justify-center rounded-2xl border bg-background/90 p-6 text-center shadow-sm"
          aria-live="polite"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold tracking-[-0.03em]">
            한 줄 스토리를 만들고 있어요
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            전공과 세부 키워드 사이의 연결점을 찾는 중입니다.
          </p>
        </section>
        <StudentStoryMaterialBox data={data} />
      </div>

      <ConsultingPrompter
        message={{
          segments: [
            {
              text: '입력한 전공과 세부 키워드를 바탕으로 여러분이 어떤 관심을 가진 학생인지 정리하고 있어요.',
            },
          ],
        }}
      />
    </ConsultingScreenView>
  );
}

function MaterialBoxStudentStoryResultScreen({
  data,
  environment,
}: {
  data: MaterialBoxProgressScreenData & { studentStory: string };
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  return (
    <ConsultingScreenView>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <StudentStoryMaterialBox data={data} />
      </div>

      <ConsultingPrompter
        animateTyping
        message={{
          label: '학생의 스토리',
          segments: [{ text: data.studentStory, emphasis: 'strong' }],
        }}
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        <ConsultingProgressButton
          compact
          disabled={!isTypingComplete}
          spacebarShortcut
          onClick={() => environment.send({ type: 'user.next-explanation' })}
        >
          다음으로
        </ConsultingProgressButton>
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

function MaterialBoxStudentStoryErrorScreen({
  data,
  environment,
}: {
  data: MaterialBoxStudentStoryErrorScreenData;
  environment: ConsultingScreenRenderEnvironment;
}) {
  return (
    <ConsultingScreenView>
      <div className="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
        <section
          className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"
          role="alert"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-bold tracking-[-0.03em]">
            한 줄 스토리를 만들지 못했어요
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.error}</p>
        </section>
        <StudentStoryMaterialBox data={data} />
      </div>

      <ConsultingPrompter
        message={{
          segments: [
            {
              text: '잠시 후 다시 시도하면 입력한 전공과 키워드로 한 줄 스토리를 다시 만들 수 있어요.',
            },
          ],
        }}
      >
        <ConsultingProgressButton
          compact
          onClick={() => environment.send({ type: 'user.next-explanation' })}
        >
          다시 생성하기
        </ConsultingProgressButton>
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const materialBoxStudentStoryPendingScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxProgressScreenData,
  render: (request) => (
    <MaterialBoxStudentStoryPendingScreen
      data={request.data as MaterialBoxProgressScreenData}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;

export const materialBoxStudentStoryScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxStudentStoryScreenData,
  render: (request, environment) => (
    <MaterialBoxStudentStoryResultScreen
      data={
        request.data as MaterialBoxProgressScreenData & {
          studentStory: string;
        }
      }
      environment={environment}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;

export const materialBoxStudentStoryErrorScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxStudentStoryErrorScreenData,
  render: (request, environment) => (
    <MaterialBoxStudentStoryErrorScreen
      data={request.data as MaterialBoxStudentStoryErrorScreenData}
      environment={environment}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
