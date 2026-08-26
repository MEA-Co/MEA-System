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
  isMaterialBoxCoreValueScreenData,
  type MaterialBoxCoreValueScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

const coreValueMessages = [
  {
    segments: [
      {
        text: '전공 가치관',
        emphasis: 'accent',
      },
      {
        text: '은 여러분이 전공에 관심을 갖고 키워드들을 탐구할 때 어떤 부분을 중요하게 생각하고 다룰지, 왜 그 부분을 중요하게 생각하는지 등을 담고 있는 부분이에요.',
      },
    ],
  },
  {
    segments: [
      {
        text: '같은 키워드여도 학생들마다 중요하게 생각하는 부분이 다 다르고, 그게 ',
      },
      { text: '학생만의 특색있는 서사', emphasis: 'strong' },
      { text: '가 된답니다.' },
    ],
  },
  {
    segments: [
      {
        text: '예를 들어, 똑같이 의료 분야에 관심이 많은 학생이더라도 ',
      },
      { text: '직접적인 치료를 하려고 하는지', emphasis: 'strong' },
      { text: ', ' },
      {
        text: '제도적으로 시스템을 잘 갖추려고 하는지',
        emphasis: 'strong',
      },
      { text: ', ' },
      {
        text: '복지의 관점에서 케어를 제공하려 하는지',
        emphasis: 'strong',
      },
      { text: ' 등에 따라 모두 다른 서사가 생깁니다.' },
    ],
  },
  {
    segments: [
      {
        text: '여러분이 왜 그 키워드에 관심을 가졌고 무엇을 해결하려 하는지 적어주세요!',
      },
    ],
  },
] satisfies ReadonlyArray<ConsultingPrompterMessage>;

function MaterialBoxCoreValueScreen({
  data,
  environment,
}: {
  data: MaterialBoxCoreValueScreenData;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(
    data.startAtInput ? coreValueMessages.length - 1 : 0,
  );
  const [isInputPage, setIsInputPage] = useState(data.startAtInput);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
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
  const value = environment.draftValue || data.coreValue || '';
  const isLastExplanation = pageIndex === coreValueMessages.length - 1;

  const reviewValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      setValidationMessage(
        '키워드에 관심을 가진 이유와 해결하고 싶은 문제를 작성해주세요.',
      );
      return;
    }

    setValidationMessage(null);
    setIsTypingComplete(false);
    setIsReviewing(true);
  };

  const confirmValue = () => {
    environment.send({ type: 'user.submit', value: value.trim() });
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
            setIsTypingComplete(false);
            setPageIndex(0);
            setIsInputPage(false);
          }}
        >
          <Eye aria-hidden="true" />
          설명 다시 보기
        </Button>
      )}

      <form onSubmit={reviewValue} className="mx-auto w-full max-w-4xl">
        <MaterialBoxTable
          animateEntrance={false}
          focus="motivation"
          initialFocus="story"
          majorRowCount={majorRowCount}
          majors={majors}
          keywords={keywords}
          studentStory={data.studentStory}
          coreValueContent={
            isInputPage && !isReviewing ? (
              <div className="min-w-0">
                <label htmlFor="core-value" className="sr-only">
                  전공 가치관
                </label>
                <Textarea
                  id="core-value"
                  value={value}
                  autoFocus
                  rows={3}
                  maxLength={180}
                  aria-invalid={Boolean(validationMessage)}
                  aria-describedby={
                    validationMessage ? 'core-value-error' : undefined
                  }
                  placeholder="왜 이 키워드에 관심을 가졌고, 무엇을 해결하고 싶은지 적어주세요"
                  onChange={(event) => {
                    environment.onDraftChange(event.target.value);
                    setValidationMessage(null);
                  }}
                  className="min-h-24 resize-y bg-background font-medium shadow-none"
                />
              </div>
            ) : isReviewing ? (
              <span className="block font-medium leading-6 text-foreground">
                {value.trim()}
              </span>
            ) : undefined
          }
        />

        {isInputPage && !isReviewing && validationMessage && (
          <p
            id="core-value-error"
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
                    text: '잘 작성했나요? 입력한 가치관에 키워드에 관심을 가진 이유와 중요하게 생각하는 부분, 해결하고 싶은 문제가 잘 담겼는지 확인해주세요.',
                  },
                ],
              }
            : coreValueMessages[pageIndex]
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
              onClick={confirmValue}
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

                setPageIndex((current) => current + 1);
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

export const materialBoxCoreValueScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxCoreValueScreenData,
  render: (request, environment) => (
    <MaterialBoxCoreValueScreen
      data={request.data as MaterialBoxCoreValueScreenData}
      environment={environment}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
