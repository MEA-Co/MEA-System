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
  problemSourceOptions,
  subjectOptions,
} from '../lib/fields';
import { problemTemplates } from '../lib/problem-templates';

import { StudyRequiredMark } from './StudyRequiredMark';

export function StudyFields({
  values,
  onChange,
}: {
  values: Activity['values'];
  onChange: (values: Activity['values']) => void;
}) {
  return groups.map((group) => (
    <section
      key={group.title}
      className="space-y-5 rounded-2xl border p-5 md:p-6"
    >
      <h2 className="font-semibold">{group.title}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {group.fields.map((field) => {
          const required = 'required' in field && field.required;
          const id = `study-${field.key}`;
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
              event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChange({ ...values, [field.key]: event.target.value }),
          };
          return (
            <div
              key={field.key}
              className={`space-y-2 ${field.key === 'subject' || field.key === 'customSubject' ? '' : 'sm:col-span-2'}`}
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
                  value={values[field.key] || null}
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
                          (option) => option.value === values[field.key],
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
                    <Select
                      value={null}
                      onValueChange={(value) => {
                        if (
                          value &&
                          problemTemplates.some((text) => text === value)
                        ) {
                          onChange({ ...values, problem: value });
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
                        {problemTemplates.map((text) => (
                          <SelectItem key={text} value={text}>
                            <span className="min-w-0 whitespace-normal break-keep">
                              {text}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      선택한 문장으로 아래 문제 상황을 채웁니다. 기존 내용은
                      바뀌며, 입력된 문장은 자유롭게 수정할 수 있습니다.
                    </p>
                  </div>
                )}
              {'description' in field && (
                <p className="text-sm text-muted-foreground">
                  {field.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  ));
}
