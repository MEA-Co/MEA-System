'use client';

import { Eye, Undo2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { ConsultingPreviousButton } from '@/app/(private)/consulting/_components/ConsultingPreviousButton';
import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxStrengthScreenData,
  type MaterialBoxStrengths,
  type MaterialBoxStrengthScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

const strengthLabels = [
  '순수 계열 적합 역량',
  '전공 계열 적합 역량',
  '차별화 역량',
] as const;

const strengthPlaceholders = [
  '잘하는 과목, 잘하는 이유와 나만의 공부 방식을 적어주세요',
  '전공에서 중요하게 여기는 역량과 나의 강점이 만나는 지점을 적어주세요',
  '전공이나 공부 밖에서도 드러나는 나다운 장점을 적어주세요',
] as const;

const strengthMessages = [
  {
    segments: [
      {
        text: '가치관을 결정했다면, 여러분이 그 가치관을 실현할 수 있다는 것을 보여줘야 해요. 그런 여러분들만의 역량을 ',
      },
      { text: '계열 적합 역량', emphasis: 'accent' },
      { text: '이라고 합니다.' },
    ],
  },
  {
    segments: [{ text: '계열 적합 역량은 3가지로 구분됩니다.' }],
  },
  {
    segments: [
      { text: '순수 계열 적합 역량', emphasis: 'accent' },
      {
        text: '은 학과와 직접 연결되지 않더라도 관련 계열이나 과목에서 보이는 강점과 그 이유예요. 아직 진로를 깊이 고민하지 않았더라도 “무슨 과목을 잘하는지”, “왜 잘하는지”, “어떤 방식으로 공부하는지”부터 떠올리면 찾을 수 있습니다.',
      },
    ],
  },
  {
    segments: [
      {
        text: '예를 들어 도표를 그리며 공부하거나, 시사 뉴스를 통해 배경지식을 쌓거나, 내용을 구조화해 암기하고 비교·분석하는 힘이 여기에 해당해요. 관심사가 구체화되어도 이어갈 수 있어 학년이 달라져도 일관성을 보여주는 역량의 시작점이 됩니다.',
      },
    ],
  },
  {
    segments: [
      { text: '전공 계열 적합 역량', emphasis: 'accent' },
      {
        text: '은 희망 학과와 직접 맞닿아 있는 강점이에요. 먼저 그 전공에서 실제로 중요하게 여기는 역량을 구체적인 사례로 이해한 뒤, “내 강점 중 이 분야와 특히 맞닿아 있는 것은 무엇인지” 생각해보세요.',
      },
    ],
  },
  {
    segments: [
      {
        text: '학과가 요구하는 역량에서 바로 찾을 수도 있고, 앞서 발견한 순수 계열 적합 역량이 전공을 만났을 때 어떤 강점으로 발전하는지 연결해 찾을 수도 있습니다.',
      },
    ],
  },
  {
    segments: [
      { text: '차별화 역량', emphasis: 'accent' },
      {
        text: '은 전공이나 학습 능력 밖에서도 드러나는 학생의 인간다운 장점이에요. 생활기록부는 특정 학과에 맞춘 모습만이 아니라 학생이라는 사람 자체를 보여주는 기록입니다.',
      },
    ],
  },
  {
    segments: [
      {
        text: '리더십이 뛰어나거나, 성실하거나, 책을 많이 읽거나, 영어로 자유롭게 소통하거나, 발표를 잘하는 것처럼 여러분을 다른 사람과 구분해주는 장점을 떠올려보세요.',
      },
    ],
  },
] satisfies ReadonlyArray<ConsultingPrompterMessage>;

type StrengthValues = [string, string, string];
const strengthIntroPageCount = 2;
const strengthFocusByPage = [null, null, 0, 0, 1, 1, 2, 2] as const;

function parseDraft(
  draftValue: string,
  data: MaterialBoxStrengthScreenData,
): StrengthValues {
  if (draftValue) {
    try {
      const parsed = JSON.parse(draftValue) as Partial<MaterialBoxStrengths>;

      if (
        typeof parsed.pureFieldStrength === 'string' &&
        typeof parsed.majorFieldStrength === 'string' &&
        typeof parsed.differentiatingStrength === 'string'
      ) {
        return [
          parsed.pureFieldStrength,
          parsed.majorFieldStrength,
          parsed.differentiatingStrength,
        ];
      }
    } catch {
      // 입력 도중의 손상된 임시 값은 저장된 확정 값으로 복구합니다.
    }
  }

  return [
    data.fieldStrength ?? data.pureFieldStrengthDraft ?? '',
    data.majorFieldStrength ?? data.majorFieldStrengthDraft ?? '',
    data.personalStrength ?? '',
  ];
}

function serializeStrengths(values: StrengthValues): string {
  return JSON.stringify({
    pureFieldStrength: values[0],
    majorFieldStrength: values[1],
    differentiatingStrength: values[2],
  } satisfies MaterialBoxStrengths);
}

function MaterialBoxStrengthScreen({
  data,
  environment,
}: {
  data: MaterialBoxStrengthScreenData;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(
    data.startAtInput ? strengthMessages.length - 1 : 0,
  );
  const [isInputPage, setIsInputPage] = useState(data.startAtInput);
  const [isStrengthExpanded, setIsStrengthExpanded] = useState(
    data.startAtInput,
  );
  const [isReviewing, setIsReviewing] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [values, setValues] = useState<StrengthValues>(() =>
    parseDraft(environment.draftValue, data),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const majors = data.majorKeywords.map((entry) => entry.major);
  const keywords = data.majorKeywords.map((entry) => entry.keyword);
  const majorRowCount =
    data.majorKeywords.length === 1
      ? 1
      : data.majorKeywords.length === 2
        ? 2
        : 3;
  const normalizedValues = values.map((value) =>
    value.trim(),
  ) as StrengthValues;
  const isLastExplanation = pageIndex === strengthMessages.length - 1;

  const updateValue = (index: number, value: string) => {
    const nextValues = values.map((current, currentIndex) =>
      currentIndex === index ? value : current,
    ) as StrengthValues;

    setValues(nextValues);
    environment.onDraftChange(serializeStrengths(nextValues));
    setValidationMessage(null);
  };

  const reviewValues = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingIndex = normalizedValues.findIndex((value) => !value);

    if (missingIndex >= 0) {
      setValidationMessage(`${strengthLabels[missingIndex]}을 작성해주세요.`);
      return;
    }

    setValidationMessage(null);
    setIsTypingComplete(false);
    setIsReviewing(true);
  };

  const confirmValues = () => {
    environment.send({
      type: 'user.submit',
      value: serializeStrengths(normalizedValues),
    });
  };

  return (
    <ConsultingScreenView>
      <ConsultingPreviousButton
        disabled={!isInputPage}
        onClick={() => environment.send({ type: 'user.previous-explanation' })}
      />

      {isInputPage && !isReviewing && (
        <Button
          type="button"
          variant="outline"
          className="absolute top-4 right-3 z-30 md:right-5"
          onClick={() => {
            setPageIndex(0);
            setIsInputPage(false);
            setIsStrengthExpanded(false);
            setIsTypingComplete(false);
          }}
        >
          <Eye aria-hidden="true" />
          설명 다시 보기
        </Button>
      )}

      <form onSubmit={reviewValues} className="mx-auto w-full max-w-5xl">
        <MaterialBoxTable
          animateEntrance={false}
          animateStrengthRows
          focus="approach"
          initialFocus="motivation"
          majorRowCount={majorRowCount}
          majors={majors}
          keywords={keywords}
          studentStory={data.studentStory}
          coreValue={data.coreValue}
          strengthFocus={isInputPage ? null : strengthFocusByPage[pageIndex]}
          strengthItems={
            isStrengthExpanded
              ? strengthLabels.map((label, index) => ({
                  label,
                  value: isReviewing ? normalizedValues[index] : undefined,
                }))
              : undefined
          }
          renderStrengthCell={
            isInputPage && !isReviewing
              ? (index) => (
                  <div className="min-w-0" key={strengthLabels[index]}>
                    {index < 2 &&
                      ((index === 0 && data.pureFieldStrengthDraft) ||
                        (index === 1 && data.majorFieldStrengthDraft)) &&
                      !(
                        (index === 0 && data.fieldStrength) ||
                        (index === 1 && data.majorFieldStrength)
                      ) && (
                        <p className="mb-2 text-xs font-medium text-primary">
                          탐구 대화에서 정리된 수정 가능한 초안
                        </p>
                      )}
                    <label htmlFor={`strength-${index}`} className="sr-only">
                      {strengthLabels[index]}
                    </label>
                    <Textarea
                      id={`strength-${index}`}
                      value={values[index]}
                      autoFocus={index === 0}
                      rows={3}
                      maxLength={180}
                      aria-invalid={Boolean(validationMessage)}
                      placeholder={strengthPlaceholders[index]}
                      onChange={(event) =>
                        updateValue(index, event.target.value)
                      }
                      className="min-h-24 resize-y bg-background font-medium shadow-none"
                    />
                  </div>
                )
              : undefined
          }
        />

        {isInputPage && !isReviewing && validationMessage && (
          <p
            className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {validationMessage}
          </p>
        )}

        {isInputPage && !isReviewing && (
          <div className="mt-4 flex justify-end">
            <ConsultingProgressButton type="submit">
              입력 확인하기
            </ConsultingProgressButton>
          </div>
        )}
      </form>

      <ConsultingPrompter
        key={`${isReviewing ? 'review' : isInputPage ? 'input' : 'explanation'}-${pageIndex}`}
        animateTyping={!isInputPage || isReviewing}
        message={
          isReviewing
            ? {
                segments: [
                  {
                    text: '잘 작성했나요? 세 역량이 각각 과목과 계열에서 드러나는 강점, 희망 전공과 연결되는 강점, 여러분만의 인간적인 장점을 구분해서 보여주는지 확인해주세요.',
                  },
                ],
              }
            : strengthMessages[pageIndex]
        }
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        {isReviewing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              disabled={!isTypingComplete}
              onClick={() => {
                setIsTypingComplete(false);
                setIsReviewing(false);
              }}
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              아니오, 수정할게요
            </Button>
            <ConsultingProgressButton
              compact
              disabled={!isTypingComplete}
              onClick={confirmValues}
            >
              네, 잘 작성했어요
            </ConsultingProgressButton>
          </>
        ) : (
          !isInputPage && (
            <ConsultingProgressButton
              compact
              disabled={!isTypingComplete}
              spacebarShortcut
              onClick={() => {
                setIsTypingComplete(false);

                if (isLastExplanation) {
                  setIsInputPage(true);
                  return;
                }

                const nextPageIndex = pageIndex + 1;
                if (nextPageIndex === strengthIntroPageCount) {
                  setIsStrengthExpanded(true);
                }
                setPageIndex(nextPageIndex);
              }}
            >
              {isLastExplanation ? '입력하기' : '다음으로'}
            </ConsultingProgressButton>
          )
        )}
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const materialBoxStrengthScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxStrengthScreenData,
  render: (request, environment) => (
    <MaterialBoxStrengthScreen
      data={request.data as MaterialBoxStrengthScreenData}
      environment={environment}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
