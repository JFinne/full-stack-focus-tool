import { Link } from "react-router-dom";

/**
 * NotFoundPage — shown for any URL that doesn't match a route.
 *
 * Worth having from the start. Without a catch-all, an unmatched URL renders
 * *nothing* — a blank white page with no error, which looks like a crash and
 * gives you no clue what went wrong. A typo in a link should say so.
 */
export function NotFoundPage() {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body items-center text-center py-12">
        <h1 className="card-title text-2xl">Page not found</h1>
        <p className="text-base-content/70">
          That page doesn't exist — check the address, or head back.
        </p>
        <Link to="/" className="btn btn-primary btn-sm mt-2">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
