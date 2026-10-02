'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LocalLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      className="mt-6 space-y-3 border-t pt-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError('');
        const data = new FormData(event.currentTarget);
        try {
          const result = await createClient().auth.signInWithPassword({
            email: String(data.get('email')),
            password: String(data.get('password')),
          });
          if (result.error) throw result.error;
          router.push('/dashboard');
          router.refresh();
        } catch {
          setError('로컬 계정의 이메일과 비밀번호를 확인해 주세요.');
          setPending(false);
        }
      }}
    >
      <p className="text-sm font-medium">로컬 테스트 계정</p>
      <label className="block text-sm">
        이메일
        <input
          className="mt-1 w-full rounded-md border p-2"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue="codex-consultant@example.test"
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
