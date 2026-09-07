import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useAuth, useRouter, useToast } from '@/context/hooks';
import { Brand } from '@/components/Brand';
import { getAuthEmailErrorMessage, isAuthEmailRateLimitError } from '@/lib/authErrors';

function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

function AuthShell({ children, eyebrow, title, description }: { children: ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <div className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-soft-lg lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Brand />
            <div className="mt-16 max-w-md">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent-300">HighPark Consult Ltd</p>
              <h1 className="text-4xl font-bold leading-tight text-white">Secure access to your property journey.</h1>
              <p className="mt-5 text-base leading-7 text-ink-300">Recover your account securely and continue managing your tenancy, payments, documents and property services.</p>
            </div>
          </div>
          <p className="text-sm text-ink-400">Trusted property services in Kenya.</p>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden"><Brand /></div>
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">{eyebrow}</p>
              <h2 className="mt-2 text-3xl font-bold text-brand-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((seconds: number) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSent(false);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter the email address associated with your account.');
      return;
    }
    setLoading(true);
    try {
      const result = await requestPasswordReset(cleanEmail);
      if (result.error) {
        setError(getAuthEmailErrorMessage(result.error, 'password_reset'));
        if (isAuthEmailRateLimitError(result.error)) setCooldown(60);
        return;
      }
      setSent(true);
      setCooldown(60);
      toast('Password reset instructions sent.', 'success');
    } catch (requestError) {
      console.error('Password reset request error:', requestError);
      setError('We could not send the password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Account recovery" title="Forgot your password?" description="Enter your email address and we will send you a secure link to create a new password.">
      {error && <div className="mb-5 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
      {sent && <div className="mb-5 flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>Check your inbox for the HighPark Consult password reset link. The link will open a secure page where you can choose a new password.</span></div>}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="label">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
            <input id="reset-email" type="email" className="input pl-11" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
          </div>
        </div>
        <button type="submit" disabled={loading || cooldown > 0} className="btn-accent w-full py-3">{loading ? 'Sending reset link...' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Send reset link'}</button>
      </form>

      <div className="mt-6 text-center text-sm text-ink-500">
        Remembered your password? <Link to="/login" className="font-semibold text-brand-800 hover:text-accent-700">Return to sign in</Link>
      </div>
      <button type="button" onClick={() => navigate('/')} className="mt-4 block w-full text-center text-xs font-semibold text-ink-400 hover:text-brand-700">Back to HighPark Consult</button>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(result.error.toLowerCase().includes('session') ? 'This password reset link is no longer valid. Please request a new reset link.' : result.error);
        return;
      }
      setSuccess(true);
      toast('Your password has been updated.', 'success');
    } catch (updateError) {
      console.error('Password update error:', updateError);
      setError('We could not update your password. Please request a new reset link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Password reset" title="Create a new password" description="Choose a strong password for your HighPark Consult account. This password will replace your old one immediately.">
      {error && <div className="mb-5 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span></div>}
      {success ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <div className="flex gap-3"><CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" /><div><h3 className="font-semibold text-brand-950">Password updated successfully</h3><p className="mt-1 text-sm leading-6 text-brand-800">Your new password is active. You can now sign in securely.</p></div></div>
          <button type="button" onClick={() => navigate('/login')} className="btn-accent mt-5 w-full py-3">Continue to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="new-password" className="label">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
              <input id="new-password" type={showPassword ? 'text' : 'password'} className="input pl-11 pr-11" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-new-password" className="label">Confirm New Password</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
              <input id="confirm-new-password" type={showPassword ? 'text' : 'password'} className="input pl-11" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
            </div>
          </div>
          <p className="text-xs leading-5 text-ink-500">Use at least 10 characters with uppercase, lowercase, a number, and a special character.</p>
          <button type="submit" disabled={loading} className="btn-accent w-full py-3">{loading ? 'Updating password...' : 'Set new password'}</button>
        </form>
      )}
    </AuthShell>
  );
}
