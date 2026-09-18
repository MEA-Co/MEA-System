'use server';

import {
  updateConsultantRole as saveConsultantRole,
  type UpdateConsultantRoleState,
} from '@/lib/admin';

export async function updateConsultantRole(
  _previousState: UpdateConsultantRoleState,
  formData: FormData,
): Promise<UpdateConsultantRoleState> {
  return saveConsultantRole(formData);
}
