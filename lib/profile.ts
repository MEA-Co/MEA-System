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

export type MemberRole = 'student' | 'consultant';
export type StudentPeriod = (typeof STUDENT_PERIODS)[number];

export type Profile = {
  id: string;
  role: MemberRole;
  name: string;
  student_period: StudentPeriod | null;
};

export function isProfileComplete(profile: Profile | null): profile is Profile {
  if (!profile?.name?.trim()) return false;

  if (profile.role === 'consultant') {
    return profile.student_period === null;
  }

  return STUDENT_PERIODS.includes(profile.student_period as StudentPeriod);
}
