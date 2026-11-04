'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';

import { localLogin } from '../local-login';

export function LocalLoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(
    localLogin.bind(null, next),
    '',
  );
  return (
    <form className="mt-6 space-y-3 border-t pt-5" action={action}>
      <p className="text-sm font-medium">로컬 테스트 계정</p>
      <label className="block text-sm">
        이메일
        <input
          className="mt-1 w-full rounded-md border p-2"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="name@example.test"
          required
        />
      </label>
      <label className="block text-sm">
        비밀번호
        <input
          className="mt-1 w-full rounded-md border p-2"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? '로그인 중…' : '로컬 계정으로 로그인'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
