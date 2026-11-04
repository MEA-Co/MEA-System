export const json = (body, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Next's internal URL may use localhost when the local browser uses 127.0.0.1.
export function acceptsOrigin(request) {
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  if (!origin || origin === target.origin) return true;
  try {
    const browser = new URL(origin);
    const loopback = ['localhost', '127.0.0.1', '[::1]'];
    return (
      loopback.includes(target.hostname) &&
      loopback.includes(browser.hostname) &&
      browser.protocol === target.protocol &&
      browser.port === target.port &&
      browser.host === request.headers.get('host')
    );
  } catch {
    return false;
  }
}
