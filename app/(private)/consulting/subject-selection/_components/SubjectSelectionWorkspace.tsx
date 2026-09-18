'use client';

import { Check, ChevronDown, Download } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ConfirmedCurriculum } from '../_lib/curriculum';
import {
  TutorialBubble,
  tutorialHighlight,
} from '../_screens/_components/CourseSelectionTutorial';
import { CurriculumSetupScreen } from '../_screens/CurriculumSetupScreen';

import { CourseSelectionSession } from './CourseSelectionSession';

const consultingSteps = [
  {
    title: '편제표 확인',
    description: '학교·학년 정보로 과목과 이수 조건 확인',
  },
  {
    title: '필수 과목 확정',
    description: '전공의 기초와 졸업에 필요한 과목 확정',
  },
  {
    title: '선택과목 확정',
    description: '나의 관심과 스토리를 반영한 로드맵 완성',
  },
] as const;
type ConsultingStep = 0 | 1 | 2;
type IntroStep = ConsultingStep | 'start';

export function SubjectSelectionWorkspace() {
  const [confirmedCurriculum, setConfirmedCurriculum] =
    useState<ConfirmedCurriculum | null>(null);
  const [currentStep, setCurrentStep] = useState<ConsultingStep>(0);
  const [introStep, setIntroStep] = useState<IntroStep | null>(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const completedSteps = finalized ? 3 : currentStep;
  const expanded = introStep !== null || detailsOpen;

  useEffect(() => {
    if (introStep !== null) {
      document
        .getElementById('consulting-progress')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const target = document.getElementById(
      currentStep === 0 ? 'curriculum-entry' : 'consulting-progress',
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (currentStep === 0) {
      document
        .getElementById('curriculum-import-panel')
        ?.querySelector<HTMLInputElement>('input')
        ?.focus({ preventScroll: true });
    }
  }, [currentStep, introStep]);

  function finishIntro() {
    setIntroStep(null);
    setDetailsOpen(false);
  }

  function confirmCurriculum(curriculum: ConfirmedCurriculum) {
    setFinalized(false);
    setConfirmedCurriculum(curriculum);
    finishIntro();
    setCurrentStep(1);
  }

  function advanceIntro() {
    if (introStep === 0) setIntroStep(1);
    else if (introStep === 1) setIntroStep(2);
    else if (introStep === 2) setIntroStep('start');
    else finishIntro();
  }

  return (
    <div className="space-y-6">
      <section
        id="consulting-progress"
        aria-label="선택과목 컨설팅 전체 진행도"
        className="scroll-mt-4 rounded-xl border bg-background p-4 md:p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold" aria-live="polite">
            {finalized ? '과목 선택 완료 · 100%' : `현재 Step ${currentStep} · ${consultingSteps[currentStep].title}`}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              전체 3스텝 중 {completedSteps}스텝 완료
            </span>
            {introStep === null ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={expanded}
                aria-controls="consulting-step-details"
                onClick={() => setDetailsOpen(!detailsOpen)}
              >
                {expanded ? '접기' : '전체 단계 보기'}
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform',
                    expanded && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </Button>
            ) : null}
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="전체 진행도"
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={completedSteps}
          aria-valuetext={finalized ? '전체 3스텝 완료. 100%' : `${currentStep}개 스텝 완료. 현재 Step ${currentStep} ${consultingSteps[currentStep].title}`}
          className={cn(
            'h-2 overflow-hidden rounded-full bg-muted',
            expanded && 'mb-4',
          )}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
            style={{ width: `${(completedSteps / 3) * 100}%` }}
          />
        </div>
        <div id="consulting-step-details" hidden={!expanded}>
          <ol className="grid gap-3 sm:grid-cols-3">
            {consultingSteps.map((step, index) => (
              <li
                key={step.title}
                aria-current={!finalized && currentStep === index ? 'step' : undefined}
                className={cn(
                  'min-w-0 rounded-lg border p-3',
                  index < completedSteps && 'border-emerald-200 bg-emerald-50/50',
                  !finalized && index === currentStep && 'border-emerald-600 bg-emerald-50',
                  introStep === index && tutorialHighlight,
                )}
              >
                <p className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Step {index}</span>
                  {index < completedSteps ? (
                    <Check
                      className="size-4 text-emerald-700"
                      aria-label="완료"
                    />
                  ) : index === currentStep ? (
                    <span className="text-emerald-800">진행 중</span>
                  ) : (
                    <span>예정</span>
                  )}
                </p>
                <h2 className="mt-2 text-sm font-semibold">{step.title}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
          {introStep !== null ? (
            <TutorialBubble
              step={
                introStep === 'start'
                  ? '시작 준비'
                  : `전체 흐름 안내 ${introStep + 1}/3`
              }
              title={
                introStep === 0
                  ? '선택과목 컨설팅은 이렇게 3스텝으로 진행돼요'
                  : introStep === 1
                    ? 'Step 1에서는 필수 과목부터 확정해요'
                    : introStep === 2
                      ? 'Step 2에서는 나만의 선택과목 로드맵을 완성해요'
                      : '그럼 이제 편제표부터 받아볼까요?'
              }
              actionLabel={
                introStep === 'start' ? '좋아요 · 편제표 가져오기' : '다음'
              }
              onAction={advanceIntro}
              onBack={
                introStep === 0
                  ? undefined
                  : () =>
                      setIntroStep(
                        introStep === 'start' ? 2 : introStep === 2 ? 1 : 0,
                      )
              }
              onSkip={finishIntro}
            >
              {introStep === 0 ? (
                <p>
                  먼저 Step 0에서는 학교와 학년·입학 연도 정보를 바탕으로 학교
                  편제표를 가져옵니다. 어떤 과목이 어느 학기에 열리는지, 학교의
                  이수 조건은 무엇인지 확인할 거예요. 필요한 경우 편제표를 직접
                  넣거나 수정할 수도 있습니다.
                </p>
              ) : introStep === 1 ? (
                <p>
                  지망 학과의 전공 공부에 필요한 코어와 꼭 듣기로 한 진로 과목을
                  고릅니다. 이어서 고등학교 졸업을 위한 필수 이수 조건을 채울
                  과목까지 먼저 확정할 거예요.
                </p>
              ) : introStep === 2 ? (
                <p>
                  필수 과목을 모두 확정했다면, 나의 스토리와 관심 분야, 함께
                  고민하는 진로 등 다양한 기준을 반영해 남은 과목을 선택합니다.
                  이를 바탕으로 최종 선택과목 로드맵을 완성할 거예요.
                </p>
              ) : (
                <p>
                  아래에서 학교와 학년 정보를 입력하고 편제표를 가져와 주세요.
                  과목과 학점을 확인한 뒤 확정하면 진행 바도 Step 1로
                  넘어갑니다.
                </p>
              )}
            </TutorialBubble>
          ) : currentStep === 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setIntroStep(0)}
            >
              전체 진행 안내 다시 보기
            </Button>
          ) : null}
        </div>
      </section>
      {process.env.NODE_ENV === 'development' && !confirmedCurriculum ? (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const { default: curriculum } =
              await import('../_data/test-curriculum');
            confirmCurriculum(curriculum);
          }}
        >
          <Download className="size-4" />
          흑석고 테스트 편제표 불러오기
        </Button>
      ) : null}
      {process.env.NODE_ENV === 'development' && confirmedCurriculum ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(confirmedCurriculum, null, 2)], {
                type: 'application/json',
              }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = 'subject-selection-test-curriculum.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download className="size-4" />
          테스트 편제표 저장
        </Button>
      ) : null}
      {confirmedCurriculum ? (
        <CourseSelectionSession
          curriculum={confirmedCurriculum}
          onRequiredConfirmed={() => setCurrentStep(2)}
          onFinalizedChange={setFinalized}
        />
      ) : (
        <CurriculumSetupScreen
          introActive={introStep !== null}
          onConfirm={confirmCurriculum}
        />
      )}
    </div>
  );
}
