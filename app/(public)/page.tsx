import { redirect } from 'next/navigation';

import { getUserAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { user, isOnboarded } = await getUserAccess();

  if (!user) redirect('/auth/login');

  redirect(isOnboarded ? '/dashboard' : '/onboarding');
}
