import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  type Activity,
  categoryOptions,
  groups,
  problemSourceDisplayValue,
  problemSourceOptions,
  subjectOptions,
} from '../lib/fields';
import { problemTemplates } from '../lib/problem-templates';

import { StudyRequiredMark } from './StudyRequiredMark';

function StudyPeriodField({
  value,
  enabled,
  onEnabledChange,
  onChange,
}: {
  value: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border sm:col-span-2">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <Label htmlFor="study-period-enabled" className="cursor-pointer">
          실천 기간 설정
        </Label>
        <Switch
          id="study-period-enabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-controls={enabled ? 'study-period-input' : undefined}
          aria-expanded={enabled}
        />
      </div>
      {enabled && (
        <div
          id="study-period-input"
          className="grid items-center gap-2 border-t p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-4"
        >
          <Label htmlFor="study-practicePeriod">
            실천 기간 <StudyRequiredMark />
          </Label>
          <Input
            id="study-practicePeriod"
            name="practicePeriod"
            aria-required="true"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="예: 2주"
            maxLength={50000}
          />
        </div>
      )}
    </div>
  );
}

export function StudyFields({
  values,
  onChange,
}: {
  values: Activity['values'];
  onChange: (values: Activity['values']) => void;
}) {
  const [selectedProblemTemplate, setSelectedProblemTemplate] = useState(() => {
    const problemText =
      values.problemSource === 'template' ? values.problem.trim() : '';
    const template = problemTemplates.find(
      (item) => item.problem === problemText,
    );
    return {
      id: template?.id ?? null,
      label: template?.problem ?? (problemText ? '등록한 문제 상황' : ''),
    };
  });

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:items-stretch lg:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] lg:gap-x-2 lg:gap-y-5">
      {groups.flatMap((group, index) => [
        <Card
          key={group.title}
          size="sm"
          className={`min-w-0 ${group.title === '문제 상황' || group.title === '대응 솔루션' ? '' : 'lg:col-span-3'}`}
        >
          <CardHeader variant="emphasis">
            <h2 className="flex items-center gap-3 text-base font-bold">
              <span
                aria-hidden="true"
                className="text-sm tabular-nums text-muted-foreground"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {group.title}
            </h2>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {group.fields.map((field) => {
              if (field.key === 'checklist') {
                const items = values.checklist.split('\n');
                const updateItems = (next: string[]) =>
                  onChange({ ...values, checklist: next.join('\n') });
                return (
                  <fieldset
                    key={field.key}
                    className="min-w-0 space-y-3 sm:col-span-2"
                  >
                    <legend className="text-sm font-medium">
                      {field.label} <StudyRequiredMark />
                    </legend>
                    <p
                      id="study-checklist-guide"
                      className="text-sm text-muted-foreground"
                    >
                      {field.description}
                    </p>
                    <div className="overflow-hidden rounded-md border">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 border-b p-2 sm:p-3"
                        >
                          <span
                            aria-hidden="true"
                            className="w-6 shrink-0 text-center text-sm tabular-nums text-muted-foreground"
                          >
                            {index + 1}
                          </span>
                          <Input
                            aria-label={`체크리스트 항목 ${index + 1}`}
                            aria-describedby="study-checklist-guide"
                            value={item}
                            placeholder={
                              index === 0
                                ? field.placeholder
                                : '예: 자주 발생하는 오답 원인과 이를 피하는 방법을 설명할 수 있다.'
                            }
                            maxLength={Math.max(
                              0,
                              50000 - values.checklist.length + item.length,
                            )}
                            onChange={(event) =>
                              updateItems(
                                items.map((text, i) =>
                                  i === index ? event.target.value : text,
                                ),
                              )
                            }
                            className="min-w-0 flex-1"
                          />
                          <Button
                            type="button"
                            aria-label={`체크리스트 항목 ${index + 1} 삭제`}
                            variant="destructive"
                            size="icon"
                            onClick={() =>
                              updateItems(
                                items.length === 1
                                  ? ['']
                                  : items.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <Minus aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-none border-0"
                        aria-label="체크리스트 항목 추가"
                        disabled={values.checklist.length >= 50000}
                        onClick={() => updateItems([...items, ''])}
                      >
                        <Plus aria-hidden="true" />
                        항목 추가
                      </Button>
                    </div>
                  </fieldset>
                );
              }
              if (field.key === 'practicePeriod') {
                return (
                  <StudyPeriodField
                    key={field.key}
                    value={values.practicePeriod}
                    enabled={values.periodEnabled}
                    onEnabledChange={(periodEnabled) =>
                      onChange({ ...values, periodEnabled })
                    }
                    onChange={(practicePeriod) =>
                      onChange({ ...values, practicePeriod })
                    }
                  />
                );
              }
              const required = 'required' in field && field.required;
              const id = `study-${field.key}`;
              const selectedValue =
                field.key === 'problemSource'
                  ? problemSourceDisplayValue(values[field.key])
                  : values[field.key];
              const options =
                field.key === 'category'
                  ? categoryOptions.map((value) => ({
                      value,
                      label: value,
                      disabled: false,
                    }))
                  : field.key === 'subject'
                    ? subjectOptions.map((value) => ({
                        value,
                        label: value,
                        disabled: false,
                      }))
                    : field.key === 'problemSource'
                      ? problemSourceOptions.map((option) => ({
                          ...option,
                          disabled: false,
                        }))
                      : null;
              const props = {
                id,
                name: field.key,
                value: values[field.key],
                placeholder: field.placeholder,
                required,
                maxLength: 'maxLength' in field ? field.maxLength : 50000,
                onChange: (
                  event: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement
                  >,
                ) => onChange({ ...values, [field.key]: event.target.value }),
              };
              return (
                <div
                  key={field.key}
                  className={`min-w-0 space-y-2 ${field.key === 'category' || field.key === 'subject' ? '' : 'sm:col-span-2'}`}
                >
                  <Label htmlFor={id}>
                    {field.label}
                    {required ? (
                      <StudyRequiredMark />
                    ) : (
                      <span className="text-muted-foreground">(선택)</span>
                    )}
                  </Label>
                  {options ? (
                    <Select
                      value={selectedValue || null}
                      onValueChange={(value) =>
                        onChange({ ...values, [field.key]: value ?? '' })
                      }
                    >
                      <SelectTrigger
                        id={id}
                        aria-required={required}
                        className="w-full"
                      >
                        <SelectValue placeholder={field.placeholder}>
                          {
                            options.find(
                              (option) => option.value === selectedValue,
                            )?.label
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={option.disabled}
                          >
                            {option.label}
                            {option.disabled ? ' (준비 중)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : 'multiline' in field ? (
                    <Textarea {...props} className="min-h-32" />
                  ) : (
                    <Input {...props} />
                  )}
                  {field.key === 'problemSource' &&
                    values.problemSource === 'template' && (
                      <div className="space-y-2">
                        <Label htmlFor="study-problem-template">
                          대표 문제 상황 선택
                        </Label>
                        <Select<string>
                          value={selectedProblemTemplate.id}
                          onValueChange={(value) => {
                            const template = problemTemplates.find(
                              (item) => item.id === value,
                            );
                            if (template) {
                              setSelectedProblemTemplate({
                                id: template.id,
                                label: template.problem,
                              });
                              onChange({
                                ...values,
                                problem: template.problem,
                                category: template.category,
                                subject: template.subject,
                                customSubject: template.customSubject,
                              });
                            }
                          }}
                        >
                          <SelectTrigger
                            id="study-problem-template"
                            className={`min-h-10 w-full min-w-0 whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none ${selectedProblemTemplate.label ? 'data-placeholder:text-foreground' : ''}`}
                            title={selectedProblemTemplate.label || undefined}
                          >
                            <SelectValue
                              placeholder="문제 상황을 선택해 주세요"
                              className="min-w-0 whitespace-normal wrap-anywhere break-keep"
                            >
                              {selectedProblemTemplate.label || undefined}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            alignItemWithTrigger={false}
                            className="max-h-80"
                          >
                            {problemTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <span className="min-w-0 whitespace-normal break-keep">
                                  {template.problem}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          문제 상황과 학습법 적용 대상·교과·세부 과목명을 함께
                          채웁니다. 공통 시험·교과는 기타로, 특정되지 않은 세부
                          과목명은 빈칸으로 설정하며 자유롭게 수정할 수
                          있습니다.
                        </p>
                      </div>
                    )}
                  {'description' in field && (
                    <p className="text-sm text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                  {field.key === 'problem' && (
                    <div className="space-y-2 pt-3">
                      <Label htmlFor="study-problem-experience">
                        문제 상황에 대한 구체적인 경험
                        <span className="text-muted-foreground">(선택)</span>
                      </Label>
                      <Textarea
                        id="study-problem-experience"
                        className="min-h-32"
                        placeholder="직접 겪거나 학생을 지도하며 관찰한 상황, 당시 학습 수준 등의 실제 경험을 작성해 주세요."
                        value={values.problemExperience}
                        onChange={(event) =>
                          onChange({
                            ...values,
                            problemExperience: event.target.value,
                          })
                        }
                        maxLength={50000}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>,
        group.title === '문제 상황' && (
          <div
            key="problem-solution-arrow"
            aria-hidden="true"
            className="flex items-center justify-center self-center text-muted-foreground"
          >
            <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
          </div>
        ),
      ])}
    </div>
  );
}
