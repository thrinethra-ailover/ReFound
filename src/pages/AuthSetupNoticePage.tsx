import { Link } from 'react-router-dom';

export function AuthSetupNoticePage() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-4 py-12">
      <section className="w-full rounded-2xl border border-border bg-white p-8 text-center shadow-card sm:p-10" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-beacon/15 text-beacon-dark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className="font-display mt-5 text-xl font-bold text-ink">ReFound is getting ready</h1>
        <p className="mt-2 text-sm leading-6 text-slate">
          The admin is finishing the setup for accounts. Please check back a little later.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft">
          Back to ReFound
        </Link>
      </section>
    </main>
  );
}
