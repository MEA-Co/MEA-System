'use client';

import { Eye } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxKeywordScreenData,
  type MaterialBoxKeywordScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import { KeywordExamples } from '@/app/(private)/consulting/material-box/_screens/_components/KeywordExamples';
import { KeywordInput } from '@/app/(private)/consulting/material-box/_screens/_components/KeywordInput';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Button } from '@/components/ui/button';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

const keywordMessages = [
  {
    segments: [
      {
        text: '좋습니다! 그런데 전공은 사실 아주 광범위한 내용을 다룬답니다. 여러분이 여러분만의 서사를 담아내려면, 전공 별로 ',
      },
      { text: "'세부 키워드'", emphasis: 'strong' },
      { text: '를 선택해야 해요.' },
    ],
  },
  { segments: [{ text: '너무 어렵게 생각하지 않아도 됩니다.' }] },
  {
    segments: [
      {
        text: '이미 여러분만의 관심사가 있을 수도 있고, 조금만 생각해보면 관심 가는 분야가 나올 수도 있어요.',
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
  environment: GuidedConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const isExamplesPage = pageIndex === 2;
  const isInputPage = pageIndex === keywordMessages.length - 1;

  const submitKeyword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      setValidationMessage('관심 가는 세부 키워드를 한 개 입력해주세요.');
      return;
    }

    setValidationMessage(null);
    environment.send({ type: 'user.submit', value: normalizedKeyword });
  };

  return (
    <ConsultingScreenView>
      {isInputPage && (
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
        <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <KeywordInput
            majors={data.majors}
            keyword={keyword}
            validationMessage={validationMessage}
            onKeywordChange={(value) => {
              setKeyword(value);
              setValidationMessage(null);
            }}
            onSubmit={submitKeyword}
          />
          <MaterialBoxTable
            compact
            focus="keyword"
            majorRowCount={3}
            majors={data.majors}
            keyword={keyword.trim()}
          />
        </div>
      ) : isExamplesPage ? (
        <KeywordExamples />
      ) : (
        <MaterialBoxTable
          compact
          focus="keyword"
          majorRowCount={3}
          majors={data.majors}
        />
      )}

      <ConsultingPrompter
        animateTyping
        message={keywordMessages[pageIndex]}
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        {!isInputPage && (
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
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
