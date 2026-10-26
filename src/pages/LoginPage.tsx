import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { validateLoginForm } from '../utils/validation';

export function LoginPage() {
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = validateLoginForm({ email, password });
    setErrors(result.errors);
    if (!result.valid) return;

    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
      return;
    }
    showToast('Welcome back!', 'success');
    navigate(from, { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Log in to ReFound</h1>
      <p className="mt-1 text-sm text-slate">Access your reports and dashboard.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {formError && (
          <div className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral-dark" role="alert">
            {formError}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <Button type="submit" loading={submitting} fullWidth size="lg">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Don&rsquo;t have an account?{' '}
        <Link to="/register" className="font-medium text-signal hover:text-signal-dark">
          Sign up
        </Link>
      </p>
    </div>
  );
}
