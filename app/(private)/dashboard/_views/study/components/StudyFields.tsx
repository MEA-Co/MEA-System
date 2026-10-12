import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <div className="space-y-3 sm:col-span-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="study-period-enabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-controls="study-period-input"
          aria-expanded={enabled}
        />
        <Label htmlFor="study-period-enabled">실천 기간 설정</Label>
      </div>
      {enabled && (
        <div id="study-period-input" className="space-y-2">
          <Label htmlFor="study-practicePeriod">실천 기간</Label>
          <Input
            id="study-practicePeriod"
            name="practicePeriod"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="예: 2주"
            className="rounded-xl"
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
  return (
    <div className="grid grid-cols-1 gap-y-3 lg:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] lg:gap-x-2 lg:gap-y-6">
      {groups.flatMap((group) => [
        <section
          key={group.title}
          className={`min-w-0 space-y-5 rounded-2xl border p-5 md:p-6 ${group.title === '문제 상황' || group.title === '대응 솔루션' ? '' : 'lg:col-span-3'}`}
        >
          <h2 className="font-semibold">{group.title}</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {group.fields.map((field) => {
              if (field.key === 'checklist') {
                const items = values.checklist.split('\n');
                const updateItems = (next: string[]) =>
                  onChange({ ...values, checklist: next.join('\n') });
                return (
                  <fieldset
                    key={field.key}
                    className="min-w-0 space-y-3 sm:col-span-3"
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
                    {items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="text-sm text-muted-foreground"
                        >
                          {index + 1}.
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
                          className="min-w-0 flex-1 rounded-xl"
                        />
                        <button
                          type="button"
                          aria-label={`체크리스트 항목 ${index + 1} 삭제`}
                          className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2"
                          onClick={() =>
                            updateItems(
                              items.length === 1
                                ? ['']
                                : items.filter((_, i) => i !== index),
                            )
                          }
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 disabled:opacity-50"
                      disabled={values.checklist.length >= 50000}
                      onClick={() => updateItems([...items, ''])}
                    >
                      + 항목 추가
                    </button>
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
                  className={`min-w-0 space-y-2 ${field.key === 'category' || field.key === 'subject' || field.key === 'customSubject' ? '' : 'sm:col-span-3'}`}
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
                    <Textarea {...props} className="min-h-32 rounded-xl" />
                  ) : (
                    <Input {...props} className="rounded-xl" />
                  )}
                  {field.key === 'problemSource' &&
                    values.problemSource === 'template' && (
                      <div className="space-y-2">
                        <Label htmlFor="study-problem-template">
                          대표 문제 상황 선택
                        </Label>
                        <Select<string>
                          value={null}
                          onValueChange={(value) => {
                            const template = problemTemplates.find(
                              (item) => item.id === value,
                            );
                            if (template) {
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
                            className="w-full"
                          >
                            <SelectValue placeholder="문제 상황을 선택해 주세요" />
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
                        className="min-h-32 rounded-xl"
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
          </div>
        </section>,
        group.title === '문제 상황' && (
          <span
            key="problem-solution-arrow"
            aria-hidden="true"
            className="flex h-6 items-center justify-center self-center text-gray-400"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 rotate-90 lg:rotate-0"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        ),
      ])}
    </div>
  );
}
