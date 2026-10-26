import { Link } from 'react-router-dom';

const topics = [
  { title: 'Matches are leads, not proof', body: 'ReFound compares the public parts of lost and found reports and explains why they look similar. A high score cannot establish who owns an item.' },
  { title: 'Ownership answers stay private', body: 'For a found report, the finder records distinctive details that are not shown on public reports. The claimant answers questions without seeing the saved answers; the finder reviews the result. Do not use passwords, full ID numbers, payment details, or other secrets as verification answers.' },
  { title: 'Choose a careful handoff', body: 'Use the in-app conversation to agree on a practical meeting place, preferably a staffed or public campus location. Inspect the item and use your judgment before handing it over. ReFound cannot verify a person’s identity or supervise a meeting.' },
  { title: 'Location is approximate', body: 'Map markers and report locations are intended to help people find one another without publishing exact coordinates. Treat a location as a general clue, not a promise of an exact place.' },
  { title: 'Share only what helps recovery', body: 'Keep public descriptions general enough that they do not reveal every distinctive detail. Use private verification fields for useful item clues, and contact campus staff if a report or interaction feels unsafe.' },
  { title: 'Control your account notifications', body: 'In Profile, you can manage email and push delivery and choose which categories can use those channels. In-app notifications remain available in your notification center.' },
];

export function SafetyPrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-signal">Safety &amp; privacy</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">How ReFound protects you</h1>
      <p className="mt-3 text-sm leading-6 text-slate">ReFound is designed to help people coordinate a return while limiting what they reveal. These safeguards reduce exposure, but they cannot prove ownership or make every interaction risk-free.</p>
      <div className="mt-8 space-y-4">
        {topics.map(({ title, body }) => (
          <section key={title} className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-sm leading-6 text-slate">For account and service terms, read the <Link to="/terms" className="font-semibold text-signal underline underline-offset-2">Terms &amp; Conditions</Link>. If you need help, use in-app support chat when available.</p>
    </article>
  );
}
