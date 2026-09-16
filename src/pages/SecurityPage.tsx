import { useEffect, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useAuth, useRouter, useToast } from '@/context/hooks';
import { supabase } from '@/lib/supabase';

interface Factor { id: string; factor_type: 'totp' | 'phone'; status: string; friendly_name?: string | null; }

export function SecurityPage() {
  const { profile, updatePassword, signOut } = useAuth();
  const { navigate } = useRouter();
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enrollId, setEnrollId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors([...((data?.totp ?? []) as Factor[]), ...((data?.phone ?? []) as Factor[])].filter((factor) => factor.status === 'verified'));
  };
  useEffect(() => { void loadFactors(); }, []);

  const enroll = async () => {
    setBusy(true); setMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${profile?.full_name || 'HighPark'} Authenticator` });
    if (error) setMessage(error.message);
    else if (data) { setEnrollId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); }
    setBusy(false);
  };

  const verifyEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollId) return;
    setBusy(true); setMessage(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollId });
    if (challengeError) { setMessage(challengeError.message); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrollId, challengeId: challenge.id, code: mfaCode.trim() });
    if (error) setMessage('That code was not accepted. Please use the current code from your authenticator app.');
    else { setEnrollId(null); setQrCode(null); setSecret(null); setMfaCode(''); await supabase.auth.refreshSession(); await loadFactors(); toast('MFA is now enabled for this account.', 'success'); }
    setBusy(false);
  };

  const removeFactor = async (factorId: string) => {
    if (!window.confirm('Remove this MFA factor? You will need to re-enrol it before MFA protection is restored.')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) setMessage(error.message); else { await loadFactors(); toast('MFA factor removed.', 'success'); }
    setBusy(false);
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || !newPassword) return;
    setBusy(true); setMessage(null);
    const result = await updatePassword(newPassword, password);
    if (result.error) setMessage(result.error); else { setPassword(''); setNewPassword(''); toast('Password changed. Other sessions should be treated as untrusted.', 'success'); }
    setBusy(false);
  };

  return <div className="min-h-screen bg-ink-50 px-4 py-8 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <div className="mb-8"><p className="section-kicker">Account protection</p><h1 className="mt-2 text-3xl font-bold text-brand-950">Security & Sessions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">Protect your HighPark account with multi-factor authentication, password reauthentication and session controls.</p></div>
    {message && <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">{message}</div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-soft"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-brand-950">Multi-factor authentication</h2><p className="mt-1 text-sm leading-6 text-ink-500">Use an authenticator app as a second proof of identity.</p></div><ShieldCheck className="h-6 w-6 text-accent-600" /></div>
        {factors.length ? <div className="mt-5 space-y-3">{factors.map((factor) => <div key={factor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4"><div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-brand-800" /><div><p className="font-semibold text-brand-950">{factor.friendly_name || 'Authenticator app'}</p><p className="text-xs text-green-700">Verified</p></div></div><button type="button" disabled={busy} onClick={() => void removeFactor(factor.id)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-700" aria-label="Remove MFA factor"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-ink-200 p-4 text-sm text-ink-500">MFA is not currently enrolled on this account.</div>}
        {!factors.length && !enrollId && <button type="button" disabled={busy} onClick={() => void enroll()} className="btn-primary mt-5 w-full">{busy ? 'Preparing…' : 'Set up authenticator app'}</button>}
        {enrollId && <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/40 p-4"><p className="text-sm font-semibold text-brand-950">1. Scan this QR code</p>{qrCode && <img src={qrCode} alt="Authenticator setup QR code" className="mx-auto mt-4 h-48 w-48 rounded-xl bg-white p-2" />}{secret && <p className="mt-3 break-all text-center text-xs text-ink-500">Manual setup key: <span className="font-mono font-semibold text-ink-800">{secret}</span></p>}<form onSubmit={verifyEnrollment} className="mt-5"><label className="label" htmlFor="enroll-code">2. Enter the current code</label><input id="enroll-code" className="input text-center tracking-[0.35em]" inputMode="numeric" maxLength={8} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" /><button disabled={busy || mfaCode.length < 6} className="btn-primary mt-3 w-full">{busy ? 'Verifying…' : 'Verify and enable MFA'}</button></form></div>}
      </section>
      <section className="rounded-3xl border border-ink-100 bg-white p-6 shadow-soft"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-brand-950">Password protection</h2><p className="mt-1 text-sm leading-6 text-ink-500">Sensitive password changes require a fresh reauthentication step.</p></div><KeyRound className="h-6 w-6 text-accent-600" /></div>
        <form onSubmit={changePassword} className="mt-5 space-y-4"><div><label className="label" htmlFor="current-password">Current password</label><input id="current-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div><div><label className="label" htmlFor="new-password">New password</label><input id="new-password" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={10} /></div><button disabled={busy || !password || !newPassword} className="btn-primary w-full">{busy ? 'Updating…' : 'Change password'}</button></form>
        <div className="mt-6 border-t border-ink-100 pt-5"><h3 className="font-semibold text-brand-950">Session controls</h3><p className="mt-1 text-sm leading-6 text-ink-500">If you suspect another device is signed in, terminate every active session.</p><button type="button" onClick={() => void signOut('global')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out all devices</button></div>
      </section>
    </div>
    <button type="button" onClick={() => navigate(profile?.role === 'admin' ? '/admin' : profile?.role === 'owner' || profile?.role === 'agent' ? '/owner' : '/tenant')} className="mt-6 text-sm font-semibold text-brand-800 hover:text-accent-700">Return to your workspace</button>
  </div></div>;
}
