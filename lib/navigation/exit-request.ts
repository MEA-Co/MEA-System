export const NAVIGATION_EXIT_REQUEST = 'mea:navigation-exit-request';
export const NAVIGATION_EXIT_FAILED = 'mea:navigation-exit-failed';

// Ask before a UI action mutates session state or replaces the current editor.
export function requestNavigationExit(proceed: () => void) {
  const event = new CustomEvent(NAVIGATION_EXIT_REQUEST, {
    cancelable: true,
    detail: { proceed },
  });
  if (window.dispatchEvent(event)) proceed();
}

export function navigationExitFailed() {
  window.dispatchEvent(new Event(NAVIGATION_EXIT_FAILED));
}
