import { useState } from 'react';
import { Home, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';

interface AuthPageProps {
  mode: 'signin' | 'signup';
  navigate: (path: string) => void;
}

export function AuthPage({ mode, navigate }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(form.email, form.password);
      if (error) setError(error);
      else navigate('/');
    } else {
      if (!form.fullName.trim()) { setError('Please enter your full name'); setLoading(false); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
      const { error } = await signUp(form.email, form.password, form.fullName);
      if (error) setError(error);
      else setSuccess('Account created! You can now sign in.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
              <Home className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Nyumba<span className="text-teal-700">254</span></span>
          </button>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signin' ? 'Sign in to manage your properties and reservations' : 'Join Nyumba254 to find and reserve your dream home'}
          </p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'signin' ? (
              <>Don't have an account? <button onClick={() => navigate('/signup')} className="font-semibold text-teal-700 hover:text-teal-800">Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => navigate('/signin')} className="font-semibold text-teal-700 hover:text-teal-800">Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
