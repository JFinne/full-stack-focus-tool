/**
 * notifications.ts — desktop notifications when a phase ends.
 *
 * ## Permission is a one-shot resource, and that shapes everything here
 *
 * A browser will show the "Allow notifications?" prompt once. If the user says
 * no — or dismisses it, which many browsers now treat as a soft no — we cannot
 * ask again from code. The setting moves into browser UI most people never
 * open.
 *
 * So the prompt is not something to spend casually. The pattern this file
 * supports is:
 *
 *   1. Never ask on page load. A prompt that appears before the user knows what
 *      the app does is the most likely to be refused, and browsers increasingly
 *      ignore or auto-deny requests not tied to a user gesture.
 *   2. Ask when the user asks *us* — when they turn the setting on. At that
 *      moment the request is expected, the reason is obvious, and it's attached
 *      to a real click.
 *
 * That's why there's no "request on mount" here, and why requestPermission is
 * only called from the settings toggle.
 */

/**
 * What state notifications are in on this device.
 *
 * "unsupported" is separate from "denied" because they need different UI. Denied
 * means "you said no, here's how to change it"; unsupported means "your browser
 * can't do this" — telling someone to check their browser settings would send
 * them looking for something that doesn't exist. Safari on iOS, for instance,
 * only supports this for installed web apps.
 */
export type NotificationState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export function getNotificationState(): NotificationState {
  // Feature-detect rather than assume. This also guards against environments
  // where `Notification` simply isn't defined.
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationState;
}

/**
 * Ask for permission. Call only from a user gesture.
 *
 * Returns the resulting state so the caller can react — importantly, a caller
 * must handle "denied", because the user turning a toggle on does not mean the
 * feature is now available.
 */
export async function requestNotificationPermission(): Promise<NotificationState> {
  if (getNotificationState() === "unsupported") return "unsupported";

  try {
    const result = await Notification.requestPermission();
    return result as NotificationState;
  } catch {
    // Older Safari used a callback rather than a promise and can throw here.
    return getNotificationState();
  }
}

/**
 * Show a notification, if we're allowed to.
 *
 * Silently does nothing when permission is missing. The caller has already
 * decided it *wants* to notify; whether it's permitted is this function's
 * business, and making every call site re-check would just spread the same
 * condition around.
 */
export function showNotification(title: string, body: string): void {
  if (getNotificationState() !== "granted") return;

  try {
    new Notification(title, {
      body,
      /**
       * `tag` makes repeat notifications replace each other rather than stack.
       *
       * Without it, a long session away from the desk could leave a pile of
       * "Time's up" notifications to dismiss one by one. With a shared tag,
       * there's only ever one from us.
       */
      tag: "focus-tool-timer",
    });
  } catch {
    // Some browsers throw when constructing notifications outside a service
    // worker context. Not worth breaking the phase transition over.
  }
}
