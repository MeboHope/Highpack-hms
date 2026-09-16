import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, LogOut, ArrowRight } from 'lucide-react';
import { useAuth, useRouter, useToast } from '@/context/hooks';
import { Brand } from '@/components/Brand';
import { supabase } from '@/lib/supabase';

export function MFAPage() {
  const { session, profile, signOut } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [factorId, setFactorId] = useState('');
  const [factorName, setFactorName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error: factorError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factorError) {
        setError(factorError.message);
      } else {
        const verified = [...(data?.totp ?? []), ...(data?.phone ?? [])].find((factor) => factor.status === 'verified');
        if (!verified) setError('No verified MFA factor is available for this account.');
        else {
          setFactorId(verified.id);
          setFactorName(verified.friendly_name || (verified.factor_type === 'totp' ? 'Authenticator app' : 'Phone verification'));
        }
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || code.trim().length < 6) return;
    setVerifying(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(challengeError.message);
      setVerifying(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError('The verification code was not accepted. Please enter the current code from your authenticator.');
      setVerifying(false);
      return;
    }
    await supabase.auth.refreshSession();
    toast('Multi-factor authentication verified.', 'success');
    const role = profile?.role;
    navigate(role === 'admin' ? '/admin' : role === 'owner' || role === 'agent' ? '/owner' : '/tenant');
    setVerifying(false);
  };

  if (!session) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-3xl border border-ink-100 bg-white p-6 shadow-soft-lg sm:p-10">
          <Brand variant="auth" />
          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-800"><ShieldCheck className="h-7 w-7" /></div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-accent-600">Additional verification</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-950">Confirm your identity</h1>
          <p className="mt-3 text-sm leading-6 text-ink-500">This account has multi-factor authentication enabled. Enter the current verification code to continue.</p>

          {error && <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {!loading && factorId && (
            <form onSubmit={verify} className="mt-7 space-y-5">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-brand-800" /><div><p className="font-semibold text-brand-950">{factorName}</p><p className="text-xs text-ink-500">Use the current 6-digit code.</p></div></div>
              </div>
              <div><label htmlFor="mfa-code" className="label">Verification code</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="input text-center text-xl font-semibold tracking-[0.35em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus /></div>
              <button disabled={verifying || code.length < 6} className="btn-primary w-full" type="submit">{verifying ? 'Verifying…' : 'Verify and continue'} <ArrowRight className="h-4 w-4" /></button>
            </form>
          )}

          <button type="button" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50" onClick={() => void signOut('local')}><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </div>
    </div>
  );
}
