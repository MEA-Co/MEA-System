import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  type Activity,
  creativeActivityOptions,
  gradeOptions,
  recordTypeOptions,
  semesterOptions,
} from '../lib/fields';

function RecordSelect({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      name={name}
      value={value || null}
      onValueChange={(next) => onChange(next ?? '')}
    >
      <SelectTrigger aria-label={label} className="min-w-20 rounded-xl">
        <SelectValue placeholder="선택" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExplorationRecordFields({
  section,
  values,
  onChange,
}: {
  section: 'grade' | 'recordType';
  values: Activity['values'];
  onChange: (values: Activity['values']) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">
        {section === 'grade'
          ? '기재 영역 · 학년 및 학기'
          : '기재 영역 · 창체 또는 세특'}
      </legend>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {section === 'grade' ? (
          <>
            <RecordSelect
              name="grade"
              label="학년"
              value={values.grade}
              options={gradeOptions}
              onChange={(grade) => onChange({ ...values, grade })}
            />
            <span>학년</span>
            <RecordSelect
              name="semester"
              label="학기"
              value={values.semester}
              options={semesterOptions}
              onChange={(semester) => onChange({ ...values, semester })}
            />
            <span>학기</span>
          </>
        ) : (
          <>
            <RecordSelect
              name="recordType"
              label="기재 유형"
              value={values.recordType}
              options={recordTypeOptions}
              onChange={(recordType) =>
                onChange({
                  ...values,
                  recordType,
                  recordArea:
                    recordType === values.recordType ? values.recordArea : '',
                })
              }
            />
            <span>영역</span>
            {values.recordType === '창체' ? (
              <RecordSelect
                name="recordArea"
                label="창체 활동 영역"
                value={values.recordArea}
                options={creativeActivityOptions}
                onChange={(recordArea) => onChange({ ...values, recordArea })}
              />
            ) : (
              <Input
                name="recordArea"
                aria-label="과목명"
                placeholder={
                  values.recordType === '세특'
                    ? '과목명 입력'
                    : '기재 유형을 먼저 선택해 주세요'
                }
                disabled={!values.recordType}
                value={values.recordArea}
                onChange={(event) =>
                  onChange({ ...values, recordArea: event.target.value })
                }
                className="min-w-40 flex-1 rounded-xl"
              />
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}
