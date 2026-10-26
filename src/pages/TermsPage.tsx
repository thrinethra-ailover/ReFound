import { Link } from 'react-router-dom';
import { TERMS_VERSION } from '../lib/terms';

const sections = [
  {
    title: '1. What ReFound does',
    body: 'ReFound helps campus users publish lost and found reports, discover possible matches, complete ownership checks, and coordinate returns. It is a matching and communication tool. It is not a property custodian, identity-checking service, insurer, law-enforcement service, or guarantee that an item will be found or returned.',
  },
  {
    title: '2. Claims, verification, and handoffs',
    body: 'A match or a successful answer to verification questions is only an indication; it does not conclusively prove ownership. Users must make their own reasonable checks before handing over property. ReFound and its creator do not control users’ statements, decisions, meetings, or conduct, and cannot guarantee that a claimant is the rightful owner or that a handoff is safe or successful.',
  },
  {
    title: '3. False claims and resulting loss',
    body: 'If someone falsely claims an item, or a user chooses to hand over an item based on another user’s statements or conduct, the resulting loss is outside ReFound’s control. To the fullest extent permitted by applicable law, ReFound and its creator are not responsible for property loss, damage, theft, personal injury, or other harm caused by a user’s false claim, misrepresentation, actions, or a user-to-user handoff. This does not exclude responsibility where applicable law does not allow it to be excluded.',
  },
  {
    title: '4. Use the service responsibly',
    body: 'Provide honest, current information; report only items you lost or found; and do not impersonate anyone, make claims you cannot reasonably support, harass other users, or use ReFound for unlawful activity. Do not put passwords, one-time codes, full payment-card details, or other highly sensitive information in reports or hidden verification answers. Meet in a safe, appropriate place and involve campus staff when needed.',
  },
  {
    title: '5. Reports and hidden details',
    body: 'Keep hidden verification details genuinely private and use them only to help distinguish the rightful owner. They are not a secure vault for credentials or highly sensitive personal data. Authorized administrators may review report details for moderation, support, and safety; administrative access is recorded in the app’s audit log.',
  },
  {
    title: '6. Availability and moderation',
    body: 'ReFound is provided as available. Features, matching results, notifications, and stored content may be delayed, unavailable, changed, or removed. The creator may moderate, restrict, or remove reports or accounts to protect users and the service. No uninterrupted service or recovery outcome is promised.',
  },
  {
    title: '7. ReFound+ support',
    body: 'Any ReFound+ price, plan, and included perks are shown in the app before a support request. Eligible accounts may claim one 24-hour trial; a private record of the account and email used is retained to prevent repeat claims. UPI payments are reviewed manually, and paid access begins only after approval. A submitted request or payment screenshot is not itself confirmation of membership. Any payment and refund rights required by applicable law remain unaffected.',
  },
  {
    title: '8. Limits required by law',
    body: 'Nothing in these Terms removes a right or limits a responsibility that cannot lawfully be removed or limited. These Terms are intended to explain the practical limits of a student-run recovery tool, not to prevent users from exercising rights provided by applicable law.',
  },
];

export function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">ReFound Terms &amp; Conditions</h1>
      <p className="mt-2 text-sm text-slate">Version {TERMS_VERSION} · Please read before creating an account.</p>
      <p className="mt-6 rounded-xl border border-beacon/30 bg-beacon/10 p-4 text-sm leading-6 text-ink">
        ReFound is designed to help people coordinate item returns, but it cannot independently establish ownership or control what users do. Never hand over valuable property solely because a match or verification result looks convincing.
      </p>
      <div className="mt-8 space-y-7">
        {sections.map(({ title, body }) => (
          <section key={title}>
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-slate">
        These Terms are a practical draft for this student-run project, not legal advice. Have the final wording reviewed for your jurisdiction before relying on it as a legal agreement. Read the <Link className="font-semibold text-signal underline" to="/walkthrough">Walkthrough</Link> for help using ReFound.
      </p>
    </article>
  );
}
