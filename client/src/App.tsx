import { useApiStatus } from "./hooks/useApiStatus";

/**
 * Response shapes from the two health endpoints in server/src/app.ts.
 *
 * A reminder about what these types are and aren't: TypeScript types disappear
 * when the code runs. These describe what we *expect* the server to send — they
 * are not checked at runtime. If the server's response changes and these don't,
 * TypeScript will keep believing us. Keeping the two in sync automatically is a
 * solvable problem we may return to once there are more endpoints.
 */
type HealthResponse = {
  status: string;
  message: string;
  timestamp: string;
};

type DbHealthResponse = {
  status: string;
  message: string;
  userCount: number;
};

/**
 * One row of the status list.
 *
 * Extracted because we render it twice with different content. This is the
 * *other* kind of extraction — a component owns markup, where the hook in
 * useApiStatus.ts owns behaviour. Together they mean neither the layout nor the
 * fetching logic is duplicated.
 */
function StatusRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: "loading" | "success" | "error";
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {/* text-base-content/60 is a theme-aware colour at 60% opacity, so it
            stays readable in both light and dark themes without us picking two
            separate colours. */}
        <div className="text-xs text-base-content/60 break-words">{detail}</div>
      </div>

      {/* Each branch renders a different DaisyUI badge. */}
      {state === "loading" && (
        <span className="loading loading-spinner loading-sm shrink-0" />
      )}
      {state === "success" && (
        <div className="badge badge-success shrink-0">OK</div>
      )}
      {state === "error" && (
        <div className="badge badge-error shrink-0">Failed</div>
      )}
    </div>
  );
}

function App() {
  // Two calls to the same hook, each with its own independent state. Hooks are
  // not shared between calls — every invocation gets a fresh set of useState
  // slots, which is exactly why this composes cleanly.
  const api = useApiStatus<HealthResponse>("/api/health");
  const db = useApiStatus<DbHealthResponse>("/api/health/db");

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl">Focus Tool</h1>
          <p className="text-base-content/70 text-sm">
            Chunk 2: server and database are connected.
          </p>

          <div className="divider my-1" />

          <StatusRow
            label="API server"
            state={api.state}
            detail={
              api.state === "success" && api.data
                ? `Responded at ${new Date(api.data.timestamp).toLocaleTimeString()}`
                : api.state === "error"
                  ? api.error
                  : "Checking…"
            }
          />

          <StatusRow
            label="Database"
            state={db.state}
            detail={
              db.state === "success" && db.data
                ? `Connected — ${db.data.userCount} user${db.data.userCount === 1 ? "" : "s"} registered`
                : db.state === "error"
                  ? db.error
                  : "Checking…"
            }
          />

          {db.state === "success" && db.data?.userCount === 0 && (
            <div className="alert alert-info mt-3 text-sm">
              <span>
                No accounts yet — signing up is what we build in chunk 3.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
