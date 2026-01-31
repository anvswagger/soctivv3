import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Client } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  client: Client | null;
  assignedClients: string[]; // List of client IDs assigned to an admin
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

// Helper to get typed client - types will be generated after migration
const db = supabase as any;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from a previously cached session if available
    const stored = localStorage.getItem('supabase.auth.token');
    if (stored) {
      try {
        return JSON.parse(stored).currentSession?.user ?? null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    const stored = localStorage.getItem('soctiv_auth_profile');
    return stored ? JSON.parse(stored) : null;
  });
  const [roles, setRoles] = useState<AppRole[]>(() => {
    const stored = localStorage.getItem('soctiv_auth_roles');
    return stored ? JSON.parse(stored) : [];
  });
  const [client, setClient] = useState<Client | null>(() => {
    const stored = localStorage.getItem('soctiv_auth_client');
    return stored ? JSON.parse(stored) : null;
  });
  const [assignedClients, setAssignedClients] = useState<string[]>(() => {
    const stored = localStorage.getItem('soctiv_auth_assigned_clients');
    return stored ? JSON.parse(stored) : [];
  });
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchUserData = async (userId: string) => {
    // If we already have cached data, don't set dataLoading to true (silent hydration)
    const hasCache = profile !== null;
    if (!hasCache) setDataLoading(true);

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
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (user) await fetchUserData(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        fetchUserData(newUser.id);
      } else {
        setProfile(null);
        setRoles([]);
        setClient(null);
        setAssignedClients([]);
        setDataLoading(false);
        localStorage.removeItem('soctiv_auth_profile');
        localStorage.removeItem('soctiv_auth_roles');
        localStorage.removeItem('soctiv_auth_client');
        localStorage.removeItem('soctiv_auth_assigned_clients');
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const initialUser = session?.user ?? null;
      setUser(initialUser);
      if (initialUser) {
        fetchUserData(initialUser.id);
      }
      setLoading(false);
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

  const signOut = async () => { await supabase.auth.signOut(); };
  const hasRole = (role: AppRole) => roles.includes(role);

  // Check if onboarding is completed - default to false for new users until client data loads
  const onboardingCompleted = roles.includes('admin') || roles.includes('super_admin') || (client?.onboarding_completed === true);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, client, assignedClients, loading, dataLoading,
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
