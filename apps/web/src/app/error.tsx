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
          The web app could not load data from the API. Locally, start both apps
          from the repo root with <code>npm run dev</code> (API on port 4000,
          web on port 3000).
        </p>
        <p>
          In production, set <code>API_URL</code> on the web app to the backend
          URL. Hosted SQLite still uses <code>TURSO_DATABASE_URL</code> and{" "}
          <code>TURSO_AUTH_TOKEN</code> on the API, not the frontend.
        </p>
        {error.message ? (
          <p className="text-xs text-[var(--muted)]">{error.message}</p>
        ) : null}
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
