export const SUBMITTED_RESPONSE_PARAM = 'submittedResponse';

export function openSubmittedResponse(id: string) {
  const url = new URL(window.location.href);
  const previous = url.href;
  url.searchParams.set('questionnairePanel', 'responses');
  url.searchParams.set(SUBMITTED_RESPONSE_PARAM, id);
  window.history.pushState({ submittedResponseReturn: previous }, '', url);
}

export function closeSubmittedResponse() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SUBMITTED_RESPONSE_PARAM);
  url.searchParams.set('questionnairePanel', 'responses');
  if (window.history.state?.submittedResponseReturn === url.href) {
    window.history.back();
  } else {
    // A directly opened detail has no submission list in this tab's history.
    window.history.replaceState(null, '', url);
  }
}
