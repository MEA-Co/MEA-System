import { cn } from '@/lib/utils';

import type { StageIntro } from '../../_lib/session-types';

import { TutorialBubble } from './CourseSelectionTutorial';

export function CoreStageProgress({
  stageIndex,
  stageIntro,
  onContinue,
  onDismiss,
}: {
  stageIndex: number;
  stageIntro: StageIntro;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      id="required-stage-intro"
      className="relative grid grid-cols-2 gap-x-2 scroll-mt-4 md:grid-cols-4"
    >
      {stageIntro ? (
        <div className="fixed inset-0 z-30 bg-black/20" aria-hidden="true" />
      ) : null}
      <ol
        aria-label="필수 과목 확정 순서"
        className={cn('col-span-full grid grid-cols-2 gap-2 md:grid-cols-4')}
      >
        {['코어 확정', '진로 과목 확정', '필수 이수 충족', '최종 확인'].map(
          (label, index) => (
            <li
              key={label}
              aria-current={index === stageIndex ? 'step' : undefined}
              className={cn(
                'rounded-lg border px-3 py-3 text-sm',
                index === stageIndex &&
                  'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900',
                index < stageIndex && 'text-muted-foreground',
                stageIntro &&
                  index === stageIndex &&
                  'relative z-40 ring-4 ring-emerald-400/20',
              )}
            >
              {index < stageIndex ? '✓' : index + 1} {label}
            </li>
          ),
        )}
      </ol>
      {stageIntro ? (
        <TutorialBubble
          className={cn(
            'col-span-2 min-w-0',
            stageIntro === 'core'
              ? 'md:col-start-1'
              : stageIntro === 'career'
                ? 'md:col-start-2'
                : 'md:col-start-3',
          )}
          arrowClassName={cn(
            '-translate-x-1/2',
            stageIntro === 'requirement' || stageIntro === 'core'
              ? 'left-1/4'
              : 'left-3/4',
            stageIntro === 'career' && 'md:left-1/4',
          )}
          step={
            stageIntro === 'core'
              ? '1 · 코어 확정'
              : stageIntro === 'career'
                ? '2 · 진로 과목 확정'
                : stageIntro === 'requirement'
                  ? '3 · 필수 이수 충족'
                  : '4 · 최종 확인'
          }
          title={
            stageIntro === 'core'
              ? '필수 과목 확정은 총 4가지 스텝으로 진행돼요'
              : stageIntro === 'career'
                ? '이제 진로를 위해 꼭 듣기로 할 과목을 고르는 단계예요'
                : stageIntro === 'requirement'
                  ? '이제 졸업에 필요한 이수조건을 채우는 단계예요'
                  : '이수조건을 충족했어요. 최종 확인으로 넘어갈게요'
          }
          actionLabel={
            stageIntro === 'core'
              ? '확인 · 코어 살펴보기'
              : stageIntro === 'review'
                ? '확인 · 최종 점검'
                : '확인 · 다음 안내'
          }
          onAction={onContinue}
          onSkip={onDismiss}
        >
          {stageIntro === 'core' ? (
            <div className="space-y-2">
              <p>
                이번 필수 과목 확정 단계에서는 전공의 기초와 졸업에 필요한
                과목을 먼저 정합니다. ① 코어 확정 → ② 진로 과목 확정 → ③ 필수
                이수 충족 → ④ 최종 확인, 총 4가지 스텝으로 이루어져 있어요.
              </p>
              <p>
                첫 스텝은 MEA가 희망 전공의 필수 과목으로 지정한 코어를 보여주는
                단계입니다. 코어는 기본적으로 자동 선택되어, 확정 후에는 다음
                스텝에서도 고정됩니다. 여러 학기에 개설된 과목은 들을 학기를
                먼저 골라 주세요.
              </p>
            </div>
          ) : stageIntro === 'career' ? (
            '앞에서 확정한 코어는 그대로 유지합니다. 지금은 Sub core와 대학별 권장과목을 살펴보고, 이 진로를 위해 꼭 듣겠다고 결정한 과목만 추가로 확정해요. 남은 선택 자리를 모두 채울 필요는 없어요.'
          ) : stageIntro === 'requirement' ? (
            '진로 과목 선택을 마쳤다면, 학교지정·1학년 이수 과목과 지금까지 확정한 과목을 바탕으로 부족한 예술·통합 영역 및 등록된 학교별 이수조건을 확인해요. 이어지는 안내에서 부족한 조건과 채울 수 있는 과목을 살펴볼게요.'
          ) : (
            '마지막 스텝에서는 확정한 과목과 이수조건을 함께 확인합니다. 대학별 권장조건이 부족하면 아래에서 놓친 과목을 추가할 수 있어요. 수강을 추천하지만 의무는 아니므로, 고민된다면 선택하지 않고 다음 단계에서 더 이야기해도 괜찮아요. 이미 충족했다면 그대로 넘어가면 됩니다.'
          )}
        </TutorialBubble>
      ) : null}
    </div>
  );
}
