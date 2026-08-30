import { useState } from 'react';
import { Home, Mail, Lock, User, Phone, ArrowRight, Building2, Shield, Search } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { UserRole } from '@/lib/supabase';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('customer');

  const isRegister = mode === 'register';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isRegister) {
      const { error } = await signUp(email, password, role, fullName, phone);
      if (error) {
        toast(error, 'error');
      } else {
        toast('Account created successfully! Welcome to Nyumba.', 'success');
        navigate(role === 'owner' ? '/owner' : role === 'admin' ? '/admin' : '/tenant');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast(error, 'error');
      } else {
        toast('Welcome back!', 'success');
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-white">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-2xl text-ink-900">Nyumba</span>
          </Link>

          <h1 className="text-2xl font-bold text-ink-900 mb-2">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-ink-500 mb-8">
            {isRegister ? 'Join Kenya\'s home for property rental and management.' : 'Sign in to manage your properties and tenancy.'}
          </p>

          {isRegister && (
            <div className="mb-6">
              <label className="label">I am a...</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'customer', label: 'Tenant', icon: <Search className="w-5 h-5" /> },
                  { value: 'owner', label: 'Owner', icon: <Building2 className="w-5 h-5" /> },
                  { value: 'admin', label: 'Admin', icon: <Shield className="w-5 h-5" /> },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value as UserRole)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      role === r.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    {r.icon}
                    <span className="text-sm font-medium">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="label">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                    <input className="input pl-11" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Mwangi" />
                  </div>
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                    <input className="input pl-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input type="email" className="input pl-11" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input type="password" className="input pl-11" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-sm text-ink-500 mt-6">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <Link to={isRegister ? '/login' : '/register'} className="text-brand-600 font-semibold hover:underline">
              {isRegister ? 'Sign in' : 'Create one'}
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-bold mb-4 leading-tight">Find, reserve, and manage your home — all from your phone.</h2>
          <p className="text-brand-100 text-lg mb-8">Join thousands of Kenyans using Nyumba to find verified properties, reserve online, and pay rent with M-Pesa.</p>
          <div className="space-y-3">
            {[
              'Browse 500+ verified properties across Kenya',
              'Reserve any house online for just KSh 2,000',
              'Pay rent, track invoices, and manage maintenance',
              'Digital tenancy agreements and receipts',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-brand-50">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
