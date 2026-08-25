'use client';

import { Eye, Lightbulb } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type FormEvent, type ReactNode, useState } from 'react';

import { ConsultingProgressButton } from '@/app/(private)/consulting/_components/ConsultingProgressButton';
import {
  ConsultingPrompter,
  type ConsultingPrompterMessage,
} from '@/app/(private)/consulting/_components/ConsultingPrompter';
import { ConsultingScreenView } from '@/app/(private)/consulting/_components/ConsultingScreenView';
import type { ConsultingScreenRenderEnvironment } from '@/app/(private)/consulting/_lib/renderer';
import {
  isMaterialBoxProgressScreenData,
  type MaterialBoxProgressScreenData,
} from '@/app/(private)/consulting/material-box/_lib/types';
import {
  MaterialBoxTable,
  type MaterialBoxTableFocus,
} from '@/app/(private)/consulting/material-box/_screens/_components/MaterialBoxTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultingRendererEntry } from '@/features/consulting/core/renderer';

export type MaterialBoxReflectionId =
  'career-identity' | 'core-value' | 'field-strength' | 'personal-strength';

type MaterialBoxReflectionContent = {
  step: number;
  focus: MaterialBoxTableFocus;
  message: ConsultingPrompterMessage;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  example: string;
  validationMessage: string;
  multiline: boolean;
  maxLength: number;
};

const reflectionContent: Record<
  MaterialBoxReflectionId,
  MaterialBoxReflectionContent
> = {
  'career-identity': {
    step: 1,
    focus: 'interest',
    message: {
      segments: [
        {
          text: "좋아요. 이제 이 키워드를 바탕으로 궁극적으로 되고 싶은 모습을 하나의 명사형 진로로 붙여볼게요. '무엇을 하는 사람'인지 선명하게 이름 지어보세요.",
        },
      ],
    },
    title: '진로의 모습을 이름 붙여보세요',
    description:
      '궁극적으로 하고 싶은 일을 행동이 아닌 명사형 진로로 표현해보세요.',
    label: '나의 진로 명칭',
    placeholder: '예: 의료 접근성 문제를 해결하는 보건 정책가',
    example: '기후 위기에 대응하는 친환경 모빌리티 엔지니어',
    validationMessage: '궁극적으로 하고 싶은 진로의 명칭을 작성해 주세요.',
    multiline: false,
    maxLength: 80,
  },
  'core-value': {
    step: 2,
    focus: 'motivation',
    message: {
      segments: [
        {
          text: '진로의 이름을 정했다면, 이제 그 일을 통해 지키고 싶은 가치를 찾아볼 차례예요. 관심 분야에서 아직 해결되지 않은 문제에 시선을 두어보세요.',
        },
      ],
    },
    title: '중요하게 생각하는 가치를 적어보세요',
    description:
      '관심 분야에서 아직 해결되지 않은 문제와, 그 문제를 바꾸고 싶은 이유에 집중해보세요.',
    label: '내가 중요하게 생각하는 가치',
    placeholder:
      '예: 사는 지역과 관계없이 누구나 필요한 의료 정보를 얻을 수 있어야 한다.',
    example: '기술의 발전이 정보 취약계층을 소외시키지 않아야 한다.',
    validationMessage: '관심 분야에서 중요하게 생각하는 가치를 작성해 주세요.',
    multiline: true,
    maxLength: 180,
  },
  'field-strength': {
    step: 3,
    focus: 'approach',
    message: {
      segments: [
        {
          text: '그 문제를 해결할 때 여러분은 어떤 힘을 발휘할 수 있을까요? 잘하는 과목과 잘하는 이유를 연결하면 강점이 더 구체적으로 보입니다.',
        },
      ],
    },
    title: '분야에서 발휘할 강점과 역량을 찾아보세요',
    description:
      '잘하는 과목이나 활동을 떠올리고, 왜 잘하는지까지 연결해 구체적으로 적어보세요.',
    label: '나의 강점 또는 역량',
    placeholder:
      '예: 생명과학에서 개념 간 인과관계를 잘 찾는다. 현상을 단계별로 설명하는 습관이 있기 때문이다.',
    example:
      '수학 문제를 여러 방식으로 풀어보고 가장 간결한 풀이를 찾는 데 강하다.',
    validationMessage:
      '관심 분야에서 발휘할 수 있는 강점이나 역량을 작성해 주세요.',
    multiline: true,
    maxLength: 180,
  },
  'personal-strength': {
    step: 4,
    focus: 'approach',
    message: {
      segments: [
        {
          text: '마지막으로 성적이나 진로와 바로 연결되지 않아도 괜찮아요. 평소 반복하는 습관과 자연스럽게 드러나는 장점을 떠올려보세요.',
        },
      ],
    },
    title: '평소의 습관과 나다운 장점을 담아보세요',
    description:
      '학업이나 진로 역량과 직접 연결되지 않아도 괜찮습니다. 자연스럽게 반복하는 행동과 성향을 떠올려보세요.',
    label: '나의 습관 또는 추상적인 장점',
    placeholder:
      '예: 사람의 이야기를 끝까지 듣고, 기억하고 싶은 내용을 바로 메모하는 습관이 있다.',
    example: '책 읽기를 좋아한다 · 창의적이다 · 손이 여물다',
    validationMessage: '평소 가지고 있는 습관이나 나다운 장점을 작성해 주세요.',
    multiline: true,
    maxLength: 180,
  },
};

function ReflectionInput({
  content,
  value,
  validationMessage,
  onValueChange,
  onSubmit,
}: {
  content: MaterialBoxReflectionContent;
  value: string;
  validationMessage: string | null;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const inputId = `material-reflection-${content.step}`;

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="w-full"
    >
      <section className="rounded-2xl border bg-background/90 p-5 shadow-sm md:p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            재료함 확장 {content.step}/4
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            최대 {content.maxLength}자
          </span>
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-[-0.02em]">
          {content.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {content.description}
        </p>

        <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/6 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <Lightbulb className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                이렇게 생각해볼 수 있어요
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground/80">
                {content.example}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor={inputId} className="text-sm font-semibold">
            {content.label}
          </label>
          {content.multiline ? (
            <Textarea
              id={inputId}
              value={value}
              autoFocus
              rows={4}
              maxLength={content.maxLength}
              placeholder={content.placeholder}
              aria-invalid={Boolean(validationMessage)}
              onChange={(event) => onValueChange(event.target.value)}
              className="mt-3 min-h-32 resize-y bg-background"
            />
          ) : (
            <Input
              id={inputId}
              value={value}
              autoFocus
              maxLength={content.maxLength}
              placeholder={content.placeholder}
              aria-invalid={Boolean(validationMessage)}
              onChange={(event) => onValueChange(event.target.value)}
              className="mt-3 bg-background"
            />
          )}

          {validationMessage && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {validationMessage}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end border-t pt-5">
          <ConsultingProgressButton type="submit">
            {content.step === 4 ? '재료함 완성하기' : '다음으로'}
          </ConsultingProgressButton>
        </div>
      </section>
    </motion.form>
  );
}

function MaterialBoxReflectionScreen({
  reflectionId,
  data,
  environment,
}: {
  reflectionId: MaterialBoxReflectionId;
  data: MaterialBoxProgressScreenData;
  environment: ConsultingScreenRenderEnvironment;
}) {
  const content = reflectionContent[reflectionId];
  const [isInputPage, setIsInputPage] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [value, setValue] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const submitValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      setValidationMessage(content.validationMessage);
      return;
    }

    setValidationMessage(null);
    environment.send({ type: 'user.submit', value: normalizedValue });
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
            setIsInputPage(false);
          }}
        >
          <Eye aria-hidden="true" />
          설명 다시 보기
        </Button>
      )}

      {isInputPage ? (
        <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <ReflectionInput
            content={content}
            value={value}
            validationMessage={validationMessage}
            onValueChange={(nextValue) => {
              setValue(nextValue);
              setValidationMessage(null);
            }}
            onSubmit={submitValue}
          />
          <MaterialBoxTable
            compact
            focus={content.focus}
            majorRowCount={3}
            majors={data.majors}
            keyword={data.keyword}
            careerIdentity={data.careerIdentity}
            coreValue={data.coreValue}
            fieldStrength={data.fieldStrength}
            personalStrength={data.personalStrength}
          />
        </div>
      ) : (
        <MaterialBoxTable
          compact
          focus={content.focus}
          majorRowCount={3}
          majors={data.majors}
          keyword={data.keyword}
          careerIdentity={data.careerIdentity}
          coreValue={data.coreValue}
          fieldStrength={data.fieldStrength}
          personalStrength={data.personalStrength}
        />
      )}

      <ConsultingPrompter
        key={isInputPage ? 'input' : 'explanation'}
        animateTyping={!isInputPage}
        message={content.message}
        onTypingComplete={() => setIsTypingComplete(true)}
      >
        {!isInputPage && (
          <ConsultingProgressButton
            compact
            disabled={!isTypingComplete}
            spacebarShortcut
            onClick={() => {
              setIsTypingComplete(false);
              setIsInputPage(true);
            }}
          >
            입력하기
          </ConsultingProgressButton>
        )}
      </ConsultingPrompter>
    </ConsultingScreenView>
  );
}

export function createMaterialBoxReflectionScreen(
  reflectionId: MaterialBoxReflectionId,
) {
  return {
    mode: 'dynamic',
    validateData: isMaterialBoxProgressScreenData,
    render: (request, environment) => (
      <MaterialBoxReflectionScreen
        reflectionId={reflectionId}
        data={request.data as MaterialBoxProgressScreenData}
        environment={environment}
      />
    ),
  } satisfies ConsultingRendererEntry<
    ConsultingScreenRenderEnvironment,
    ReactNode
  >;
}
