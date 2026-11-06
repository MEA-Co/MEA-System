import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

import panel from './persona-sources.json' with { type: 'json' };
import questions from './source-questions.json' with { type: 'json' };

// These spans, never browser-supplied IDs, define the student-visible excerpts.
export function matchPassages(mentor, extract) {
  return panel[mentor].sources.flatMap((span, index) => {
    const quote = extract(span, index);
    if (
      !quote ||
      createHash('sha256').update(quote).digest('hex') !== span.digest
    )
      return [];
    return [
      {
        id: `evidence-${span.digest}`,
        summary: span.summary,
        question: questions[span.questionId],
        quote,
      },
    ];
  });
}

export async function readEvidence(mentor) {
  const { owner, sources } = panel[mentor];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const fields = sources.map(
    ({ questionId: question }, i) => `body${i}:answers->"${question}"->>body`,
  );
  const { data, error } = await db
    .from('response_submissions')
    .select(
      ['session_id', 'response_sessions!inner(respondent_id)', ...fields].join(
        ',',
      ),
    )
    .in('session_id', [...new Set(sources.map((s) => s.session))])
    .eq('response_sessions.respondent_id', owner)
    .abortSignal(AbortSignal.timeout(6000));
  if (error) throw Error('Cannot verify mentor sources');
  if (
    data.length === 0 &&
    process.env.NODE_ENV === 'development' &&
    url === 'http://127.0.0.1:54321'
  ) {
    // The local DB does not contain production profiles. Only reviewed extracts
    // are copied into this git-ignored fixture; no complete submissions.
    const fixture = JSON.parse(
      await readFile('data/system/mentor-round-quote-fixture.json', 'utf8'),
    );
    return matchPassages(mentor, (span) => fixture[span.digest]);
  }
  return matchPassages(mentor, ({ session, start, length }, i) => {
    const body = data.find((row) => row.session_id === session)?.['body' + i];
    return typeof body === 'string'
      ? Array.from(body)
          .slice(start, start + length)
          .join('')
      : null;
  });
}
