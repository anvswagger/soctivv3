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

// --- Types ---

type AuthBootstrapState = 'loading' | 'ready' | 'error';

type RefreshUserDataOptions = {
  force?: boolean;
  mode?: 'blocking' | 'silent';
  reason?: string;
};

// --- Context ---

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  client: Client | null;
  assignedClients: string[];
  adminAccess: AdminAccessPermissions;
  loading: boolean;
  dataLoading: boolean;
  userDataReady: boolean;
  authRoutingReady: boolean;
  authBootstrapState: AuthBootstrapState;
  authBootstrapError: string | null;
  authDataError: string | null;
  hasCachedAuth: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phone?: string, companyName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAdminAccess: (key: AdminAccessKey) => boolean;
  isApproved: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isClient: boolean;
  onboardingCompleted: boolean;
  refreshUserData: (options?: RefreshUserDataOptions) => Promise<void>;
  retryUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Constants ---

const AUTH_STORAGE_KEYS = [
  'soctiv_auth_profile',
  'soctiv_auth_roles',
  'soctiv_auth_client',
  'soctiv_auth_assigned_clients',
  'soctiv_auth_admin_access',
];
const LAST_AUTH_USER_ID_KEY = 'soctiv_last_auth_user_id';
const AUTH_CACHE_VERSION = 2;
const AUTH_CACHE_TTL_MS = 1000 * 60 * 15;
const SILENT_REFRESH_DEDUP_MS = 5000;
const FETCH_USER_DATA_TIMEOUT_MS = 12_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 60_000;

// Promise cache to deduplicate concurrent fetchUserData calls.
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
  uid: string;
  data: T;
};

function readAuthCache<T>(key: string, fallback: T, expectedUserId: string | null): T {
  const raw = safeStorageGetItem(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<T>>;
    if (parsed?.v !== AUTH_CACHE_VERSION || typeof parsed.exp !== 'number' || typeof parsed.uid !== 'string' || !('data' in parsed)) {
      safeStorageRemoveItem(key);
      return fallback;
    }
    if (!expectedUserId || parsed.uid !== expectedUserId || parsed.exp <= Date.now()) {
      safeStorageRemoveItem(key);
      return fallback;
    }
    return parsed.data as T;
  } catch {
    safeStorageRemoveItem(key);
    return fallback;
  }
}

function writeAuthCache<T>(key: string, data: T, userId: string | null): void {
  if (!userId) {
    safeStorageRemoveItem(key);
    return;
  }

  const payload: AuthCacheEnvelope<T> = {
    v: AUTH_CACHE_VERSION,
    exp: Date.now() + AUTH_CACHE_TTL_MS,
    uid: userId,
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

function hasCachedAuthContext(expectedUserId: string | null): boolean {
  if (!expectedUserId) return false;

  const isValidCacheKey = (key: string): boolean => {
    const raw = safeStorageGetItem(key);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as Partial<AuthCacheEnvelope<unknown>>;
      if (
        parsed?.v !== AUTH_CACHE_VERSION
        || typeof parsed.exp !== 'number'
        || typeof parsed.uid !== 'string'
      ) {
        safeStorageRemoveItem(key);
        return false;
      }
      if (parsed.uid !== expectedUserId || parsed.exp <= Date.now()) {
        safeStorageRemoveItem(key);
        return false;
      }
      return true;
    } catch {
      safeStorageRemoveItem(key);
      return false;
    }
  };

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
  setAuthBootstrapState: (value: AuthBootstrapState) => void;
  setAuthBootstrapError: (value: string | null) => void;
  setAuthDataError: (value: string | null) => void;
}) {
  setters.setProfile(null);
  setters.setRoles([]);
  setters.setClient(null);
  setters.setAssignedClients([]);
  setters.setAdminAccess({ ...DEFAULT_ADMIN_ACCESS_PERMISSIONS });
  setters.setDataLoading(false);
  setters.setUserDataReady(false);
  setters.setAuthBootstrapState('loading');
  setters.setAuthBootstrapError(null);
  setters.setAuthDataError(null);
}

/** Manages the full authentication lifecycle: session bootstrapping, user data fetching, caching, realtime subscriptions, and sign-out cleanup. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const bootstrapUser = readBootstrapUserFromStorage();
  const bootstrapUserId = bootstrapUser?.id ?? null;
  const initialHasCachedAuth = hasCachedAuthContext(bootstrapUserId);

  // --- Provider ---

  const [user, setUser] = useState<User | null>(bootstrapUser);
  const userId = user?.id ?? null;
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() =>
    readAuthCache<Profile | null>('soctiv_auth_profile', null, bootstrapUserId)
  );
  const [roles, setRoles] = useState<AppRole[]>(() =>
    readAuthCache<AppRole[]>('soctiv_auth_roles', [], bootstrapUserId)
  );
  const [client, setClient] = useState<Client | null>(() =>
    readAuthCache<Client | null>('soctiv_auth_client', null, bootstrapUserId)
  );
  const [assignedClients, setAssignedClients] = useState<string[]>(() =>
    readAuthCache<string[]>('soctiv_auth_assigned_clients', [], bootstrapUserId)
  );
  const [adminAccess, setAdminAccess] = useState<AdminAccessPermissions>(() =>
    readAuthCache<AdminAccessPermissions>(
      'soctiv_auth_admin_access',
      { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS },
      bootstrapUserId
    )
  );

  const [loading, setLoading] = useState(true);
  const [hasCachedAuth, setHasCachedAuth] = useState<boolean>(initialHasCachedAuth);
  const [dataLoading, setDataLoading] = useState<boolean>(() => !initialHasCachedAuth);
  const [userDataReady, setUserDataReady] = useState<boolean>(() => initialHasCachedAuth);
  const [authBootstrapState, setAuthBootstrapState] = useState<AuthBootstrapState>(() =>
    initialHasCachedAuth ? 'ready' : 'loading'
  );
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(null);
  const [authDataError, setAuthDataError] = useState<string | null>(null);

  const lastSilentFetchRef = useRef<{ userId: string; at: number } | null>(null);
  const initialSessionHandledRef = useRef(false);
  const lastAuthenticatedUserIdRef = useRef<string | null>(
    bootstrapUserId ?? safeStorageGetItem(LAST_AUTH_USER_ID_KEY)
  );
  const activeFetchGenerationRef = useRef(0);
  const authEventQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isFetchRequestActive = (targetUserId: string, generation: number): boolean => {
    return (
      generation === activeFetchGenerationRef.current
      && lastAuthenticatedUserIdRef.current === targetUserId
    );
  };

  /** Fetches profile, roles, client, and admin-access data for the given user from the repository, updates state, and writes/invalidates the local auth cache. Supports generation-based staleness checks so that overlapping requests for an old user are discarded. */
  const fetchUserData = async (
    targetUserId: string,
    mode: 'blocking' | 'silent' = 'silent',
    options?: { force?: boolean; generation?: number; reason?: string }
  ) => {
    const requestGeneration = options?.generation ?? activeFetchGenerationRef.current;
    const cacheKey = `${targetUserId}:${mode}:${requestGeneration}`;
    const existingPromise = fetchUserDataPromiseCache.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const hasCache = hasCachedAuthContext(targetUserId);
    if (isFetchRequestActive(targetUserId, requestGeneration)) {
      setHasCachedAuth(hasCache);
    }

    const shouldBlock = mode === 'blocking' && !hasCache;
    if (shouldBlock && isFetchRequestActive(targetUserId, requestGeneration)) {
      setDataLoading(true);
    }
    if (mode === 'blocking' && isFetchRequestActive(targetUserId, requestGeneration)) {
      setAuthDataError(null);
      setAuthBootstrapError(null);
      setAuthBootstrapState('loading');
    }

    if (mode === 'silent') {
      const now = Date.now();
      const last = lastSilentFetchRef.current;
      if (!options?.force && last && last.userId === targetUserId && now - last.at < SILENT_REFRESH_DEDUP_MS) {
        return;
      }
      lastSilentFetchRef.current = { userId: targetUserId, at: now };
    }

    const fetchPromise = (async () => {
      try {
        if (!isFetchRequestActive(targetUserId, requestGeneration)) {
          return;
        }

        console.debug('[Auth] Starting fetchUserData', {
          userId: targetUserId,
          mode,
          generation: requestGeneration,
          reason: options?.reason ?? 'unspecified',
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth data fetch timed out')), FETCH_USER_DATA_TIMEOUT_MS)
        );

        await Promise.race([
          (async () => {
            const profileData = await authRepo.getProfile(targetUserId);
            if (!isFetchRequestActive(targetUserId, requestGeneration)) {
              console.debug('[Auth] Dropping stale profile fetch result');
              return;
            }
            setProfile(profileData);
            if (profileData) {
              writeAuthCache('soctiv_auth_profile', profileData, targetUserId);
            } else {
              safeStorageRemoveItem('soctiv_auth_profile');
            }

            const rolesData = await authRepo.getRoles(targetUserId);
            if (!isFetchRequestActive(targetUserId, requestGeneration)) {
              console.debug('[Auth] Dropping stale roles fetch result');
              return;
            }
            const rolesList: AppRole[] = rolesData;
            setRoles(rolesList);
            if (rolesData.length > 0) {
              writeAuthCache('soctiv_auth_roles', rolesList, targetUserId);
            } else {
              safeStorageRemoveItem('soctiv_auth_roles');
            }

            if (rolesList.includes('super_admin') || rolesList.includes('client')) {
              const clientData = await authRepo.getClientByUserId(targetUserId);
              if (!isFetchRequestActive(targetUserId, requestGeneration)) {
                console.debug('[Auth] Dropping stale client fetch result');
                return;
              }
              if (clientData) {
                setClient(clientData as Client);
                writeAuthCache('soctiv_auth_client', clientData, targetUserId);
              } else {
                setClient(null);
                safeStorageRemoveItem('soctiv_auth_client');
              }
            } else {
              setClient(null);
              safeStorageRemoveItem('soctiv_auth_client');
            }

            const isAdminUser = rolesList.includes('admin');
            const isSuperAdminUser = rolesList.includes('super_admin');

            if (isAdminUser) {
              const clientList = await authRepo.getAssignedClientIds(targetUserId);
              if (!isFetchRequestActive(targetUserId, requestGeneration)) {
                console.debug('[Auth] Dropping stale admin-client fetch result');
                return;
              }
              if (clientList.length > 0) {
                setAssignedClients(clientList);
                writeAuthCache('soctiv_auth_assigned_clients', clientList, targetUserId);
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
              writeAuthCache('soctiv_auth_admin_access', defaultAccess, targetUserId);
            } else if (isAdminUser) {
              const accessData = await authRepo.getAdminAccessRow(targetUserId);
              if (!isFetchRequestActive(targetUserId, requestGeneration)) {
                console.debug('[Auth] Dropping stale admin-access fetch result');
                return;
              }
              const normalizedAccess = rowToAdminAccessPermissions(accessData);
              setAdminAccess(normalizedAccess);
              writeAuthCache('soctiv_auth_admin_access', normalizedAccess, targetUserId);

              if (!accessData) {
                const seedAccessError = await authRepo.upsertAdminAccess(
                  targetUserId,
                  adminAccessPermissionsToRow(normalizedAccess)
                );
                if (seedAccessError) {
                  console.error('[Auth] Error seeding admin access row:', seedAccessError);
                }
              }
            } else {
              const defaultAccess = { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
              setAdminAccess(defaultAccess);
              safeStorageRemoveItem('soctiv_auth_admin_access');
            }

            if (!isFetchRequestActive(targetUserId, requestGeneration)) return;
            setHasCachedAuth(hasCachedAuthContext(targetUserId));
          })(),
          timeoutPromise,
        ]);

        if (!isFetchRequestActive(targetUserId, requestGeneration)) {
          return;
        }
        setAuthDataError(null);
        setAuthBootstrapError(null);
        setAuthBootstrapState('ready');
        setUserDataReady(true);
      } catch (error) {
        if (!isFetchRequestActive(targetUserId, requestGeneration)) {
          return;
        }

        console.error('[Auth] Error fetching user data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load user data';
        setAuthDataError(errorMessage);

        if (mode === 'blocking' && !hasCache) {
          AUTH_STORAGE_KEYS.forEach((key) => safeStorageRemoveItem(key));
          setProfile(null);
          setRoles([]);
          setClient(null);
          setAssignedClients([]);
          setAdminAccess({ ...DEFAULT_ADMIN_ACCESS_PERMISSIONS });
          setHasCachedAuth(false);
          setUserDataReady(false);
          setAuthBootstrapState('error');
          setAuthBootstrapError(errorMessage);
          return;
        }

        setAuthBootstrapState('ready');
        setAuthBootstrapError(null);
        setUserDataReady(true);
      } finally {
        if (shouldBlock && isFetchRequestActive(targetUserId, requestGeneration)) {
          setDataLoading(false);
        }
        fetchUserDataPromiseCache.delete(cacheKey);
      }
    })();

    fetchUserDataPromiseCache.set(cacheKey, fetchPromise);
    return fetchPromise;
  };

  const refreshUserData = async (options: RefreshUserDataOptions = {}) => {
    if (!userId) return;
    await fetchUserData(userId, options.mode ?? 'silent', {
      force: options.force ?? true,
      reason: options.reason ?? 'explicit-refresh',
    });
  };

  const retryUserData = async () => {
    if (!userId) return;
    setAuthBootstrapState('loading');
    setAuthBootstrapError(null);
    await fetchUserData(userId, 'blocking', {
      force: true,
      reason: 'manual-retry',
    });
  };

  useEffect(() => {
    const handleAuthStateChange = async (event: AuthChangeEvent, nextSession: Session | null) => {
      const eventGeneration = ++activeFetchGenerationRef.current;

      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      const nextUserId = nextUser?.id ?? null;

      const previousUserId = lastAuthenticatedUserIdRef.current ?? safeStorageGetItem(LAST_AUTH_USER_ID_KEY);
      if (previousUserId && nextUserId && previousUserId !== nextUserId) {
        await clearAuthCaches(() => queryClient.clear());
        if (activeFetchGenerationRef.current === eventGeneration) {
          setHasCachedAuth(false);
        }
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
          setAuthBootstrapState,
          setAuthBootstrapError,
          setAuthDataError,
        });
        fetchUserDataPromiseCache.clear();
        lastSilentFetchRef.current = null;
        await clearAuthCaches(() => queryClient.clear(), true);
        setHasCachedAuth(false);
        setLoading(false);
        if (event === 'INITIAL_SESSION') initialSessionHandledRef.current = true;
        return;
      }

      const hasCache = hasCachedAuthContext(nextUser.id);
      if (activeFetchGenerationRef.current === eventGeneration) {
        setHasCachedAuth(hasCache);
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await fetchUserData(nextUser.id, 'silent', {
          generation: eventGeneration,
          reason: `auth-event:${event}`,
        });
      } else {
        await fetchUserData(nextUser.id, hasCache ? 'silent' : 'blocking', {
          generation: eventGeneration,
          reason: `auth-event:${event}`,
        });
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        void syncPushSubscriptionToDatabase(nextUser.id).catch((error) => {
          console.warn('[Push] Subscription sync failed:', error);
        });
      }

      if (event === 'INITIAL_SESSION') initialSessionHandledRef.current = true;
      if (activeFetchGenerationRef.current === eventGeneration) {
        setLoading(false);
      }
    };

    const enqueueAuthEvent = (event: AuthChangeEvent, nextSession: Session | null) => {
      authEventQueueRef.current = authEventQueueRef.current
        .catch(() => undefined)
        .then(() => handleAuthStateChange(event, nextSession))
        .catch((error) => {
          console.error('[Auth] Auth event queue error:', error);
          setLoading(false);
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        if (initialSessionHandledRef.current) return;
        initialSessionHandledRef.current = true;
      }
      enqueueAuthEvent(event, nextSession);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandledRef.current) return;
      initialSessionHandledRef.current = true;
      enqueueAuthEvent('INITIAL_SESSION', session);
    });

    return () => subscription.unsubscribe();
  // fetchUserData is intentionally excluded to keep auth event subscription stable.
  }, [queryClient]);

  const isAdminContext = roles.includes('admin') || roles.includes('super_admin');

  useEffect(() => {
    if (!userId) return;

    const refreshAuthState = () => {
      void fetchUserData(userId, 'silent', { force: true, reason: 'realtime-or-focus' });
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

    const refreshInterval = window.setInterval(refreshAuthState, BACKGROUND_REFRESH_INTERVAL_MS);

    const userIdFilter = `user_id=eq.${userId}`;
    const profileIdFilter = `id=eq.${userId}`;

    const userRolesChannel = supabase
      .channel(`auth-user-roles-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: userIdFilter }, refreshAuthState)
      .subscribe();

    const profileChannel = supabase
      .channel(`auth-profile-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: profileIdFilter }, refreshAuthState)
      .subscribe();

    const clientChannel = supabase
      .channel(`auth-client-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: userIdFilter }, refreshAuthState)
      .subscribe();

    const approvalRequestsChannel = supabase
      .channel(`auth-approvals-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests', filter: userIdFilter }, refreshAuthState)
      .subscribe();

    // Always create admin channels but only add listeners if user is admin
    // This prevents hook mismatch when isAdminContext changes
    const adminClientsChannel = supabase
      .channel(`auth-admin-clients-${userId}`);
    
    const adminAccessChannel = supabase
      .channel(`auth-admin-access-${userId}`);

    const channels = [userRolesChannel, profileChannel, clientChannel, approvalRequestsChannel, adminClientsChannel, adminAccessChannel];

    if (isAdminContext) {
      adminClientsChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_clients', filter: userIdFilter }, refreshAuthState)
        .subscribe();

      adminAccessChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_access_permissions', filter: userIdFilter }, refreshAuthState)
        .subscribe();
    } else {
      // Subscribe with no listeners to avoid error messages
      adminClientsChannel.subscribe();
      adminAccessChannel.subscribe();
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(refreshInterval);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  // fetchUserData is intentionally excluded to avoid re-subscribing realtime channels every render.
  }, [userId, isAdminContext]);

  const signIn = async (phoneOrEmail: string, password: string) => {
    console.debug('[Auth] signIn attempt for:', phoneOrEmail);
    // Try phone first, fall back to email
    const payload: any = { password };
    if (phoneOrEmail.includes('@')) {
      payload.email = phoneOrEmail;
    } else {
      payload.phone = phoneOrEmail;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword(payload);
    if (error) {
      console.error('[Auth] signIn error:', error.message, error.status);
    } else {
      console.debug('[Auth] signIn success, user:', data.user?.id);
    }
    return { error };
  };

  const signInWithGoogle = async () => {
    console.debug('[Auth] Google sign-in attempt');
    
    // Clear any stale OAuth state before starting new flow
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, '', url.toString());
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
        scopes: 'email profile',
        skipBrowserRedirect: false,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      }
    });
    if (error) {
      console.error('[Auth] Google sign-in error:', error.message, error.status);
    } else {
      console.debug('[Auth] Google sign-in initiated, url:', data?.url);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string, phone?: string, companyName?: string) => {
    const signUpPayload: Parameters<typeof supabase.auth.signUp>[0] = {
      password,
       options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName, phone, company_name: companyName },
      },
    };

    // Use phone as primary identifier when no email is provided
    if (email && email.trim() !== '') {
      signUpPayload.email = email;
    } else if (phone && phone.trim() !== '') {
      signUpPayload.phone = phone;
    } else {
      signUpPayload.email = email;
    }

    const { error } = await supabase.auth.signUp(signUpPayload);
    return { error };
  };

  const signOut = async () => {
    let remoteSignOutError: unknown = null;
    try {
      await signOutWithFallback();
    } catch (error) {
      remoteSignOutError = error;
      console.warn('[Auth] Remote sign-out failed, applying local cleanup anyway:', error);
    } finally {
      activeFetchGenerationRef.current += 1;
      clearUserDataState({
        setProfile,
        setRoles,
        setClient,
        setAssignedClients,
        setAdminAccess,
        setDataLoading,
        setUserDataReady,
        setAuthBootstrapState,
        setAuthBootstrapError,
        setAuthDataError,
      });
      setUser(null);
      setSession(null);
      safeStorageRemoveItem(LAST_AUTH_USER_ID_KEY);
      lastAuthenticatedUserIdRef.current = null;
      lastSilentFetchRef.current = null;
      fetchUserDataPromiseCache.clear();
      await clearAuthCaches(() => queryClient.clear(), true);
      setHasCachedAuth(false);
      setLoading(false);
    }

    if (remoteSignOutError) {
      throw remoteSignOutError instanceof Error
        ? remoteSignOutError
        : new Error('Remote sign-out failed');
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAdminAccess = (key: AdminAccessKey) => {
    if (roles.includes('super_admin')) return true;
    if (!roles.includes('admin')) return false;
    return adminAccess[key] === true;
  };

  const onboardingCompleted = (
    roles.includes('admin')
    || roles.includes('super_admin')
    || (client?.onboarding_completed === true)
  );

  const authRoutingReady = Boolean(user) && authBootstrapState === 'ready';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      client,
      assignedClients,
      adminAccess,
      loading,
      dataLoading,
      userDataReady,
      authRoutingReady,
      authBootstrapState,
      authBootstrapError,
      authDataError,
      hasCachedAuth,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      hasRole,
      hasAdminAccess,
      refreshUserData,
      retryUserData,
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

// --- Hook ---

/** Returns the current authentication context. Must be used inside an `<AuthProvider>`. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
