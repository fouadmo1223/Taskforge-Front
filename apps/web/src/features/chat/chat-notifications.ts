/**
 * Cross-tab "new message" browser notifications.
 *
 * Every open tab already holds its own live Ably realtime connection, so a message
 * that arrives while this tab is hidden or unfocused just needs a plain browser
 * Notification — no Service Worker / push subscription required (that machinery
 * only matters for messages that arrive while every tab is closed, which nobody
 * asked for here).
 */

let permissionRequested = false;

/** Ask the browser for notification permission, once per page load, without blocking anything. */
export function ensureNotificationPermission(): void {
  if (permissionRequested) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  permissionRequested = true;
  void Notification.requestPermission();
}

/** True when the user is actively looking at this tab right now. */
export function isTabActive(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();
}

export function notifyNewMessage(opts: {
  title: string;
  body: string;
  tag: string;
  onClick: () => void;
}): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag, // collapses repeated notifications for the same conversation
      icon: '/favicon.svg',
    });
    n.onclick = () => {
      window.focus();
      opts.onClick();
      n.close();
    };
  } catch {
    // Some browsers throw when notifications are blocked at the OS level — never let this break chat.
  }
}
