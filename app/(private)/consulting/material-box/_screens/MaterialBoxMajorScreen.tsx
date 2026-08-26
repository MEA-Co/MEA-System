'use client';

import { Undo2 } from 'lucide-react';
import { type FormEvent, type ReactNode } from 'react';
import { useState } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

const majorMessages = [
  { segments: [{ text: '전공부터 시작해봅시다.' }] },
  { segments: [{ text: '희망 전공은 하나일 수도 있고' }] },
  { segments: [{ text: '여러 개일 수도 있습니다.' }] },
  {
    segments: [
      {
        text: '희망 전공이 하나라면 1개만, 희망 전공이 여러 개라면 3개까지 입력해주세요.',
      },
    ],
  },
] satisfies ReadonlyArray<ConsultingPrompterMessage>;

function MajorInput({
  majors,
  validationMessage,
  onMajorChange,
  onSubmit,
}: {
  majors: ReadonlyArray<string>;
  validationMessage: string | null;
  onMajorChange: (index: number, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-4xl">
      <MaterialBoxTable
        focus="major"
        majorRowCount={3}
        renderMajorCell={(index) => (
          <div className="min-w-0" key={index}>
            <label htmlFor={`major-${index}`} className="sr-only">
              {index + 1}순위 희망 전공
            </label>
            <Input
              id={`major-${index}`}
              value={majors[index]}
              autoFocus={index === 0}
              maxLength={60}
              aria-invalid={Boolean(validationMessage)}
              placeholder={
                index === 0 ? '희망 전공을 입력하세요' : '추가 희망 전공 (선택)'
              }
              onChange={(event) => onMajorChange(index, event.target.value)}
              className="h-9 min-w-0 bg-background font-medium shadow-none"
            />
          </div>
        )}
      />

      {validationMessage && (
        <p
          className="mt-3 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {validationMessage}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <ConsultingProgressButton type="submit">
          입력 확인하기
        </ConsultingProgressButton>
      </div>
    </form>
  );
}

function MaterialBoxMajorScreen({
  environment,
}: {
  environment: ConsultingScreenRenderEnvironment;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [majors, setMajors] = useState(['', '', '']);
  const [isReviewing, setIsReviewing] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const isInputPage = pageIndex === majorMessages.length - 1;
  const normalizedMajors = majors.map((major) => major.trim()).filter(Boolean);
  const confirmedMajorRowCount =
    normalizedMajors.length === 1 ? 1 : normalizedMajors.length === 2 ? 2 : 3;

  const updateMajor = (index: number, value: string) => {
    setValidationMessage(null);
    setMajors((current) =>
      current.map((major, majorIndex) =>
        majorIndex === index ? value : major,
      ),
    );
  };

  const reviewInput = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (normalizedMajors.length === 0) {
      setValidationMessage('희망 전공을 한 개 이상 입력해주세요.');
      return;
    }

    setValidationMessage(null);
    setIsTypingComplete(false);
    setIsReviewing(true);
  };

  const confirmInput = () => {
    environment.send({
      type: 'user.submit',
      value: JSON.stringify(normalizedMajors),
    });
  };

  return (
    <ConsultingScreenView>
      {isReviewing ? (
        <MaterialBoxTable
          focus="major"
          majorRowCount={confirmedMajorRowCount}
          majors={normalizedMajors}
        />
      ) : isInputPage ? (
        <MajorInput
          majors={majors}
          validationMessage={validationMessage}
          onMajorChange={updateMajor}
          onSubmit={reviewInput}
        />
      ) : (
        <MaterialBoxTable
          focus="major"
          majorRowCount={pageIndex >= 2 ? 3 : 1}
        />
      )}

      <ConsultingPrompter
        animateTyping
        message={
          isReviewing
            ? {
                segments: [
                  {
                    text: '잘 작성했나요? 희망 전공은 학교를 다니면서 얼마든지 달라질 수 있습니다. 중요한 것은 지금 여러분의 관심사와 목표입니다.',
                  },
                ],
              }
            : majorMessages[pageIndex]
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
              onClick={confirmInput}
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

export const materialBoxMajorScreen = {
  mode: 'static',
  render: (_request, environment) => (
    <MaterialBoxMajorScreen environment={environment} />
  ),
} satisfies ConsultingRendererEntry<
  ConsultingScreenRenderEnvironment,
  ReactNode
>;
