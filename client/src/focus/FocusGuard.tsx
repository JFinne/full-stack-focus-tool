import { Link } from "react-router-dom";
import { useFocusMode } from "./useFocusMode";
import { useTimer } from "../timer/TimerContext";
import { formatDuration } from "../timer/timerLogic";
import { getAddon } from "../addons";

/**
 * FocusGuard — wraps a page that Focus Mode may hide.
 *
 * Removing something from the sidebar isn't enough. The URL still works, a
 * bookmark still works, and the browser's back button still works. Hiding only
 * the link would produce the worst outcome: a feature you're told is off that
 * you can still stumble into, which teaches you the restriction is fake.
 *
 * So the block lives at the route, and the navigation is only a reflection of
 * it. Same principle as the auth gate in App.tsx: guard the thing, not the
 * link to the thing.
 *
 * (And as with the auth gate, this is a *user experience* boundary, not a
 * security one. Focus Mode restricts you at your own request — there's no
 * adversary to defend against, so there's no reason to enforce it on the
 * server. That's exactly why auth needed a server check and this doesn't.)
 */
export function FocusGuard({
  addonKey,
  children,
}: {
  addonKey: string;
  children: React.ReactNode;
}) {
  const { isHidden } = useFocusMode();
  const { remainingMs, pause } = useTimer();

  if (!isHidden(addonKey)) {
    return <>{children}</>;
  }

  const addon = getAddon(addonKey);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body items-center text-center py-12">
        <div className="text-4xl mb-2" aria-hidden="true">
          🎯
        </div>

        <h1 className="card-title text-2xl">
          {addon?.label ?? "This tool"} is hidden
        </h1>

        <p className="text-base-content/70 max-w-sm">
          You asked for this to be put away during focus sessions.
        </p>

        <div className="text-3xl font-bold tabular-nums text-primary my-2">
          {formatDuration(remainingMs)}
        </div>
        <p className="text-sm text-base-content/60">left in this session</p>

        {/*
          The escape hatch, stated plainly.

          Hiding it would be a small deception: pausing works whether or not we
          mention it, so concealing it only means someone hunts for a way out
          while frustrated. Naming it makes leaving a deliberate choice — which
          is the most a web app can honestly offer, and arguably what you want
          from a focus tool anyway.
        */}
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <Link to="/timer" className="btn btn-primary btn-sm">
            Go to timer
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={pause}>
            Pause session to unlock
          </button>
        </div>

        <p className="text-xs text-base-content/40 mt-4 max-w-xs">
          Focus Mode only hides things inside this app — it can't block other
          sites or apps.
        </p>
      </div>
    </div>
  );
}
