'use client';

import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';

import { questionnaireStyles } from './questionnaire-styles';
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
  titlePlaceholder = '항목 제목 (예: 가이드 답변)',
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
  disabled?: boolean;
  required?: boolean;
  titleMaxLength?: number;
  textMaxLength?: number;
}) {
  return (
    <div
      className={
        onTitleChange
          ? questionnaireStyles.explanation
          : 'rounded-xl border bg-muted/20 p-4'
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${id}-${onTitleChange ? 'title' : 'text'}`}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
        <div className="flex items-center gap-1">{actions}</div>
      </div>
      {onTitleChange && (
        <Input
          id={`${id}-title`}
          value={title ?? ''}
          placeholder={titlePlaceholder}
          className={`rounded-lg ${questionnaireStyles.input}`}
          disabled={disabled}
          required={required}
          maxLength={titleMaxLength}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      )}
      <label htmlFor={`${id}-text`} className="sr-only">
        {label} 내용
      </label>
      <QuestionRichTextEditor
        id={`${id}-text`}
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
