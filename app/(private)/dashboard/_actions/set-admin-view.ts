'use server';

import { setAdminView as saveAdminView } from '@/lib/admin';

export async function setAdminView(role: string): Promise<{ error?: string }> {
  return saveAdminView(role);
}
