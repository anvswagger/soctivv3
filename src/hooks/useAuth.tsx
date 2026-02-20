import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  SUPABASE_AUTH_STORAGE_KEY,
  LEGACY_SUPABASE_AUTH_STORAGE_KEY,
} from '@/integrations/supabase/client';
import { AppRole, Profile, Client } from '@/types/database';
import { clearPersistedQueryClient } from '@/lib/queryPersistence';
import { syncPushSubscriptionToDatabase } from '@/lib/pushNotifications';
import { authRepo } from '@/repositories/authRepo';
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
const LAST_AUTH_USER_ID_KEY = 'soctiv_last_auth_user_id';
const AUTH_CACHE_VERSION = 1;
const AUTH_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

// Promise cache to deduplicate concurrent fetchUserData calls
const fetchUserDataPromiseCache = new Map<string, Promise<void>>();

function safeStorageGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function safeStorageRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function safeParseStored<T>(key: string, fallback: T): T {
  const raw = safeStorageGetItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    safeStorageRemoveItem(key);
    return fallback;
  }
}

type AuthCacheEnvelope<T> = {
  v: number;
  exp: number;
  data: T;
};

function readAuthCache<T>(key: string, fallback: T): T {
  const raw = safeStorageGetItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<T>>;
    if (parsed?.v !== AUTH_CACHE_VERSION || typeof parsed.exp !== 'number' || !('data' in parsed)) {
      safeStorageRemoveItem(key);
      return fallback;
    }
    if (parsed.exp <= Date.now()) {
      safeStorageRemoveItem(key);
      return fallback;
    }
    return parsed.data as T;
  } catch {
    safeStorageRemoveItem(key);
    return fallback;
  }
}

function writeAuthCache<T>(key: string, data: T): void {
  const payload: AuthCacheEnvelope<T> = {
    v: AUTH_CACHE_VERSION,
    exp: Date.now() + AUTH_CACHE_TTL_MS,
    data,
  };
  safeStorageSetItem(key, JSON.stringify(payload));
}

function resolveAuthStorageCandidates(): string[] {
  return SUPABASE_AUTH_STORAGE_KEY === LEGACY_SUPABASE_AUTH_STORAGE_KEY
    ? [SUPABASE_AUTH_STORAGE_KEY]
    : [SUPABASE_AUTH_STORAGE_KEY, LEGACY_SUPABASE_AUTH_STORAGE_KEY];
}

function readBootstrapUserFromStorage(): User | null {
  type StoredAuthSession = {
    currentSession?: { user?: User | null } | null;
    user?: User | null;
  };

  for (const key of resolveAuthStorageCandidates()) {
    const authToken = safeParseStored<StoredAuthSession>(key, {});
    const cachedUser = authToken.currentSession?.user ?? authToken.user ?? null;
    if (cachedUser) return cachedUser;
  }
  return null;
}

async function clearAuthCaches(
  clearInMemoryQueryCache?: () => void,
  clearSessionStorage: boolean = false,
) {
  AUTH_STORAGE_KEYS.forEach((key) => safeStorageRemoveItem(key));
  if (clearSessionStorage) {
    resolveAuthStorageCandidates().forEach((key) => safeStorageRemoveItem(key));
  }
  clearInMemoryQueryCache?.();
  await clearPersistedQueryClient();
}

async function signOutWithFallback(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (!error) return;

  console.warn('[Auth] Remote sign-out failed; retrying local sign-out:', error);
  const { error: localError } = await supabase.auth.signOut({ scope: 'local' });
  if (localError) {
    throw localError;
  }
}

function hasCachedAuthContext(): boolean {
  const isValidCacheKey = (key: string): boolean => {
    const raw = safeStorageGetItem(key);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<unknown>>;
      if (parsed?.v !== AUTH_CACHE_VERSION || typeof parsed.exp !== 'number') {
        safeStorageRemoveItem(key);
        return false;
      }
      if (parsed.exp <= Date.now()) {
        safeStorageRemoveItem(key);
        return false;
      }
      return true;
    } catch {
      safeStorageRemoveItem(key);
      return false;
    }
  };

  // A partial cache is not enough for safe auth routing decisions.
  const hasRoles = isValidCacheKey('soctiv_auth_roles');
  if (!hasRoles) return false;

  return (
    isValidCacheKey('soctiv_auth_profile')
    || isValidCacheKey('soctiv_auth_client')
    || isValidCacheKey('soctiv_auth_admin_access')
  );
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(() => readBootstrapUserFromStorage());
  const userId = user?.id ?? null;
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
  const lastAuthenticatedUserIdRef = useRef<string | null>(
    user?.id ?? safeStorageGetItem(LAST_AUTH_USER_ID_KEY)
  );

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
        const TIMEOUT_MS = 12000; // 12 seconds
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth data fetch timed out')), TIMEOUT_MS)
        );

        await Promise.race([
          (async () => {
            console.debug('[Auth] Fetching profile for user:', userId);
            const profileData = await authRepo.getProfile(userId);
            setProfile(profileData);
            if (profileData) {
              writeAuthCache('soctiv_auth_profile', profileData);
              setHasCachedAuth(true);
            } else {
              safeStorageRemoveItem('soctiv_auth_profile');
            }

            console.debug('[Auth] Fetching roles for user:', userId);
            const rolesData = await authRepo.getRoles(userId);
            const rolesList: AppRole[] = rolesData;
            setRoles(rolesList);
            if (rolesData.length > 0) {
              writeAuthCache('soctiv_auth_roles', rolesList);
              setHasCachedAuth(true);
            } else {
              safeStorageRemoveItem('soctiv_auth_roles');
            }

            // Fetch client data for super_admins and regular clients
            if (rolesList.includes('super_admin') || rolesList.includes('client')) {
              const clientData = await authRepo.getClientByUserId(userId);
              if (clientData) {
                setClient(clientData as Client);
                writeAuthCache('soctiv_auth_client', clientData);
                setHasCachedAuth(true);
              } else {
                setClient(null);
                safeStorageRemoveItem('soctiv_auth_client');
              }
            } else {
              setClient(null);
              safeStorageRemoveItem('soctiv_auth_client');
            }

            // Fetch assigned clients for admins
            const isAdminUser = rolesList.includes('admin');
            const isSuperAdminUser = rolesList.includes('super_admin');

            if (isAdminUser) {
              const clientList = await authRepo.getAssignedClientIds(userId);
              if (clientList.length > 0) {
                setAssignedClients(clientList);
                writeAuthCache('soctiv_auth_assigned_clients', clientList);
                setHasCachedAuth(true);
              } else {
                setAssignedClients([]);
                safeStorageRemoveItem('soctiv_auth_assigned_clients');
              }
            } else {
              setAssignedClients([]);
              safeStorageRemoveItem('soctiv_auth_assigned_clients');
            }

            if (isSuperAdminUser) {
              const defaultAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
              setAdminAccess(defaultAccess);
              writeAuthCache('soctiv_auth_admin_access', defaultAccess);
              setHasCachedAuth(true);
            } else if (isAdminUser) {
              const accessData = await authRepo.getAdminAccessRow(userId);
              const normalizedAccess = rowToAdminAccessPermissions(accessData);
              setAdminAccess(normalizedAccess);
              writeAuthCache('soctiv_auth_admin_access', normalizedAccess);
              setHasCachedAuth(true);

              if (!accessData) {
                const seedAccessError = await authRepo.upsertAdminAccess(userId, adminAccessPermissionsToRow(normalizedAccess));
                if (seedAccessError) {
                  console.error('[Auth] Error seeding admin access row:', seedAccessError);
                }
              }
            } else {
              const defaultAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
              setAdminAccess(defaultAccess);
              safeStorageRemoveItem('soctiv_auth_admin_access');
            }

            // Refresh derived cache signal after all writes/removals.
            setHasCachedAuth(hasCachedAuthContext());
          })(),
          timeoutPromise
        ]);

        setAuthDataError(null);
        setUserDataReady(true);
      } catch (error) {
        console.error('Error fetching user data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load user data';
        setAuthDataError(errorMessage);

        // If a blocking bootstrap fails with no usable cache, reset to a safe signed-out state
        // to avoid rendering protected screens with incomplete auth context.
        if (mode === 'blocking' && !hasCache) {
          try {
            await signOutWithFallback();
          } catch (signOutError) {
            console.warn('[Auth] Forced sign-out after bootstrap failure failed:', signOutError);
          }
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
          setUser(null);
          setSession(null);
          safeStorageRemoveItem(LAST_AUTH_USER_ID_KEY);
          lastAuthenticatedUserIdRef.current = null;
          setHasCachedAuth(false);
          return;
        }

        // If cache is present, keep app usable and retry in the background.
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
    if (userId) await fetchUserData(userId, 'silent');
  };

  const retryUserData = async () => {
    if (userId) await fetchUserData(userId, 'blocking', { force: true });
  };

  useEffect(() => {
    const handleAuthStateChange = async (event: AuthChangeEvent, nextSession: Session | null) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      const nextUserId = nextUser?.id ?? null;

      // If a different user signs in on the same device/session, clear old in-memory and persisted query caches.
      const previousUserId = lastAuthenticatedUserIdRef.current ?? safeStorageGetItem(LAST_AUTH_USER_ID_KEY);
      if (previousUserId && nextUserId && previousUserId !== nextUserId) {
        await clearAuthCaches(() => queryClient.clear());
        setHasCachedAuth(false);
      }
      lastAuthenticatedUserIdRef.current = nextUserId;
      if (nextUserId) {
        safeStorageSetItem(LAST_AUTH_USER_ID_KEY, nextUserId);
      } else {
        safeStorageRemoveItem(LAST_AUTH_USER_ID_KEY);
      }

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
        void clearAuthCaches(() => queryClient.clear(), true);
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
  }, [queryClient]);

  const isAdminContext = roles.includes('admin') || roles.includes('super_admin');

  useEffect(() => {
    if (!userId) return;

    const refreshAuthState = () => {
      void fetchUserData(userId, 'silent', { force: true });
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

    const userIdFilter = `user_id=eq.${userId}`;
    const userRolesChannel = supabase
      .channel(`auth-user-roles-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: userIdFilter }, () => {
        refreshAuthState();
      })
      .subscribe();

    const channels = [userRolesChannel];

    if (isAdminContext) {
      const adminClientsChannel = supabase
        .channel(`auth-admin-clients-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_clients', filter: userIdFilter }, () => {
          refreshAuthState();
        })
        .subscribe();

      const adminAccessChannel = supabase
        .channel(`auth-admin-access-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_access_permissions', filter: userIdFilter }, () => {
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
  }, [userId, isAdminContext]);

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
    await signOutWithFallback();
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
    safeStorageRemoveItem(LAST_AUTH_USER_ID_KEY);
    lastAuthenticatedUserIdRef.current = null;
    await clearAuthCaches(() => queryClient.clear(), true);
    setHasCachedAuth(false);
  };
  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAdminAccess = (key: AdminAccessKey) => {
    if (roles.includes('super_admin')) return true;
    if (!roles.includes('admin')) return false;
    return adminAccess[key] === true;
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
