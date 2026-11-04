import { questionStrategy } from './question-strategy.mjs';
import { acceptsOrigin, json } from './response.mjs';
export async function questionDraft(request, env) {
  if (request.method !== 'POST')
    return json({ error: 'POST 요청이 필요합니다.' }, 405);
  if (!acceptsOrigin(request))
    return json({ error: '접근할 수 없습니다.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'JSON 입력이 필요합니다.' }, 415);
  const input = await request.json().catch(() => null);
  const raw = input?.raw;
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 1200)
    return json({ error: '고민을 1~1200자로 입력해 주세요.' }, 400);
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: 'Bearer ' + env.OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        store: false,
        max_output_tokens: 600,
        instructions: questionStrategy,
        input: raw.trim(),
        text: {
          format: {
            type: 'json_schema',
            name: 'question_draft',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                q: { type: 'string' },
                opts: { type: 'array', items: { type: 'string' } },
              },
              required: ['q', 'opts'],
            },
          },
        },
      }),
    });
    if (!res.ok) throw Error();
    const payload = await res.json();
    const output = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === 'output_text');
    const draft = JSON.parse(output.text),
      q = draft.q.trim(),
      opts = draft.opts.map((s) => s.trim());
    if (
      !q ||
      q.length > 180 ||
      opts.length < 2 ||
      opts.length > 5 ||
      new Set(opts).size !== opts.length ||
      opts.some((s) => !s || s.length > 65)
    )
      throw Error();
    return json({ q, opts });
  } catch {
    return json(
      { error: '초안을 만들지 못했어요. 다시 시도하거나 직접 작성해 주세요.' },
      502,
    );
  }
}
