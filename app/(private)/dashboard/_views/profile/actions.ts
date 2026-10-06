'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function updateMyName(
  _previous: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const access = await requireUserAccess({
    allowedRoles: ['consultant', 'consultant_lead', 'admin'],
  });
  const raw = formData.get('name');
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name || Array.from(name).length > 50)
    return { error: '이름은 공백 없이 1~50자로 입력해 주세요.' };
  const client = createClient(await cookies());
  const { data, error } = await client
    .from('profiles')
    .update({ name })
    .eq('id', access.user.id)
    .select('name')
    .single();
  if (error || !data)
    return { error: '이름을 저장하지 못했어요. 다시 시도해 주세요.' };
  revalidatePath('/dashboard', 'layout');
  return { success: '이름을 변경했어요.' };
}
