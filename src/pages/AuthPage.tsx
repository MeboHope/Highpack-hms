import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Brand } from '@/components/Brand';

function validatePassword(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordError = useMemo(
    () => (isRegister && password ? validatePassword(password) : null),
    [isRegister, password],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (isRegister) {
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      const passwordValidation = validatePassword(password);
      if (passwordValidation) {
        setError(passwordValidation);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const result = await signUp(cleanEmail, password, fullName, phone);
        if (result.error) {
          setError(result.error);
          return;
        }

        setSuccess(
          'Your tenant account has been created. If email confirmation is enabled, check your inbox before signing in.',
        );
        toast('Tenant account created successfully.', 'success');
      } else {
        const result = await signIn(cleanEmail, password);
        if (result.error) {
          setError(result.error);
          return;
        }

        toast('Welcome back to HighPark Consult.', 'success');
        const destination = result.role === 'admin' ? '/admin' : result.role === 'owner' || result.role === 'agent' ? '/owner' : '/tenant';
        navigate(destination);
      }
    } catch (submitError) {
      console.error('Authentication error:', submitError);
      setError('We could not complete that request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-3xl bg-white shadow-soft-lg lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <Brand />
            <div className="mt-16 max-w-md">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent-300">HighPark Consult Ltd</p>
              <h1 className="text-4xl font-bold leading-tight text-white">
                Professional property solutions built around you.
              </h1>
              <p className="mt-5 text-base leading-7 text-ink-300">
                Find verified homes, reserve a unit, manage your tenancy, and keep your property journey organized in one secure platform.
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-400">Trusted property services in Kenya.</p>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Brand />
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">
                {isRegister ? 'Tenant registration' : 'Secure sign in'}
              </p>
              <h2 className="mt-2 text-3xl font-bold text-brand-950">
                {isRegister ? 'Create your tenant account' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                {isRegister
                  ? 'Registration on this website is for tenants only. Owner and administrator accounts are provisioned separately.'
                  : 'Sign in to access your HighPark Consult tenant services.'}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-5 flex gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label htmlFor="fullName" className="label">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                      <input id="fullName" className="input pl-11" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="label">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                      <input id="phone" type="tel" className="input pl-11" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+254 7XX XXX XXX" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                  <input id="email" type="email" className="input pl-11" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
                  <input id="password" type={showPassword ? 'text' : 'password'} className="input pl-11 pr-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} required />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {isRegister && (
                  <p className={`mt-2 text-xs ${passwordError ? 'text-red-600' : 'text-ink-500'}`}>
                    Use at least 10 characters with uppercase, lowercase, a number, and a special character.
                  </p>
                )}
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="confirmPassword" className="label">Confirm Password</label>
                  <input id="confirmPassword" type={showPassword ? 'text' : 'password'} className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-accent w-full py-3">
                {loading ? 'Please wait...' : isRegister ? 'Create Tenant Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-ink-500">
              {isRegister ? (
                <>Already have an account? <Link to="/login" className="font-semibold text-brand-800 hover:text-accent-700">Sign in</Link></>
              ) : (
                <>Don't have an account? <Link to="/register" className="font-semibold text-brand-800 hover:text-accent-700">Create a tenant account</Link></>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
