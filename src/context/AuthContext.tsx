import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: Session['user'] | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Profile['role'] | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);

        if (nextSession?.user) {
          await loadProfile(nextSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Authentication initialisation error:', error);
        if (mounted) {
          setSession(null);
          setProfile(null);
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
        return;
      }

      // Avoid blocking Supabase's auth event callback with another auth call.
      window.setTimeout(() => {
        if (mounted) void loadProfile(nextSession.user.id);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

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

    if (error) return { error: error.message };

    if (data.user && data.session) {
      await loadProfile(data.user.id);
    }

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Sign-out error:', error);
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
