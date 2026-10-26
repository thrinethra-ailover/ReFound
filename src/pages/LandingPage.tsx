import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const MECHANISMS = [
  {
    step: '01',
    title: 'MATCH',
    body: 'A deterministic engine compares every new lost and found report on category, description, color, distance, and time — then shows an explainable confidence score. Never a black box, never an LLM guess.',
  },
  {
    step: '02',
    title: 'VERIFY',
    body: 'A high score is a lead, not proof. The claimant privately answers details recorded by the finder — a scratch, a sticker, what’s inside — and the finder reviews the results before arranging a handoff.',
  },
  {
    step: '03',
    title: 'RECOVER',
    body: 'Once ownership is confirmed, arrange a handoff through private, in-app messaging and track every step on a shared recovery timeline until the item is back where it belongs.',
  },
];

const FEATURES = [
  {
    title: 'Smart Matching',
    body: 'Every lost/found pair is scored by a transparent, testable algorithm — category, keywords, color, distance, and time — with the exact reasons shown to you.',
  },
  {
    title: 'Proximity Assist',
    body: 'Opt in to get an anonymized "keep an eye out" alert when you\u2019re near an unresolved lost item. Off by default. Your live location is never stored.',
  },
  {
    title: 'Blind Ownership Verification',
    body: 'Finders set private details they observed on the item. Claimants answer blind — they see pass/fail, never the saved answer — and the finder reviews the results before accepting the claim.',
  },
  {
    title: 'Privacy-Preserving Communication',
    body: 'Message the other party without ever sharing your email or phone number. Conversations stay tied to the recovery — never open, never global.',
  },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-mono uppercase tracking-wider text-beacon">
              Campus recovery network
            </span>
            <h1 className="font-display mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              Don&rsquo;t just report a lost item.
              <br />
              Help recover it.
            </h1>
            <p className="mt-4 max-w-lg text-white/70">
              ReFound compares lost and found reports with an explainable matching engine, then
              protects ownership with private, blind verification before anyone connects. No
              guesswork. No exposure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-dark"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="rounded-xl bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-dark"
                  >
                    Create an account
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-xl border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/10"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-80 sm:w-80" aria-hidden="true">
            <span className="beacon-ring landing-hero-orbit absolute h-40 w-40 rounded-full border border-beacon/60" />
            <span
              className="beacon-ring landing-hero-orbit absolute h-40 w-40 rounded-full border border-beacon/60"
              style={{ animationDelay: '0.9s' }}
            />
            <span
              className="beacon-ring landing-hero-orbit absolute h-40 w-40 rounded-full border border-beacon/60"
              style={{ animationDelay: '1.8s' }}
            />
            <span className="landing-hero-pin relative flex h-24 w-24 items-center justify-center rounded-full bg-beacon text-ink shadow-card-hover">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 21c4-4.5 7-8.2 7-11.2A7 7 0 0 0 5 9.8C5 12.8 8 16.5 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-ink">The three mechanisms behind every recovery</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {MECHANISMS.map((mechanism) => (
            <div
              key={mechanism.title}
              className="relative overflow-hidden rounded-card border border-border bg-white p-6 shadow-card"
            >
              <span className="font-mono text-xs text-signal">{mechanism.step}</span>
              <h3 className="font-display mt-2 text-xl font-bold tracking-tight text-ink">{mechanism.title}</h3>
              <p className="mt-3 text-sm text-slate">{mechanism.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-white/60 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Everything ReFound does for you</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-card border border-border bg-white p-5 shadow-card">
                <h3 className="font-display text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-ink">Ready to get your things back?</h2>
          <p className="mt-2 text-sm text-slate">
            Reporting takes under a minute. ReFound starts watching for matches immediately.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {user ? (
              <Link to="/report" className="rounded-xl bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-dark">
                Report an item
              </Link>
            ) : (
              <Link
                to="/register"
                className="rounded-xl bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-dark"
              >
                Create a free account
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
