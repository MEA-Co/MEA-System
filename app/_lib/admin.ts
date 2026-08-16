import type { StudentPeriod } from '@/lib/profile';

export type AdminView = 'students' | 'consultants' | 'consulting';

export type ManagedMember = {
  id: string;
  role: 'student' | 'consultant' | 'admin';
  name: string;
  student_period: StudentPeriod | null;
  created_at: string;
};
