import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Client } from '@/types/database';
import { clearPersistedQueryClient } from '@/lib/queryPersistence';
import { syncPushSubscriptionToDatabase } from '@/lib/pushNotifications';
import {
  DEFAULT_ADMIN_ACCESS_PERMISSIONS,
  type AdminAccessKey,
  type AdminAccessPermissions,
  adminAccessPermissionsToRow,
  rowToAdminAccessPermissions,
} from '@/lib/adminAccess';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  client: Client | null;
  assignedClients: string[]; // List of client IDs assigned to an admin
  adminAccess: AdminAccessPermissions;
  loading: boolean;
  dataLoading: boolean; // Blocking hydration only
  userDataReady: boolean; // True once user profile/roles/client context is ready
  authDataError: string | null; // Error message when auth data fetch fails
  hasCachedAuth: boolean; // True when local cache exists for auth context
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string, companyName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAdminAccess: (key: AdminAccessKey) => boolean;
  isApproved: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isClient: boolean;
  onboardingCompleted: boolean;
  refreshUserData: () => Promise<void>;
  retryUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEYS = [
  'soctiv_auth_profile',
  'soctiv_auth_roles',
  'soctiv_auth_client',
  'soctiv_auth_assigned_clients',
  'soctiv_auth_admin_access',
];
const AUTH_CACHE_VERSION = 1;
const AUTH_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

// Promise cache to deduplicate concurrent fetchUserData calls
const fetchUserDataPromiseCache = new Map<string, Promise<void>>();

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

type AuthCacheEnvelope<T> = {
  v: number;
  exp: number;
  data: T;
};

function readAuthCache<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<T>>;
    if (parsed?.v !== AUTH_CACHE_VERSION || typeof parsed.exp !== 'number' || !('data' in parsed)) {
      localStorage.removeItem(key);
      return fallback;
    }
    if (parsed.exp <= Date.now()) {
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed.data as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeAuthCache<T>(key: string, data: T): void {
  const payload: AuthCacheEnvelope<T> = {
    v: AUTH_CACHE_VERSION,
    exp: Date.now() + AUTH_CACHE_TTL_MS,
    data,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

async function clearAuthCaches() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  await clearPersistedQueryClient();
}

function hasCachedAuthContext(): boolean {
  return AUTH_STORAGE_KEYS.some((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<unknown>>;
      if (parsed?.v !== AUTH_CACHE_VERSION || typeof parsed.exp !== 'number') {
        localStorage.removeItem(key);
        return false;
      }
      if (parsed.exp <= Date.now()) {
        localStorage.removeItem(key);
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem(key);
      return false;
    }
  });
}

function clearUserDataState(setters: {
  setProfile: (value: Profile | null) => void;
  setRoles: (value: AppRole[]) => void;
  setClient: (value: Client | null) => void;
  setAssignedClients: (value: string[]) => void;
  setAdminAccess: (value: AdminAccessPermissions) => void;
  setDataLoading: (value: boolean) => void;
  setUserDataReady: (value: boolean) => void;
  setAuthDataError: (value: string | null) => void;
}) {
  setters.setProfile(null);
  setters.setRoles([]);
  setters.setClient(null);
  setters.setAssignedClients([]);
  setters.setAdminAccess({ ...DEFAULT_ADMIN_ACCESS_PERMISSIONS });
  setters.setDataLoading(false);
  setters.setUserDataReady(false);
  setters.setAuthDataError(null);
}

const SILENT_REFRESH_DEDUP_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from a previously cached session if available
    const authToken = safeParseStored<{ currentSession?: { user?: User | null } }>('supabase.auth.token', {});
    return authToken.currentSession?.user ?? null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => readAuthCache<Profile | null>('soctiv_auth_profile', null));
  const [roles, setRoles] = useState<AppRole[]>(() => readAuthCache<AppRole[]>('soctiv_auth_roles', []));
  const [client, setClient] = useState<Client | null>(() => readAuthCache<Client | null>('soctiv_auth_client', null));
  const [assignedClients, setAssignedClients] = useState<string[]>(() => readAuthCache<string[]>('soctiv_auth_assigned_clients', []));
  const [adminAccess, setAdminAccess] = useState<AdminAccessPermissions>(() =>
    readAuthCache<AdminAccessPermissions>('soctiv_auth_admin_access', { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS })
  );
  const [loading, setLoading] = useState(true);
  const [hasCachedAuth, setHasCachedAuth] = useState<boolean>(() => hasCachedAuthContext());
  const [dataLoading, setDataLoading] = useState<boolean>(() => !hasCachedAuthContext());
  const [userDataReady, setUserDataReady] = useState<boolean>(() => hasCachedAuthContext());
  const [authDataError, setAuthDataError] = useState<string | null>(null);
  const lastSilentFetchRef = useRef<{ userId: string; at: number } | null>(null);
  const initialSessionHandledRef = useRef(false);

  const fetchUserData = async (
    userId: string,
    mode: 'blocking' | 'silent' = 'silent',
    options?: { force?: boolean }
  ) => {
    // Check for cached promise to deduplicate concurrent calls
    const cacheKey = `${userId}:${mode}`;
    const existingPromise = fetchUserDataPromiseCache.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const hasCache = hasCachedAuthContext();
    setHasCachedAuth(hasCache);
    const shouldBlock = mode === 'blocking' && !hasCache;
    if (shouldBlock) setDataLoading(true);
    if (mode === 'blocking') setAuthDataError(null);

    if (mode === 'silent') {
      const now = Date.now();
      const last = lastSilentFetchRef.current;
      if (!options?.force && last && last.userId === userId && now - last.at < SILENT_REFRESH_DEDUP_MS) {
        return;
      }
      lastSilentFetchRef.current = { userId, at: now };
    }

    // Create the actual fetch promise and cache it
    const fetchPromise = (async () => {
      try {
        // Add a safety timeout for the entire fetch operation
        const TIMEOUT_MS = 10000; // 10 seconds
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth data fetch timed out')), TIMEOUT_MS)
        );

        await Promise.race([
          (async () => {
            console.debug('[Auth] Fetching profile for user:', userId);
            const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (profileError) {
              console.error('[Auth] Profile fetch error:', profileError.message, profileError.code);
            }
            if (profileData) {
              setProfile(profileData as Profile);
              writeAuthCache('soctiv_auth_profile', profileData);
              setHasCachedAuth(true);
            }

            console.debug('[Auth] Fetching roles for user:', userId);
            const { data: rolesData, error: rolesError } = await supabase.from('user_roles').select('role').eq('user_id', userId);
            if (rolesError) {
              console.error('[Auth] Roles fetch error:', rolesError.message, rolesError.code);
            }
            let rolesList: AppRole[] = [];
            if (rolesData) {
              rolesList = rolesData.map((r) => r.role as AppRole);
              setRoles(rolesList);
              writeAuthCache('soctiv_auth_roles', rolesList);
              setHasCachedAuth(true);
            }

            // Fetch client data for super_admins and regular clients
            if (rolesList.includes('super_admin') || rolesList.includes('client')) {
              const { data: clientData, error: clientError } = await supabase.from('clients').select('*').eq('user_id', userId).single();
              if (clientData && !clientError) {
                setClient(clientData as Client);
                writeAuthCache('soctiv_auth_client', clientData);
                setHasCachedAuth(true);
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
            const isSuperAdminUser = rolesList.includes('super_admin');

            if (isAdminUser) {
              const { data: assignedData, error: assignedError } = await supabase
                .from('admin_clients')
                .select('client_id')
                .eq('user_id', userId);

              if (assignedError) {
                console.error('[Auth] Assigned clients fetch error:', assignedError.message, assignedError.code);
                setAssignedClients([]);
                localStorage.removeItem('soctiv_auth_assigned_clients');
              } else if (assignedData) {
                const clientList = assignedData.map((a) => a.client_id);
                setAssignedClients(clientList);
                writeAuthCache('soctiv_auth_assigned_clients', clientList);
                setHasCachedAuth(true);
              }
            } else {
              setAssignedClients([]);
              localStorage.removeItem('soctiv_auth_assigned_clients');
            }

            if (isSuperAdminUser) {
              const defaultAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
              setAdminAccess(defaultAccess);
              writeAuthCache('soctiv_auth_admin_access', defaultAccess);
              setHasCachedAuth(true);
            } else if (isAdminUser) {
              const { data: accessData, error: accessError } = await supabase
                .from('admin_access_permissions' as any)
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

              // Access control should never block login hydration for admins.
              if (accessError) {
                console.error('[Auth] Admin access fetch error, falling back to defaults:', accessError.message, accessError.code);
                const fallbackAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
                setAdminAccess(fallbackAccess);
                writeAuthCache('soctiv_auth_admin_access', fallbackAccess);
                setHasCachedAuth(true);
              } else {
                const normalizedAccess = rowToAdminAccessPermissions(accessData);
                setAdminAccess(normalizedAccess);
                writeAuthCache('soctiv_auth_admin_access', normalizedAccess);
                setHasCachedAuth(true);

                if (!accessData) {
                  const { error: seedAccessError } = await (supabase.from('admin_access_permissions' as any) as any).upsert(
                    {
                      user_id: userId,
                      ...adminAccessPermissionsToRow(normalizedAccess),
                    },
                    { onConflict: 'user_id' },
                  );

                  if (seedAccessError) {
                    console.error('[Auth] Error seeding admin access row:', seedAccessError);
                  }
                }
              }
            } else {
              const defaultAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
              setAdminAccess(defaultAccess);
              localStorage.removeItem('soctiv_auth_admin_access');
            }
          })(),
          timeoutPromise
        ]);

        setUserDataReady(true);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setAuthDataError(error instanceof Error ? error.message : 'Failed to load user data');
        // If cached auth exists, keep the app usable while showing an explicit error UI.
        // OR if it timed out, let the user proceed with whatever we have (even if empty) to avoid literal "infinite load"
        setUserDataReady(true);
      } finally {
        if (shouldBlock) setDataLoading(false);
        // Always remove from cache after completion to allow future refreshes
        fetchUserDataPromiseCache.delete(cacheKey);
      }
    })();

    // Cache the promise for other concurrent callers
    fetchUserDataPromiseCache.set(cacheKey, fetchPromise);

    return fetchPromise;
  };

  const refreshUserData = async () => {
    if (user) await fetchUserData(user.id, 'silent');
  };

  const retryUserData = async () => {
    if (user) await fetchUserData(user.id, 'blocking', { force: true });
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
          setAdminAccess,
          setDataLoading,
          setUserDataReady,
          setAuthDataError,
        });
        void clearAuthCaches();
        setHasCachedAuth(false);
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

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        // Best-effort: keep server-side push subscriptions in sync for this device.
        void syncPushSubscriptionToDatabase(nextUser.id).catch((error) => {
          console.warn('[Push] Subscription sync failed:', error);
        });
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

  useEffect(() => {
    if (!user) return;
    const isAdminContext = roles.includes('admin') || roles.includes('super_admin');

    const refreshAuthState = () => {
      void fetchUserData(user.id, 'silent', { force: true });
    };

    const handleFocus = () => {
      refreshAuthState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAuthState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const refreshInterval = window.setInterval(refreshAuthState, 60_000);

    const userIdFilter = `user_id=eq.${user.id}`;
    const userRolesChannel = supabase
      .channel(`auth-user-roles-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: userIdFilter }, () => {
        refreshAuthState();
      })
      .subscribe();

    const channels = [userRolesChannel];

    if (isAdminContext) {
      const adminClientsChannel = supabase
        .channel(`auth-admin-clients-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_clients', filter: userIdFilter }, () => {
          refreshAuthState();
        })
        .subscribe();

      const adminAccessChannel = supabase
        .channel(`auth-admin-access-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_access_permissions' as any, filter: userIdFilter }, () => {
          refreshAuthState();
        })
        .subscribe();

      channels.push(adminClientsChannel, adminAccessChannel);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshInterval);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [user?.id, roles.join('|')]);

  const signIn = async (email: string, password: string) => {
    console.debug('[Auth] signIn attempt for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth] signIn error:', error.message, error.status);
    } else {
      console.debug('[Auth] signIn success, user:', data.user?.id);
    }
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
      setAdminAccess,
      setDataLoading,
      setUserDataReady,
      setAuthDataError,
    });
    await clearAuthCaches();
    setHasCachedAuth(false);
  };
  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAdminAccess = (key: AdminAccessKey) => {
    if (roles.includes('super_admin')) return true;
    if (!roles.includes('admin')) return true;
    return adminAccess[key] ?? true;
  };

  // Check if onboarding is completed - default to false for new users until client data loads
  const onboardingCompleted = roles.includes('admin') || roles.includes('super_admin') || (client?.onboarding_completed === true);

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, client, assignedClients, adminAccess, loading, dataLoading, userDataReady,
      authDataError, hasCachedAuth,
      signIn, signUp, signOut, hasRole, hasAdminAccess, refreshUserData, retryUserData,
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
