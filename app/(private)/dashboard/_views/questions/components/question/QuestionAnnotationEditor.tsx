'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { questionExplanationClass, questionStyles } from './question-styles';
import { QuestionRichTextEditor } from './QuestionRichTextEditor';

/** Shared title/body card for question explanations and review requests. */
export function QuestionAnnotationEditor({
  id,
  label,
  title,
  text,
  onTitleChange,
  onTextChange,
  actions,
  children,
  titlePlaceholder = '항목 제목 (예: 예시)',
  authoring = false,
  disabled = false,
  required = false,
  titleMaxLength,
  textMaxLength,
}: {
  id: string;
  label: string;
  title?: string;
  text: string;
  onTitleChange?: (value: string) => void;
  onTextChange: (value: string) => void;
  actions?: ReactNode;
  children?: ReactNode;
  titlePlaceholder?: string;
  authoring?: boolean;
  disabled?: boolean;
  required?: boolean;
  titleMaxLength?: number;
  textMaxLength?: number;
}) {
  const surfaceClassName = authoring
    ? questionExplanationClass
    : onTitleChange
      ? questionStyles.explanation
      : 'rounded-xl border bg-muted/20 p-4';

  return (
    <div className={surfaceClassName}>
      <div
        className={
          authoring
            ? 'mb-2 flex flex-wrap items-start justify-between gap-3'
            : 'mb-3 flex flex-wrap items-center justify-between gap-2'
        }
      >
        {authoring && onTitleChange ? (
          <Input
            id={`${id}-title`}
            aria-label={`${label} 제목`}
            value={title ?? ''}
            placeholder={titlePlaceholder}
            className="h-10 min-w-40 flex-1 rounded-lg bg-neutral-200/70 px-3 text-sm font-semibold shadow-none dark:bg-neutral-800"
            disabled={disabled}
            required={required}
            maxLength={titleMaxLength}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        ) : onTitleChange ? (
          <Label
            htmlFor={`${id}-title`}
            className="text-xs leading-normal font-medium text-muted-foreground"
          >
            {label}
          </Label>
        ) : (
          <span
            id={`${id}-text-label`}
            className="text-xs leading-normal font-medium text-muted-foreground"
          >
            {label}
          </span>
        )}
        <div className="flex items-center gap-1">{actions}</div>
      </div>
      {onTitleChange && !authoring && (
        <Input
          id={`${id}-title`}
          value={title ?? ''}
          placeholder={titlePlaceholder}
          className={`rounded-lg ${questionStyles.input}`}
          disabled={disabled}
          required={required}
          maxLength={titleMaxLength}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      )}
      {onTitleChange && (
        <span id={`${id}-text-label`} className="sr-only">
          {label} 내용
        </span>
      )}
      <QuestionRichTextEditor
        id={`${id}-text`}
        ariaLabelledBy={`${id}-text-label`}
        value={text}
        placeholder="내용을 작성하세요"
        compact={authoring}
        className={
          authoring
            ? 'rounded-lg bg-neutral-200/70 dark:bg-neutral-800 [&_.tiptap]:min-h-20'
            : 'mt-3 rounded-lg'
        }
        disabled={disabled}
        required={required}
        maxLength={textMaxLength}
        onChange={onTextChange}
      />
      {children}
    </div>
  );
}
