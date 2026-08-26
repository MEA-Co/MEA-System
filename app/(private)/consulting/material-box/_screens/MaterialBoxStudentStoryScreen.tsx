'use client';

import { CircleAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { ConsultingPreviousButton } from '@/app/(private)/consulting/_components/ConsultingPreviousButton';
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
  studentStoryContent,
}: {
  data: MaterialBoxProgressScreenData;
  studentStoryContent?: ReactNode;
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
      animateEntrance={false}
      focus="story"
      majorRowCount={majorRowCount}
      majors={majors}
      keywords={keywords}
      studentStoryContent={studentStoryContent}
    />
  );
}

function StoryErrorContent({ error }: { error: string }) {
  return (
    <div
      className="rounded-xl border border-destructive/25 bg-destructive/8 p-3 text-left"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive">
          <CircleAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-destructive">
            스토리를 만들지 못했어요
          </p>
          <p className="mt-1 text-xs leading-5 font-normal text-foreground/70 sm:text-sm">
            {error}
          </p>
        </div>
      </div>
    </div>
  );
}

function StoryLoadingContent() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.span
      className="inline-block font-semibold text-muted-foreground"
      style={
        shouldReduceMotion
          ? undefined
          : {
              backgroundImage:
                'linear-gradient(110deg, var(--muted-foreground) 30%, var(--foreground) 50%, var(--muted-foreground) 70%)',
              backgroundSize: '250% 100%',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }
      }
      animate={
        shouldReduceMotion
          ? undefined
          : { backgroundPosition: ['200% 0', '-100% 0'] }
      }
      transition={{
        duration: 1.8,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      스토리를 만들고 있어요
    </motion.span>
  );
}

function FadingStudentStory({
  story,
  onComplete,
}: {
  story: string;
  onComplete: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const words = story.trim().split(/\s+/);

  return (
    <span
      className="block font-medium leading-6 text-foreground"
      aria-label={story}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${index}-${word}`}
          aria-hidden="true"
          className="mr-1 inline-block"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.32,
            delay: shouldReduceMotion ? 0 : index * 0.08,
            ease: 'easeOut',
          }}
          onAnimationComplete={
            index === words.length - 1 ? onComplete : undefined
          }
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

function MaterialBoxStudentStoryPendingScreen({
  data,
}: {
  data: MaterialBoxProgressScreenData;
}) {
  return (
    <ConsultingScreenView>
      <ConsultingPreviousButton disabled />

      <StudentStoryMaterialBox
        data={data}
        studentStoryContent={<StoryLoadingContent />}
      />

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
  const [isStoryAnimationComplete, setIsStoryAnimationComplete] =
    useState(false);

  return (
    <ConsultingScreenView>
      <ConsultingPreviousButton
        disabled={!isStoryAnimationComplete}
        onClick={() => environment.send({ type: 'user.previous-explanation' })}
      />

      <StudentStoryMaterialBox
        data={data}
        studentStoryContent={
          <FadingStudentStory
            story={data.studentStory}
            onComplete={() => setIsStoryAnimationComplete(true)}
          />
        }
      />

      <ConsultingPrompter
        message={{
          segments: [
            { text: '입력한 전공과 키워드에서 ' },
            { text: `'${data.studentStory}'`, emphasis: 'strong' },
            { text: '이라는 특색이 보여요.' },
          ],
        }}
      >
        <ConsultingProgressButton
          compact
          disabled={!isStoryAnimationComplete}
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
      <ConsultingPreviousButton disabled />

      <StudentStoryMaterialBox
        data={data}
        studentStoryContent={<StoryErrorContent error={data.error} />}
      />

      <ConsultingPrompter
        message={{
          title: '스토리를 다시 만들어볼까요?',
          segments: [
            {
              text: '입력한 전공과 키워드는 그대로 보관되어 있어요. 잠시 후 다시 시도하면 같은 내용으로 학생만의 연결점을 다시 찾을 수 있습니다.',
            },
          ],
        }}
      >
        <ConsultingProgressButton
          className="border-destructive/25 bg-destructive/8 text-destructive shadow-sm hover:border-destructive/40 hover:bg-destructive/12"
          spacebarShortcut
          onClick={() => environment.send({ type: 'user.next-explanation' })}
        >
          스토리 다시 만들기
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
