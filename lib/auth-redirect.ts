const fallback = '/dashboard';

/** Accept only local paths, excluding authentication loops and ambiguous URLs. */
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\x00-\x20\x7f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, 'https://local.invalid');
    const path = decodeURIComponent(url.pathname);
    if (
      url.origin !== 'https://local.invalid' ||
      path.startsWith('//') ||
      path.includes('\\') ||
      /^\/(auth|onboarding)(\/|$)/.test(path)
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function withReturnPath(page: string, value: unknown): string {
  return `${page}?${new URLSearchParams({ next: safeReturnPath(value) })}`;
}
