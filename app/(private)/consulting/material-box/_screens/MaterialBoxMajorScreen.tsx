'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { GuidedConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import { MaterialBoxTable } from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { GuidedConsultingRendererEntry } from '@/features/guided-consulting/core/renderer';

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
  onMajorChange,
}: {
  majors: ReadonlyArray<string>;
  onMajorChange: (index: number, value: string) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <Card className="gap-0 rounded-2xl bg-background/95 py-0 shadow-sm ring-0">
        <CardContent className="p-5 md:p-6">
          <p className="text-xs font-bold tracking-[0.12em] text-blue-600 dark:text-blue-400">
            MAJOR
          </p>
          <h2 className="mt-1 text-lg font-bold">희망 전공 입력</h2>

          <div className="mt-5 space-y-3">
            {majors.map((major, index) => (
              <div
                key={index}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3"
              >
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {index + 1}순위
                </span>
                <label htmlFor={`major-${index}`} className="sr-only">
                  {index + 1}순위 희망 전공
                </label>
                <Input
                  id={`major-${index}`}
                  value={major}
                  autoFocus={index === 0}
                  maxLength={60}
                  placeholder={`${index + 1}순위 희망 전공`}
                  onChange={(event) => onMajorChange(index, event.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <MaterialBoxTable
        compact
        focus="major"
        majorRowCount={3}
        majors={majors}
      />
    </div>
  );
}

function MaterialBoxMajorScreen() {
  const [pageIndex, setPageIndex] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [majors, setMajors] = useState(['', '', '']);
  const isInputPage = pageIndex === majorMessages.length - 1;

  const updateMajor = (index: number, value: string) => {
    setMajors((current) =>
      current.map((major, majorIndex) =>
        majorIndex === index ? value : major,
      ),
    );
  };

  return (
    <ConsultingScreenView>
      {isInputPage ? (
        <MajorInput majors={majors} onMajorChange={updateMajor} />
      ) : (
        <MaterialBoxTable
          focus="major"
          majorRowCount={pageIndex >= 2 ? 3 : 1}
        />
      )}

      <ConsultingPrompter
        animateTyping
        message={majorMessages[pageIndex]}
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

export const materialBoxMajorScreen = {
  mode: 'static',
  render: () => <MaterialBoxMajorScreen />,
} satisfies GuidedConsultingRendererEntry<
  GuidedConsultingScreenRenderEnvironment,
  ReactNode
>;
