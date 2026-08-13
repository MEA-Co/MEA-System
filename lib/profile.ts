export const STUDENT_PERIODS = [
  '예비고1',
  '1학년 1학기',
  '1학년 여름방학',
  '1학년 2학기',
  '1학년 겨울방학',
  '2학년 1학기',
  '2학년 여름방학',
  '2학년 2학기',
  '2학년 겨울방학',
  '3학년 1학기',
  '3학년 여름방학',
  '3학년 2학기',
  '3학년 겨울방학',
] as const;

export const MEMBER_ROLES = ['student', 'consultant', 'admin'] as const;
export const ONBOARDING_ROLES = ['student', 'consultant'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];
export type StudentPeriod = (typeof STUDENT_PERIODS)[number];

export type Profile = {
  id: string;
  role: MemberRole;
  name: string;
  student_period: StudentPeriod | null;
};

export function isProfileComplete(profile: Profile | null): profile is Profile {
  if (!profile?.name?.trim()) return false;

  if (profile.role === 'consultant' || profile.role === 'admin') {
    return profile.student_period === null;
  }

  return STUDENT_PERIODS.includes(profile.student_period as StudentPeriod);
}

export function isOnboardingRole(value: string): value is OnboardingRole {
  return ONBOARDING_ROLES.some((role) => role === value);
}
