import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getPasswordRecoveryRedirectUrl } from '@/lib/siteUrl';
import type { Profile } from '@/lib/supabase';

export interface StaffAccess {
  isStaff: boolean;
  isSuperAdmin: boolean;
  staffRoleKey: string | null;
  staffRoleName: string | null;
  permissions: string[];
  assignedPropertyIds: string[];
}

interface AuthContextValue {
  session: Session | null;
  user: Session['user'] | null;
  profile: Profile | null;
  staffAccess: StaffAccess;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Profile['role'] | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: string | null; confirmationRequired: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffAccess, setStaffAccess] = useState<StaffAccess>({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('Profile load error:', error);
      setProfile(null);
      return;
    }

    setProfile((data as Profile | null) ?? null);
  }, []);

  const loadStaffAccess = useCallback(async (nextProfile: Profile | null) => {
    if (!nextProfile || nextProfile.role !== 'admin') {
      setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
      return;
    }
    const { data, error } = await supabase.rpc('my_staff_access');
    if (error) {
      console.error('Staff access load error:', error);
      setStaffAccess({ isStaff: true, isSuperAdmin: Boolean(nextProfile.is_super_admin), staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const { data: assignments } = await supabase.from('staff_property_assignments').select('property_id').eq('user_id', nextProfile.id);
    setStaffAccess({
      isStaff: Boolean(row?.is_admin),
      isSuperAdmin: Boolean(row?.is_super_admin ?? nextProfile.is_super_admin),
      staffRoleKey: row?.staff_role_key ? String(row.staff_role_key) : null,
      staffRoleName: row?.staff_role_name ? String(row.staff_role_name) : null,
      permissions: Array.isArray(row?.permissions) ? row.permissions.map(String) : [],
      assignedPropertyIds: (assignments || []).map((item) => String(item.property_id)),
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('Session load error:', error);
          setSession(null);
          setProfile(null);
          setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);

        if (nextSession?.user) {
          await loadProfile(nextSession.user.id);
          const { data: profileData } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle();
          await loadStaffAccess((profileData as Profile | null) ?? null);
        } else {
          setProfile(null);
          setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
        }
      } catch (error) {
        console.error('Authentication initialisation error:', error);
        if (mounted) {
          setSession(null);
          setProfile(null);
          setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initialise();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null);
        setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
        return;
      }

      // Avoid blocking Supabase's auth event callback with another auth call.
      window.setTimeout(() => {
        if (mounted) { void loadProfile(nextSession.user.id).then(async () => { const { data: profileData } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle(); await loadStaffAccess((profileData as Profile | null) ?? null); }); }
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, loadStaffAccess]);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      return { error: error?.message ?? 'Unable to sign in.', role: null };
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return { error: 'Your account profile could not be loaded. Please contact HighPark Consult support.', role: null };
    }

    const nextProfile = profileData as Profile;
    setSession(data.session);
    setProfile(nextProfile);
    await loadStaffAccess(nextProfile);
    return { error: null, role: nextProfile.role };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanPhone = phone?.trim() || undefined;

    // Public registration is deliberately tenant-only. No role is accepted
    // from the browser and no role metadata is sent to Supabase Auth.
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
        },
      },
    });

    if (error) return { error: error.message, confirmationRequired: false };

    if (data.user && data.session) {
      await loadProfile(data.user.id);
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      await loadStaffAccess((profileData as Profile | null) ?? null);
      return { error: null, confirmationRequired: false };
    }

    // Supabase returns a user without a session when email confirmation is required.
    return { error: null, confirmationRequired: Boolean(data.user) };
  };

  const resendConfirmation = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });
    return { error: error?.message ?? null }; 
  };

  const requestPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const redirectTo = getPasswordRecoveryRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign-out error:', error);
    setProfile(null);
    setStaffAccess({ isStaff: false, isSuperAdmin: false, staffRoleKey: null, staffRoleName: null, permissions: [], assignedPropertyIds: [] });
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session?.user) { await loadProfile(session.user.id); const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); await loadStaffAccess((profileData as Profile | null) ?? null); }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        staffAccess,
        loading,
        signIn,
        signUp,
        resendConfirmation,
        requestPasswordReset,
        updatePassword,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
