/**
 * addons.ts — the registry of tools the app offers.
 *
 * One list, read by the sidebar, the home page, the Focus Mode settings, and
 * the route guards. Adding a tool means adding an entry here and a route; every
 * other surface picks it up automatically.
 *
 * Before this existed, the navigation had its own hardcoded array and the home
 * page had another. Two lists describing the same thing is two lists that
 * drift — and Focus Mode would have made it three.
 */

export type Addon = {
  /** Stable identifier, stored in the database. Never change these. */
  key: string;
  label: string;
  path: string;
  icon: string;
  /** One-line description, shown on the home page and in settings. */
  description: string;
  /**
   * Whether Focus Mode is allowed to hide this.
   *
   * The Timer is deliberately false. Focus Mode is only active while a focus
   * phase runs, and pausing is how you leave it — so hiding the timer would
   * hide the exit. Home and Settings stay for the same reason: you should never
   * be able to configure yourself into a corner you can't get out of.
   */
  restrictable: boolean;
  /** False for tools that don't exist yet — shown, but marked "Soon". */
  built: boolean;
};

export const ADDONS: Addon[] = [
  {
    key: "home",
    label: "Home",
    path: "/",
    icon: "🏠",
    description: "Your overview",
    restrictable: false,
    built: true,
  },
  {
    key: "timer",
    label: "Timer",
    path: "/timer",
    icon: "⏱️",
    description: "Focus sessions and breaks",
    restrictable: false,
    built: true,
  },
  {
    key: "notes",
    label: "Notes",
    path: "/notes",
    icon: "📝",
    description: "Documents, shareable later",
    restrictable: true,
    built: false,
  },
  {
    key: "boards",
    label: "Boards",
    path: "/boards",
    icon: "🗂️",
    description: "Lists and cards for assignments",
    restrictable: true,
    built: false,
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    icon: "⚙️",
    description: "Themes and preferences",
    restrictable: false,
    built: true,
  },
];

/** Just the add-ons Focus Mode may hide — what the settings screen offers. */
export const RESTRICTABLE_ADDONS = ADDONS.filter((a) => a.restrictable);

/** Look up an add-on by key. Undefined for keys we no longer recognise. */
export function getAddon(key: string): Addon | undefined {
  return ADDONS.find((a) => a.key === key);
}
