import { Link } from 'react-router-dom';
import { useIsCreator } from '../../hooks/useIsCreator';

export function Footer() {
  const { isCreator, loading: creatorLoading } = useIsCreator();
  return (
    <footer className="border-t border-border py-6 text-center text-xs text-slate">
      <p>ReFound — a privacy-aware campus Lost &amp; Found recovery network.</p>
      <div className="mt-3 flex justify-center gap-4">
        {!isCreator && <Link to="/walkthrough" className="underline underline-offset-2">Walkthrough</Link>}
        <Link to="/terms" className="underline underline-offset-2">Terms &amp; Conditions</Link>
        <Link to="/safety" className="underline underline-offset-2">Safety &amp; privacy</Link>
      </div>
      {!creatorLoading && !isCreator && <Link to="/support" className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-signal transition-colors hover:border-signal/40 hover:bg-signal/5">
        <span aria-hidden="true">✦</span> Support ReFound
      </Link>}
      <p className="mt-3">
        Synonym data: <a className="underline underline-offset-2" href="https://en-word.net/" target="_blank" rel="noreferrer">Open English Wordnet 2025</a>
        {' '}under <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> (adapted).
      </p>
    </footer>
  );
}
