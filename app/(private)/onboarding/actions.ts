'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  isOnboardingRole,
  STUDENT_PERIODS,
  type StudentPeriod,
} from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export type OnboardingState = {
  error?: string;
};

export async function completeOnboarding(
  _state: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인 정보가 만료됐어요. 다시 로그인해 주세요.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? '');
  const periodValue = String(formData.get('student_period') ?? '');

  if (!name || name.length > 50) {
    return { error: '이름은 1자 이상 50자 이하로 입력해 주세요.' };
  }

  if (!isOnboardingRole(role)) {
    return { error: '회원 유형을 선택해 주세요.' };
  }

  const isValidPeriod = STUDENT_PERIODS.includes(periodValue as StudentPeriod);
  if (role === 'student' && !isValidPeriod) {
    return { error: '현재 시기를 선택해 주세요.' };
  }

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    name,
    role,
    student_period: role === 'student' ? periodValue : null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return {
      error: '회원 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    };
  }

  redirect('/dashboard');
}
