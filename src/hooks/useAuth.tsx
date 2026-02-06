import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Client } from '@/types/database';
import { clearPersistedQueryClient } from '@/lib/queryPersistence';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  client: Client | null;
  assignedClients: string[]; // List of client IDs assigned to an admin
  loading: boolean;
  dataLoading: boolean; // Blocking hydration only
  userDataReady: boolean; // True once user profile/roles/client context is ready
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

// Helper to get typed client - types will be generated after migration
const db = supabase as any;
const AUTH_STORAGE_KEYS = [
  'soctiv_auth_profile',
  'soctiv_auth_roles',
  'soctiv_auth_client',
  'soctiv_auth_assigned_clients',
];

function safeParseStored<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

async function clearAuthCaches() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  await clearPersistedQueryClient();
}

function hasCachedAuthContext(): boolean {
  return AUTH_STORAGE_KEYS.some((key) => Boolean(localStorage.getItem(key)));
}

function clearUserDataState(setters: {
  setProfile: (value: Profile | null) => void;
  setRoles: (value: AppRole[]) => void;
  setClient: (value: Client | null) => void;
  setAssignedClients: (value: string[]) => void;
  setDataLoading: (value: boolean) => void;
  setUserDataReady: (value: boolean) => void;
}) {
  setters.setProfile(null);
  setters.setRoles([]);
  setters.setClient(null);
  setters.setAssignedClients([]);
  setters.setDataLoading(false);
  setters.setUserDataReady(false);
}

const SILENT_REFRESH_DEDUP_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from a previously cached session if available
    const authToken = safeParseStored<{ currentSession?: { user?: User | null } }>('supabase.auth.token', {});
    return authToken.currentSession?.user ?? null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => safeParseStored<Profile | null>('soctiv_auth_profile', null));
  const [roles, setRoles] = useState<AppRole[]>(() => safeParseStored<AppRole[]>('soctiv_auth_roles', []));
  const [client, setClient] = useState<Client | null>(() => safeParseStored<Client | null>('soctiv_auth_client', null));
  const [assignedClients, setAssignedClients] = useState<string[]>(() => safeParseStored<string[]>('soctiv_auth_assigned_clients', []));
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState<boolean>(() => !hasCachedAuthContext());
  const [userDataReady, setUserDataReady] = useState<boolean>(() => hasCachedAuthContext());
  const lastSilentFetchRef = useRef<{ userId: string; at: number } | null>(null);
  const initialSessionHandledRef = useRef(false);

  const fetchUserData = async (userId: string, mode: 'blocking' | 'silent' = 'silent') => {
    const shouldBlock = mode === 'blocking' && !hasCachedAuthContext();
    if (shouldBlock) setDataLoading(true);

    if (mode === 'silent') {
      const now = Date.now();
      const last = lastSilentFetchRef.current;
      if (last && last.userId === userId && now - last.at < SILENT_REFRESH_DEDUP_MS) {
        return;
      }
      lastSilentFetchRef.current = { userId, at: now };
    }

    try {
      const { data: profileData } = await db.from('profiles').select('*').eq('id', userId).single();
      if (profileData) {
        setProfile(profileData as Profile);
        localStorage.setItem('soctiv_auth_profile', JSON.stringify(profileData));
      }

      const { data: rolesData } = await db.from('user_roles').select('role').eq('user_id', userId);
      let rolesList: AppRole[] = [];
      if (rolesData) {
        rolesList = rolesData.map((r: { role: AppRole }) => r.role);
        setRoles(rolesList);
        localStorage.setItem('soctiv_auth_roles', JSON.stringify(rolesList));
      }

      // Fetch client data for super_admins and regular clients
      // Clients need this to check onboarding_completed status
      if (rolesList.includes('super_admin') || rolesList.includes('client')) {
        const { data: clientData, error: clientError } = await db.from('clients').select('*').eq('user_id', userId).single();
        if (clientData && !clientError) {
          setClient(clientData as Client);
          localStorage.setItem('soctiv_auth_client', JSON.stringify(clientData));
        } else {
          setClient(null);
          localStorage.removeItem('soctiv_auth_client');
        }
      } else {
        setClient(null);
        localStorage.removeItem('soctiv_auth_client');
      }

      // Fetch assigned clients for admins
      const isAdminUser = rolesList.includes('admin');
      if (isAdminUser) {
        const { data: assignedData } = await db.from('admin_clients').select('client_id').eq('user_id', userId);
        if (assignedData) {
          const clientList = assignedData.map((a: { client_id: string }) => a.client_id);
          setAssignedClients(clientList);
          localStorage.setItem('soctiv_auth_assigned_clients', JSON.stringify(clientList));
        }
      } else {
        setAssignedClients([]);
        localStorage.removeItem('soctiv_auth_assigned_clients');
      }
      setUserDataReady(true);
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (hasCachedAuthContext()) {
        setUserDataReady(true);
      }
    } finally {
      if (shouldBlock) setDataLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) await fetchUserData(user.id, 'silent');
  };

  useEffect(() => {
    const handleAuthStateChange = async (event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (!nextUser || event === 'SIGNED_OUT') {
        clearUserDataState({
          setProfile,
          setRoles,
          setClient,
          setAssignedClients,
          setDataLoading,
          setUserDataReady,
        });
        void clearAuthCaches();
        setLoading(false);
        if (event === 'INITIAL_SESSION') initialSessionHandledRef.current = true;
        return;
      }

      const hasCache = hasCachedAuthContext();

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        await fetchUserData(nextUser.id, hasCache ? 'silent' : 'blocking');
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await fetchUserData(nextUser.id, 'silent');
      } else {
        await fetchUserData(nextUser.id, hasCache ? 'silent' : 'blocking');
      }

      if (event === 'INITIAL_SESSION') initialSessionHandledRef.current = true;
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandledRef.current) return;
        initialSessionHandledRef.current = true;
      }
      void handleAuthStateChange(event, nextSession);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandledRef.current) return;
      initialSessionHandledRef.current = true;
      void handleAuthStateChange('INITIAL_SESSION', session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    clearUserDataState({
      setProfile,
      setRoles,
      setClient,
      setAssignedClients,
      setDataLoading,
      setUserDataReady,
    });
    await clearAuthCaches();
  };
  const hasRole = (role: AppRole) => roles.includes(role);

  // Check if onboarding is completed - default to false for new users until client data loads
  const onboardingCompleted = roles.includes('admin') || roles.includes('super_admin') || (client?.onboarding_completed === true);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, client, assignedClients, loading, dataLoading, userDataReady,
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
