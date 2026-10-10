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
                      disabled: 'disabled' in option && option.disabled,
                    }))
                  : null;
          const props = {
            id,
            name: field.key,
            value: values[field.key],
            placeholder: field.placeholder,
            required,
            maxLength: 50000,
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
              {field.key === 'problemSource' && (
                <p className="text-sm text-muted-foreground">
                  공통 문제 상황 템플릿은 학생 질의응답에서 추출한 사례가
                  등록되면 제공됩니다.
                </p>
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
