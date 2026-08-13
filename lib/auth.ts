import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  isProfileComplete,
  type MemberRole,
  type Profile,
} from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

import 'server-only';

export type UserAccess = {
  user: User | null;
  profile: Profile | null;
  role: MemberRole | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
};

export type AuthorizedUserAccess = UserAccess & {
  user: User;
  profile: Profile;
  role: MemberRole;
  isAuthenticated: true;
  isOnboarded: true;
};

type RequireUserAccessOptions = {
  allowedRoles?: readonly MemberRole[];
  loginRedirectTo?: string;
  onboardingRedirectTo?: string;
  unauthorizedRedirectTo?: string;
};

export async function getUserAccess(): Promise<UserAccess> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      profile: null,
      role: null,
      isAuthenticated: false,
      isOnboarded: false,
    };
  }

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, name, student_period')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (profileError) {
    throw new Error('Failed to load the authenticated user profile.', {
      cause: profileError,
    });
  }

  const profile = data ?? null;

  return {
    user,
    profile,
    role: profile?.role ?? null,
    isAuthenticated: true,
    isOnboarded: isProfileComplete(profile),
  };
}

export function hasRole(
  access: Pick<UserAccess, 'role'>,
  allowedRoles: readonly MemberRole[],
) {
  return access.role !== null && allowedRoles.includes(access.role);
}

export async function requireUserAccess({
  allowedRoles,
  loginRedirectTo = '/login',
  onboardingRedirectTo = '/onboarding',
  unauthorizedRedirectTo = '/',
}: RequireUserAccessOptions = {}): Promise<AuthorizedUserAccess> {
  const access = await getUserAccess();

  if (!access.user) redirect(loginRedirectTo);
  if (!access.isOnboarded || !access.profile || !access.role) {
    redirect(onboardingRedirectTo);
  }
  if (allowedRoles && !hasRole(access, allowedRoles)) {
    redirect(unauthorizedRedirectTo);
  }

  return access as AuthorizedUserAccess;
}
