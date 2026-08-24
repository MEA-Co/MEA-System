'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabaseClient = createClient(await cookies());
  await supabaseClient.auth.signOut();
  redirect('/auth/login');
}
