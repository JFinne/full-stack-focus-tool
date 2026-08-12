/**
 * ComingSoon — a shared placeholder for tools that don't exist yet.
 *
 * The routes and navigation are real; the destinations aren't built. Rather
 * than four near-identical stub files that drift apart, each page passes its
 * own text into this one component.
 *
 * The point of shipping the shell before the tools: navigation, layout, and
 * routing are much easier to get right against empty pages than to retrofit
 * around four finished features.
 */
export function ComingSoon({
  title,
  chunk,
  description,
}: {
  title: string;
  chunk: string;
  description: string;
}) {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body items-center text-center py-12">
        <div className="badge badge-outline">{chunk}</div>
        <h1 className="card-title text-2xl mt-2">{title}</h1>
        <p className="text-base-content/70 max-w-md">{description}</p>
      </div>
    </div>
  );
}
