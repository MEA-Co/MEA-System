/** Scope to this response editor; preview/review copies may share question IDs. */
export function focusResponseQuestion(
  root: HTMLElement | null,
  questionId: string,
  reducedMotion: boolean,
) {
  const target = Array.from(
    root?.querySelectorAll<HTMLElement>('[data-response-question]') ?? [],
  ).find((element) => element.dataset.responseQuestion === questionId);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({
    behavior: reducedMotion ? 'instant' : 'smooth',
    block: 'start',
  });
}
