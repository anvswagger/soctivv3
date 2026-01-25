import { createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Client } from '@/types/database';
import { useUserSession, useUserData } from '@/hooks/useUser';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  client: Client | null;
  loading: boolean;
  dataLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string, companyName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isApproved: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isClient: boolean;
  onboardingCompleted: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // 1. Get Session
  const { data: session, isLoading: sessionLoading } = useUserSession();
  const user = session?.user ?? null;

  // 2. Get User Data (Dependent on user ID)
  const { data: userData, isLoading: userDataLoading } = useUserData(user?.id);

  // Derived State
  const profile = userData?.profile ?? null;
  const roles = userData?.roles ?? [];
  const client = userData?.client ?? null;

  // Loading State: We are loading if session is checking OR (user exists AND data is loading)
  // If user is null, we are NOT loading data.
  const loading = sessionLoading;
  const dataLoading = !!user && userDataLoading;

  // Actions
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string, companyName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, phone, company_name: companyName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Clear all cache on logout
  };

  const refreshUserData = async () => {
    // Invalidate queries to trigger re-fetch
    if (user?.id) {
      await queryClient.invalidateQueries({ queryKey: ['userData', user.id] });
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  // Check if onboarding is completed
  const onboardingCompleted = roles.includes('admin') || roles.includes('super_admin') || (client?.onboarding_completed === true);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, client, loading, dataLoading,
      signIn, signUp, signOut, hasRole, refreshUserData,
      isApproved: profile?.approval_status === 'approved',
      isSuperAdmin: roles.includes('super_admin'),
      isAdmin: roles.includes('admin') || roles.includes('super_admin'),
      isClient: roles.includes('client'),
      onboardingCompleted,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
