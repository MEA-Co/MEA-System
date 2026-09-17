'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { getUserAccess } from '@/lib/auth';
import { MEMBER_ROLE_LABELS } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

const updateConsultantRoleSchema = z.object({
  targetId: z.uuid(),
  role: z.enum(['consultant', 'consultant_lead']),
});

export type UpdateConsultantRoleState = {
  error?: string;
  success?: string;
  savedRole?: 'consultant' | 'consultant_lead';
};

export async function updateConsultantRole(
  _previousState: UpdateConsultantRoleState,
  formData: FormData,
): Promise<UpdateConsultantRoleState> {
  const parsed = updateConsultantRoleSchema.safeParse({
    targetId: formData.get('targetId'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { error: '변경할 직책과 회원을 다시 확인해 주세요.' };
  }

  const access = await getUserAccess();
  if (!access.user) {
    return { error: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
  }
  if (!access.isOnboarded || access.role !== 'admin') {
    return { error: '관리자만 직책을 변경할 수 있어요.' };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc('update_consultant_role', {
    next_role: parsed.data.role,
    target_id: parsed.data.targetId,
  });

  if (error) {
    if (error.code === '42501') {
      return { error: '변경 권한이 없어요. 새로고침 후 다시 확인해 주세요.' };
    }
    if (error.code === 'P0002') {
      return {
        error: '변경할 컨설턴트를 찾지 못했어요. 목록을 새로고침해 주세요.',
      };
    }
    return {
      error: '직책을 변경하지 못했어요. 잠시 후 다시 시도해 주세요.',
    };
  }

  revalidatePath('/dashboard');
  return {
    success: `${MEMBER_ROLE_LABELS[parsed.data.role]}로 저장했어요.`,
    savedRole: parsed.data.role,
  };
}
