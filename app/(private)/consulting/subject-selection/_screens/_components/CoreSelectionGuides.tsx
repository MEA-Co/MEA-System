import type {
  CareerGuideStep,
  RequirementGuideStep,
} from '../../_lib/session-types';

import { TutorialBubble } from './CourseSelectionTutorial';

export function CareerGuide({
  step,
  steps,
  department,
  onChange,
}: {
  step: CareerGuideStep;
  steps: CareerGuideStep[];
  department: string;
  onChange: (step: CareerGuideStep | null) => void;
}) {
  const index = steps.indexOf(step);
  const title = {
    purpose: `지금부터는 직접 과목을 선택해볼 차례에요. ${department} 진학을 위해 꼭 들을 과목만 먼저 확정해요`,
    subcore: '보라색 서브코어는 MEA가 추천하는 과목이에요',
    university: '위쪽의 대학별 권장과목도 함께 참고해 주세요',
    capacity: '학기 옆 숫자는 선택 현황이에요. 지금 다 채우지 않아도 돼요',
  }[step];
  return (
    <TutorialBubble
      step={`진로 과목 안내 ${index + 1}/${steps.length}`}
      title={title}
      actionLabel={
        index === steps.length - 1 ? '이해했어요 · 과목 고르기' : '다음'
      }
      onAction={() => onChange(steps[index + 1] ?? null)}
      onBack={index > 0 ? () => onChange(steps[index - 1]) : undefined}
      onSkip={() => onChange(null)}
    >
      {step === 'purpose' ? (
        <p>
          이 단계에서는 이 학과에 가기 위해 반드시 듣겠다고 마음먹은 과목만
          골라주세요. 아직 고민 중인 과목은 비워 두어도 됩니다. 이후 과목 선택
          단계에서 관심 분야와 다른 진로를 함께 이야기하며 결정할 수 있어요.
        </p>
      ) : null}
      {step === 'subcore' ? (
        <p>
          서브코어는 MEA가 전공의 기초를 보완하는 데 도움이 된다고 분류한
          추천과목입니다. 필수로 분류되지는 않아서 자동으로 확정하지 않았지만,
          여건이 된다면 수강을 추천합니다. 파란색 추천 과목군은 관심에 따라
          배움을 넓힐 후보예요.
        </p>
      ) : null}
      {step === 'university' ? (
        <div className="space-y-2">
          <p>
            대학별 권장과목 역시 모두 반드시 들어야 한다는 뜻은 아닙니다. 다만,
            대학 수업에 필요한 기초를 준비하는 과목이므로, 개설·이수 여건이
            된다면 수강을 추천합니다. 참고로 경희대는 핵심과목과 권장과목을
            나누어 안내합니다.
          </p>
          <p>
            ‘연세대학교 - 과학 진로선택 3과목 이상’처럼 정해진 수를 고르는
            조건은 각 과목에 ‘권장 후보’로 표시합니다. 후보를 전부 들을 필요는
            없어요. 대학 카드의 ‘현재 2/3과목 · 1과목 더 선택’ 같은 현황을 보며
            골라주세요. 이미 이수했거나 학교 지정·코어로 반영한 과목도 함께
            계산합니다.
          </p>
        </div>
      ) : null}
      {step === 'capacity' ? (
        <div className="space-y-2">
          <p>
            학기 옆 n/n은 전체 선택 자리 중 현재 선택한 수입니다. 앞에서 확정한
            코어는 이미 포함되어 있어요. 주선택군·보조선택군마다 남은 자리도
            확인할 수 있어요.
          </p>
          <p>
            지금은 모든 자리를 채우는 단계가 아닙니다.{' '}
            <strong className="font-semibold text-red-700 dark:text-red-400">
              이 학과를 위해 꼭 들을 과목만 고르고, 고민되는 과목은 다음 단계로
              넘겨주세요.
            </strong>
          </p>
        </div>
      ) : null}
    </TutorialBubble>
  );
}

export function RequirementGuide({
  step,
  steps,
  activeRequirement,
  remaining,
  onChange,
}: {
  step: RequirementGuideStep;
  steps: RequirementGuideStep[];
  activeRequirement: {
    label: string;
    unit: string;
    minimum: number;
    current: number;
  };
  remaining: number;
  onChange: (step: RequirementGuideStep | null) => void;
}) {
  const index = steps.indexOf(step);
  return (
    <TutorialBubble
      step={`필수 이수 안내 ${index + 1}/${steps.length}`}
      title={
        step === 'credits'
          ? '졸업에 필요한 이수 조건을 먼저 채워봅시다'
          : step === 'courses'
            ? '이 조건을 채울 수 있는 과목만 모았어요'
            : '3학년 2학기에 듣는 방법도 있어요'
      }
      actionLabel={
        index === steps.length - 1 ? '이해했어요 · 과목 고르기' : '다음'
      }
      onAction={() => onChange(steps[index + 1] ?? null)}
      onBack={index > 0 ? () => onChange(steps[index - 1]) : undefined}
      onSkip={() => onChange(null)}
    >
      {step === 'credits' ? (
        <p>
          {activeRequirement.unit === '학점'
            ? `졸업하려면 ${activeRequirement.label} 과목군에서 ${activeRequirement.minimum}학점 이상을 들어야 해요.`
            : `학교 편제에 따라 ${activeRequirement.label}에서 ${activeRequirement.minimum}과목 이상을 선택해야 해요.`}{' '}
          학교 지정 과목과 앞에서 확정한 과목을 합쳐 현재{' '}
          {activeRequirement.current}
          {activeRequirement.unit}을 반영했어요.{' '}
          {remaining > 0
            ? `${remaining}${activeRequirement.unit}이 부족하니 이 조건부터 채워봅시다.`
            : '이 조건은 이미 충족했어요. 선택을 확정하면 다음 조건으로 넘어갑니다.'}
        </p>
      ) : null}
      {step === 'courses' ? (
        <p>
          그래서 아래에는 지금 부족한 조건에 해당하는 과목들만 보여주고 있어요.
          이 중 듣고 싶은 과목을 골라주세요. 선택하면 반영 학점과 부족한 양이
          바로 바뀝니다. 조건을 채운 뒤 확정하면 다음 과목군으로 넘어갑니다.
        </p>
      ) : null}
      {step === 'late-term' ? (
        <div className="space-y-2">
          <p>
            현역 수시에서는 일반적으로 3학년 1학기까지의 성적을 반영하므로,
            3학년 2학기 성적은 해당 수시 평가에 포함되지 않아요. 이전 학기에
            먼저 듣고 싶은 과목이 있다면, 이수 조건을 채울 과목을 3-2에 배치하는
            것도 방법입니다.
          </p>
          <p>
            다만 정시, 재수의 학생부 평가에는 3-2 기록도 반영된다는 사실은
            기억해주세요.
          </p>
        </div>
      ) : null}
    </TutorialBubble>
  );
}
