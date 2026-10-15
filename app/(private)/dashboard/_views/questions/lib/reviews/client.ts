export function questionReviewUrl(questionId: string) {
  return `/api/questions/${questionId}/reviews`;
}
export type ReviewSubmission = {
  id: string;
  questionId: string;
  description: string;
};
export function prepareReviewSubmission(
  previous: ReviewSubmission | null,
  questionId: string,
  description: string,
): ReviewSubmission {
  const text = description.trim();
  return previous?.questionId === questionId && previous.description === text
    ? previous
    : {
        id: crypto.randomUUID(),
        questionId,
        description: text,
      };
}
export async function mutateQuestionReview(
  url: string,
  method: string,
  body: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw new Error(
      result.error || '처리 결과를 확인하지 못했어요. 다시 시도해 주세요.',
    );
}

/** Coalesce visible IDs; successful IDs never repeat within this mounted context. */
export function createReviewReadBatch(send: (ids: string[]) => Promise<void>) {
  const visible = new Set<string>();
  const confirmed = new Set<string>();
  let running = false;
  return {
    setVisible(id: string, value: boolean) {
      if (value) visible.add(id);
      else visible.delete(id);
    },
    async flush() {
      if (running) return false;
      running = true;
      let changed = false;
      try {
        const ids = [...visible].filter((id) => !confirmed.has(id));
        for (let offset = 0; offset < ids.length; offset += 100) {
          const batch = ids.slice(offset, offset + 100);
          await send(batch);
          batch.forEach((id) => confirmed.add(id));
          changed = true;
        }
        return changed;
      } finally {
        running = false;
      }
    },
  };
}
