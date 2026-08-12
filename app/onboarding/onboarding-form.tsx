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
  type MemberRole,
  STUDENT_PERIODS,
  type StudentPeriod,
} from '@/lib/profile';

import { completeOnboarding } from './actions';

type OnboardingFormProps = {
  defaultName: string;
};

export function OnboardingForm({ defaultName }: OnboardingFormProps) {
  const [role, setRole] = useState<MemberRole>('student');
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
        <Label className="text-sm text-black">회원 유형</Label>
        <RadioGroup
          value={role}
          onValueChange={(value) => setRole(value as MemberRole)}
          className="grid gap-3 md:grid-cols-2"
        >
          <Label
            htmlFor="role-student"
            className="group cursor-pointer items-start gap-3 rounded-md border border-neutral-300 bg-white p-4 hover:border-neutral-500 has-[[data-checked]]:border-blue-600 has-[[data-checked]]:bg-blue-50"
          >
            <RadioGroupItem
              id="role-student"
              value="student"
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-black">학생 회원</span>
              <span className="mt-1 block text-xs font-normal leading-5 text-neutral-500">
                나의 시기에 맞는 로드맵을 관리해요
              </span>
            </span>
          </Label>
          <Label
            htmlFor="role-consultant"
            className="group cursor-pointer items-start gap-3 rounded-md border border-neutral-300 bg-white p-4 hover:border-neutral-500 has-[[data-checked]]:border-blue-600 has-[[data-checked]]:bg-blue-50"
          >
            <RadioGroupItem
              id="role-consultant"
              value="consultant"
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-black">
                컨설턴트 회원
              </span>
              <span className="mt-1 block text-xs font-normal leading-5 text-neutral-500">
                학생의 목표와 성장 과정을 함께 설계해요
              </span>
            </span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="name" className="text-sm text-black">
          이름
        </Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          placeholder="이름을 입력해 주세요"
          autoComplete="name"
          maxLength={50}
          required
          className="h-11 rounded-md border-neutral-300 bg-white px-3 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
        />
      </div>

      {role === 'student' ? (
        <div className="space-y-2.5">
          <Label htmlFor="student-period" className="text-sm text-black">
            현재 시기
          </Label>
          <Select
            value={studentPeriod}
            onValueChange={(value) =>
              setStudentPeriod(value as StudentPeriod | null)
            }
          >
            <SelectTrigger
              id="student-period"
              className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
            >
              <SelectValue placeholder="현재 시기를 선택해 주세요" />
            </SelectTrigger>
            <SelectContent className="rounded-md border border-neutral-200 shadow-md">
              {STUDENT_PERIODS.map((period) => (
                <SelectItem key={period} value={period} className="rounded-sm">
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs leading-5 text-neutral-500">
            선택한 시기에 맞춰 학습과 입시 일정을 보여드려요.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full rounded-md bg-blue-600 text-[15px] font-semibold text-white shadow-none hover:bg-blue-700"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? '저장 중...' : 'MEA 시작하기'}
      </Button>
    </form>
  );
}
