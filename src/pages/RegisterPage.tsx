import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { validateRegisterForm } from '../utils/validation';
import { fetchCampusVerificationSettings } from '../lib/adminService';

export function RegisterPage() {
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = validateRegisterForm({ fullName, email, password, confirmPassword });
    setErrors(result.errors);
    if (!result.valid) return;
    if (!acceptedTerms) {
      setFormError('Please read and accept the Terms & Conditions to create your account.');
      return;
    }

    setSubmitting(true);
    const { settings, error: settingsError } = await fetchCampusVerificationSettings();
    if (settingsError || !settings) {
      setSubmitting(false);
      setFormError('Could not check campus signup requirements. Please try again.');
      return;
    }
    if (settings.enabled) {
      const domain = email.trim().toLowerCase().split('@').pop() ?? '';
      const allowed = settings.domains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
      if (!allowed) {
        setSubmitting(false);
        setFormError(`Use a campus email ending in ${settings.domains.join(' or ')}.`);
        return;
      }
    }
    const { error } = await signUp(email, password, fullName);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }

    showToast('Account created!', 'success');
    setConfirmationSent(true);
  };

  if (confirmationSent) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 text-center sm:px-6">
        <h1 className="font-display text-2xl font-bold text-ink">Check your inbox</h1>
        <p className="mt-3 text-sm text-slate">
          We&rsquo;ve created your account for <strong className="font-medium text-ink">{email}</strong>. Follow
          the confirmation link we sent before logging in. If campus verification is enabled, you must confirm
          your campus email before using ReFound.
        </p>
        <Button className="mt-6 self-center" onClick={() => navigate('/login')}>
          Go to login
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Create your ReFound account</h1>
      <p className="mt-1 text-sm text-slate">
        Report lost or found items and get matched securely.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {formError && (
          <div className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral-dark" role="alert">
            {formError}
          </div>
        )}
        <Input
          label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          hint="Use your campus email if campus verification is enabled."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />
        <label className="flex items-start gap-3 text-sm leading-6 text-slate">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            required
            className="mt-1 h-4 w-4 shrink-0 accent-signal"
          />
          <span>
            I have read and agree to the{' '}
            <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-signal underline underline-offset-2">
              Terms &amp; Conditions
            </Link>
            , including the item-claim and recovery limitations described there.
          </span>
        </label>
        <Button type="submit" loading={submitting} fullWidth size="lg">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-signal hover:text-signal-dark">
          Log in
        </Link>
      </p>
    </div>
  );
}
