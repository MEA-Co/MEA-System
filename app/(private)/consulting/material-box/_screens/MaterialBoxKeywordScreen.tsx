'use client';

import { Eye, Undo2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import { ConsultingPreviousButton } from '@/app/(private)/consulting/_components/ConsultingPreviousButton';
import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxKeywordScreenData,
  type MaterialBoxKeywordScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { KeywordExamples } from '@/app/(private)/consulting/material-box/_screens/_components/KeywordExamples';
import { KeywordInput } from '@/app/(private)/consulting/material-box/_screens/_components/KeywordInput';
import { KeywordSuggestionDrawer } from '@/app/(private)/consulting/material-box/_screens/_components/KeywordSuggestionDrawer';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';
import { Button } from '@/components/ui/button';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

const keywordMessages = [
  {
    segments: [
      {
        text: '좋습니다! 그런데 전공은 사실 아주 광범위한 내용을 다룬답니다. 여러분이 여러분만의 서사를 담아내려면, 전공 안에서 여러분이 특별히 더 관심을 가지는 ',
      },
      { text: '세부 키워드', emphasis: 'accent' },
      { text: '가 있어야 해요.' },
    ],
  },
  { segments: [{ text: '너무 어렵게 생각하지 않아도 됩니다.' }] },
  {
    segments: [
      {
        text: '여러분이 희망 전공을 가고 싶다고 생각한 이유, 평소에 관심을 가지던 대상, ... 무엇이든 여러분만의 세부 키워드가 될 수 있습니다.',
      },
    ],
  },
  { segments: [{ text: '이제 세부 키워드를 입력해주세요!' }] },
] satisfies ReadonlyArray<ConsultingPrompterMessage>;

function MaterialBoxKeywordScreen({
  data,
  environment,
}: {
  data: MaterialBoxKeywordScreenData;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(
    data.startAtInput ? keywordMessages.length - 1 : 0,
  );
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [keywords, setKeywords] = useState<ReadonlyArray<string>>(() =>
    data.keywords.length === data.majors.length
      ? data.keywords
      : data.majors.map(() => ''),
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [selectedSuggestions, setSelectedSuggestions] = useState<
    ReadonlyArray<ReadonlyArray<KeywordSuggestion>>
  >(() =>
    data.selectedSuggestions.length === data.majors.length
      ? data.selectedSuggestions
      : data.majors.map(() => []),
  );
  const isExamplesPage = pageIndex === 2;
  const isInputPage = pageIndex === keywordMessages.length - 1;
  const majorRowCount =
    data.majors.length === 1 ? 1 : data.majors.length === 2 ? 2 : 3;
  const normalizedKeywords = keywords.map((keyword) => keyword.trim());

  const toggleSuggestion = (
    majorIndex: number,
    suggestion: KeywordSuggestion,
  ) => {
    setSelectedSuggestions((current) =>
      current.map((items, index) => {
        if (index !== majorIndex) return items;
        const isSelected = items.some(
          (item) => item.keyword === suggestion.keyword,
        );
        return isSelected
          ? items.filter((item) => item.keyword !== suggestion.keyword)
          : [...items, suggestion];
      }),
    );
  };

  const applySelectedSuggestions = () => {
    setKeywords((current) =>
      current.map((keyword, index) => {
        const selected = selectedSuggestions[index] ?? [];
        return selected.length > 0
          ? selected.map((suggestion) => suggestion.keyword).join(', ')
          : keyword;
      }),
    );
    setValidationMessage(null);
  };

  const reviewKeyword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingKeywordIndex = normalizedKeywords.findIndex(
      (keyword) => !keyword,
    );

    if (missingKeywordIndex >= 0) {
      setValidationMessage(
        `${data.majors[missingKeywordIndex]}의 세부 키워드를 입력해주세요.`,
      );
      return;
    }

    setValidationMessage(null);
    setIsTypingComplete(false);
    setIsReviewing(true);
  };

  const confirmKeyword = () => {
    environment.send({
      type: 'user.submit',
      value: JSON.stringify(
        data.majors.map((major, index) => ({
          major,
          keyword: normalizedKeywords[index],
          selectedSuggestions: selectedSuggestions[index] ?? [],
        })),
      ),
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
            setIsTypingComplete(false);
            setPageIndex(0);
          }}
        >
          <Eye aria-hidden="true" />
          설명 다시 보기
        </Button>
      )}

      {isInputPage ? (
        <KeywordInput
          isReviewing={isReviewing}
          majors={data.majors}
          keywords={isReviewing ? normalizedKeywords : keywords}
          validationMessage={validationMessage}
          onKeywordChange={(index, value) => {
            setKeywords((current) =>
              current.map((keyword, keywordIndex) =>
                keywordIndex === index ? value : keyword,
              ),
            );
            setValidationMessage(null);
          }}
          onSubmit={reviewKeyword}
          keywordSuggestionAction={
            <KeywordSuggestionDrawer
              majors={data.majors}
              selectedSuggestions={selectedSuggestions}
              onToggle={toggleSuggestion}
              onApply={applySelectedSuggestions}
              onRetry={() => environment.send({ type: 'user.retry' })}
            />
          }
        />
      ) : isExamplesPage ? (
        <KeywordExamples />
      ) : (
        <MaterialBoxTable
          animateEntrance={pageIndex > 0}
          focus="keyword"
          initialFocus="major"
          majorRowCount={majorRowCount}
          majors={data.majors}
        />
      )}

      <ConsultingPrompter
        animateTyping
        message={
          isReviewing
            ? {
                segments: [
                  {
                    text: '잘 작성했나요? 입력한 세부 키워드가 각 희망 전공에서 여러분이 관심 있는 분야를 잘 보여주는지 확인해주세요.',
                  },
                ],
              }
            : keywordMessages[pageIndex]
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
              onClick={confirmKeyword}
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
                setPageIndex((current) => current + 1);
              }}
            >
              다음으로
            </ConsultingProgressButton>
          )
        )}
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export const materialBoxKeywordScreen = {
  mode: 'dynamic',
  validateData: isMaterialBoxKeywordScreenData,
  render: (request, environment) => (
    <MaterialBoxKeywordScreen
      data={request.data as MaterialBoxKeywordScreenData}
      environment={environment}
    />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
