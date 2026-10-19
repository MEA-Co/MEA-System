/** Only same-window HTTP navigation away from the current editor needs a prompt. */
export function shouldConfirmLinkExit(
  currentHref: string,
  destinationHref: string,
  target: string,
  download: boolean,
  event: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
  },
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    download ||
    (target && target !== '_self')
  )
    return false;
  const destination = new URL(destinationHref, currentHref);
  const current = new URL(currentHref);
  return (
    ['http:', 'https:'].includes(destination.protocol) &&
    !(
      destination.origin === current.origin &&
      destination.pathname === current.pathname &&
      destination.search === current.search
    )
  );
}
