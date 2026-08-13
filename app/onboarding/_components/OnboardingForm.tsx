'use client';

import { LoaderCircle } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type OnboardingRole,
  STUDENT_PERIODS,
  type StudentPeriod,
} from '@/lib/profile';

import { completeOnboarding } from '../actions';

type OnboardingFormProps = {
  defaultName: string;
};

export function OnboardingForm({ defaultName }: OnboardingFormProps) {
  const [role, setRole] = useState<OnboardingRole>('student');
  const [studentPeriod, setStudentPeriod] = useState<StudentPeriod | null>(
    null,
  );
  const [state, formAction, pending] = useActionState(completeOnboarding, {});

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="role" value={role} />
      <input
        type="hidden"
        name="student_period"
        value={role === 'student' ? (studentPeriod ?? '') : ''}
      />

      <div className="space-y-3">
        <Label>회원 유형</Label>
        <RadioGroup
          value={role}
          onValueChange={(value) => setRole(value as OnboardingRole)}
          className="grid gap-3 md:grid-cols-2"
        >
          <Label
            htmlFor="role-student"
            className="group cursor-pointer flex items-center gap-3 rounded-xl border bg-background p-4 hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            <RadioGroupItem id="role-student" value="student" />
            <span className="font-semibold">학생 회원</span>
          </Label>
          <Label
            htmlFor="role-consultant"
            className="group cursor-pointer flex items-center gap-3 rounded-xl border bg-background p-4 hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
          >
            <RadioGroupItem id="role-consultant" value="consultant" />
            <span>
              <span className="font-semibold">컨설턴트 회원</span>
            </span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="name">이름</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          placeholder="이름을 입력해 주세요"
          autoComplete="name"
          maxLength={50}
          className="h-11"
        />
      </div>

      {role === 'student' ? (
        <div className="space-y-2.5">
          <Label htmlFor="student-period">현재 시기</Label>
          <Select
            value={studentPeriod}
            onValueChange={(value) =>
              setStudentPeriod(value as StudentPeriod | null)
            }
          >
            <SelectTrigger id="student-period" className="h-11 w-full">
              <SelectValue placeholder="현재 시기를 선택해 주세요" />
            </SelectTrigger>
            <SelectContent>
              {STUDENT_PERIODS.map((period) => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? '저장 중...' : 'MEA 시작하기'}
      </Button>
    </form>
  );
}
