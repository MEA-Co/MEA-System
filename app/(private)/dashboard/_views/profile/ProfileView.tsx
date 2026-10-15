import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { CollectionHeader } from '@/components/patterns/collection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  MEMBER_ROLE_LABELS,
  type MemberRole,
  type StudentPeriod,
} from '@/lib/profile';

import { ProfileNameForm } from './ProfileNameForm';

export function ProfileView({
  name,
  role,
  studentPeriod,
}: {
  name: string;
  role: MemberRole;
  studentPeriod?: StudentPeriod | null;
}) {
  return (
    <section aria-labelledby="my-profile-title">
      <Button
        render={<Link href="/dashboard" />}
        nativeButton={false}
        variant="ghost"
        size="sm"
        className="mb-4"
      >
        <ArrowLeft aria-hidden="true" />
        이전으로
      </Button>
      <CollectionHeader
        id="my-profile-title"
        title="내 정보"
        description={
          role === 'student'
            ? '내 계정 정보를 확인하세요.'
            : '내 계정 정보를 확인하고 이름을 관리하세요.'
        }
      />
      <Card variant="accent" className="mt-6 max-w-2xl">
        <CardHeader variant="emphasis">
          <CardTitle>계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={role !== 'student' ? 'profile-name' : undefined}>
              이름
            </Label>
            {role !== 'student' ? (
              <ProfileNameForm key={name} name={name} />
            ) : (
              <p className="rounded-md bg-muted px-3 py-3 text-sm">{name}</p>
            )}
          </div>
          <dl className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <dt className="text-sm font-medium">회원 유형</dt>
              <dd className="rounded-md bg-muted px-3 py-3 text-sm">
                {MEMBER_ROLE_LABELS[role]}
              </dd>
            </div>
            {role === 'student' && studentPeriod ? (
              <div className="space-y-2">
                <dt className="text-sm font-medium">학년·학기</dt>
                <dd className="rounded-md bg-muted px-3 py-3 text-sm">
                  {studentPeriod}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}
