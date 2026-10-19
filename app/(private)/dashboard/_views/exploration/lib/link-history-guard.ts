type TraverseEvent = Event & {
  navigationType: string;
  destination: { key: string; url: string; sameDocument: boolean };
};
type NavigationEvents = {
  addEventListener(
    type: 'navigate',
    listener: (event: TraverseEvent) => void,
  ): void;
  removeEventListener(
    type: 'navigate',
    listener: (event: TraverseEvent) => void,
  ): void;
  traverseTo(key: string): { finished: Promise<unknown> };
};

/** Keep the editor mounted while a same-document history exit is confirmed. */
export function guardLinkHistory(
  target: Window,
  busy: boolean,
  requestExit: (proceed: () => void) => void,
  approved: () => boolean = () => false,
) {
  const navigation = (target as Window & { navigation?: NavigationEvents })
    .navigation;
  if (navigation) {
    let allowedKey: string | null = null;
    const guard = (event: TraverseEvent) => {
      if (
        approved() ||
        event.navigationType !== 'traverse' ||
        !event.cancelable ||
        !event.destination.sameDocument
      )
        return;
      if (event.destination.key === allowedKey) {
        allowedKey = null;
        return;
      }
      const from = new URL(target.location.href);
      const to = new URL(event.destination.url);
      if (from.pathname === to.pathname && from.search === to.search) return;
      event.preventDefault();
      if (busy) return;
      const key = event.destination.key;
      requestExit(() => {
        allowedKey = key;
        void navigation.traverseTo(key).finished.catch(() => {
          allowedKey = null;
        });
      });
    };
    navigation.addEventListener('navigate', guard);
    return () => navigation.removeEventListener('navigate', guard);
  }
  // Compatibility path for browsers without the Navigation API. Restoring an
  // entry here can replace the forward branch; modern browsers keep it intact.
  const url = target.location.href;
  const state = target.history.state;
  let allowExit = false;
  const guard = (event: PopStateEvent) => {
    if (allowExit || approved()) return;
    // popstate is not cancellable. Stop the router's listener and restore the
    // editor entry; the traversed destination is now immediately behind it.
    event.stopImmediatePropagation();
    target.history.pushState(state, '', url);
    if (busy) return;
    requestExit(() => {
      allowExit = true;
      target.history.back();
    });
  };
  target.addEventListener('popstate', guard, true);
  return () => target.removeEventListener('popstate', guard, true);
}
