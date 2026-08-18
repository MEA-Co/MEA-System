'use client';

import { CircleAlert, Lightbulb } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type ChangeEvent, type FormEvent, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConsultingProgressButton } from '@/features/consulting/ui/ConsultingProgressButton';
import type { MaterialReflectionScreen as MaterialReflectionScreenName } from '@/features/material-box-consulting/model/types';

type ReflectionScreenContent = {
  step: number;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  example: string;
  validationMessage: string;
  multiline: boolean;
  maxLength: number;
};

const screenContent: Record<
  MaterialReflectionScreenName,
  ReflectionScreenContent
> = {
  'career-identity-input': {
    step: 1,
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
  'core-value-input': {
    step: 2,
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
  'field-strength-input': {
    step: 3,
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
  'personal-strength-input': {
    step: 4,
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

type MaterialReflectionScreenProps = {
  screen: MaterialReflectionScreenName;
  isInteractive: boolean;
  submittedValue: string;
  onSubmit: (value: string) => void;
};

export function MaterialReflectionScreen({
  screen,
  isInteractive,
  submittedValue,
  onSubmit,
}: MaterialReflectionScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const content = screenContent[screen];
  const [value, setValue] = useState(submittedValue);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const updateValue = (nextValue: string) => {
    setValue(nextValue);
    setValidationMessage(null);
  };

  const submitValue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isInteractive) return;

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      setValidationMessage(content.validationMessage);
      return;
    }

    setValidationMessage(null);
    onSubmit(normalizedValue);
  };

  const fieldProps = {
    id: `material-reflection-${content.step}`,
    value,
    readOnly: !isInteractive,
    maxLength: content.maxLength,
    placeholder: content.placeholder,
    'aria-invalid': Boolean(validationMessage),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      updateValue(event.target.value),
  };

  return (
    <motion.form
      key={screen}
      onSubmit={submitValue}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="mx-auto min-h-112 w-full max-w-4xl pt-6 pb-56 md:pt-8 md:pb-48"
    >
      <section className="rounded-2xl border bg-background/90 p-5 shadow-sm md:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
            재료함 확장 {content.step}/4
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            최대 {content.maxLength}자
          </span>
        </div>

        <h1 className="mt-5 text-xl font-bold tracking-[-0.02em] md:text-2xl">
          {content.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">
          {content.description}
        </p>

        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/6 p-4">
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

        <div className="mt-6">
          <label
            htmlFor={fieldProps.id}
            className="text-sm font-semibold text-foreground"
          >
            {content.label}
          </label>
          {content.multiline ? (
            <Textarea
              {...fieldProps}
              rows={4}
              className="mt-3 min-h-32 resize-y bg-background"
            />
          ) : (
            <Input {...fieldProps} className="mt-3 bg-background" />
          )}

          {isInteractive && validationMessage && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {validationMessage}
            </p>
          )}
        </div>
      </section>

      {isInteractive && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: shouldReduceMotion ? 0 : 0.24 }}
          className="mt-5 flex justify-end"
        >
          <ConsultingProgressButton type="submit" />
        </motion.div>
      )}
    </motion.form>
  );
}
