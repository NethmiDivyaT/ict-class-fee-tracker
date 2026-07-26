"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <h1
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Something went wrong
      </h1>

      <div className="panel space-y-3 p-4 text-sm leading-relaxed">
        <p>
          On Vercel this usually means the hosted database is not configured.
          Local <code>data/fees.db</code> cannot be used in production.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Create a free database at{" "}
            <a
              className="text-[var(--accent)] underline"
              href="https://turso.tech"
              target="_blank"
              rel="noreferrer"
            >
              turso.tech
            </a>
          </li>
          <li>
            In Vercel → Project → Settings → Environment Variables, add:
            <ul className="mt-1 list-disc pl-5">
              <li>
                <code>TURSO_DATABASE_URL</code>
              </li>
              <li>
                <code>TURSO_AUTH_TOKEN</code>
              </li>
            </ul>
          </li>
          <li>Redeploy the project.</li>
        </ol>
        {error.digest ? (
          <p className="text-xs text-[var(--muted)]">Digest: {error.digest}</p>
        ) : null}
      </div>

      <button type="button" className="btn-primary" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
