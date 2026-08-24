'use client';

import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setErrorMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage(
        '로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="h-11 w-full gap-3 font-semibold bg-white text-black shadow-sm hover:bg-zinc-50 border border-zinc-100"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        {isLoading ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span
            className="size-5 shrink-0 bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage:
                "url('https://developers.google.com/static/identity/images/g-logo.png')",
            }}
            aria-hidden="true"
          />
        )}
        <p>Google로 계속하기</p>
      </Button>
      {errorMessage ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
