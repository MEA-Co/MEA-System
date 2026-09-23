'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';

import { questionStyles } from './question-styles';
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
    ? 'rounded-lg border border-neutral-200 border-l-[3px] border-l-neutral-300 bg-white p-4 dark:border-neutral-700 dark:border-l-neutral-600 dark:bg-neutral-900'
    : onTitleChange
      ? questionStyles.explanation
      : 'rounded-xl border bg-muted/20 p-4';

  return (
    <div className={surfaceClassName}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {onTitleChange ? (
          <label
            htmlFor={`${id}-title`}
            className="text-xs font-medium text-muted-foreground"
          >
            {label}
          </label>
        ) : (
          <span
            id={`${id}-text-label`}
            className="text-xs font-medium text-muted-foreground"
          >
            {label}
          </span>
        )}
        <div className="flex items-center gap-1">{actions}</div>
      </div>
      {onTitleChange && (
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
        className="mt-3 rounded-lg"
        disabled={disabled}
        required={required}
        maxLength={textMaxLength}
        onChange={onTextChange}
      />
      {children}
    </div>
  );
}
