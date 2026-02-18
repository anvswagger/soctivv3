import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { AdminAccessKey } from '@/lib/adminAccess';

import { AppRole } from '@/types/database';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: AppRole[];
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  requireAdminAccess?: AdminAccessKey;
}

export function ProtectedRoute({
  children,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireAdminAccess,
}: ProtectedRouteProps) {
  const {
    user,
    loading,
    userDataReady,
    authDataError,
    retryUserData,
    signOut,
    profile,
    isAdmin,
    isSuperAdmin,
    isApproved,
    hasRole,
    hasAdminAccess,
    onboardingCompleted,
    hasCachedAuth,
  } = useAuth();
  const location = useLocation();

  const AUTH_ERROR_SNOOZE_KEY = 'soctiv_auth_error_snooze_until';
  const AUTH_ERROR_SNOOZE_MS = 1000 * 60 * 15; // 15 minutes

  const [authErrorSnoozeUntil, setAuthErrorSnoozeUntil] = useState<number>(() => {
    try {
      return Number(sessionStorage.getItem(AUTH_ERROR_SNOOZE_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  const isAuthErrorSnoozed = hasCachedAuth && authErrorSnoozeUntil > Date.now();

  // ONLY block if we are truly cold-starting with no user info at all.
  // If we have a 'user' (even if data is still loading), we proceed to render
  // the protected shell to avoid the "flicker".
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  // CRITICAL: Check if user is authenticated
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (authDataError && !isAuthErrorSnoozed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">تعذر تحميل بيانات الحساب</h1>
          <p className="text-muted-foreground">
            حدثت مشكلة أثناء جلب بيانات حسابك. يمكنك المحاولة مرة أخرى الآن.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                try { sessionStorage.removeItem(AUTH_ERROR_SNOOZE_KEY); } catch { /* sessionStorage unavailable in private browsing */ }
                setAuthErrorSnoozeUntil(0);
                void retryUserData();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              إعادة المحاولة
            </button>
            {hasCachedAuth && (
              <button
                onClick={() => {
                  const until = Date.now() + AUTH_ERROR_SNOOZE_MS;
                  try { sessionStorage.setItem(AUTH_ERROR_SNOOZE_KEY, String(until)); } catch { /* sessionStorage unavailable in private browsing */ }
                  setAuthErrorSnoozeUntil(until);
                }}
                className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
              >
                المتابعة بالبيانات المخزنة مؤقتًا
              </button>
            )}
            <button
              onClick={() => void signOut()}
              className="px-4 py-2 text-destructive hover:underline"
            >
              تسجيل الخروج
            </button>
          </div>
          {hasCachedAuth && (
            <p className="text-xs text-muted-foreground">
              سيتم استخدام بيانات قديمة مؤقتًا حتى تتوفر الشبكة.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Block only while user auth context is not yet ready for safe routing decisions.
  // OPTIMIZATION: If we have cached auth data, we proceed anyway to avoid the "flicker".
  // The background refresh will update the UI once ready.
  if (!userDataReady && !hasCachedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  // Check onboarding status for clients (not admins)
  if (!isAdmin && !onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  const isRejected = profile?.approval_status === 'rejected';

  // Check approval status for clients who completed onboarding
  if (!isAdmin && onboardingCompleted && !isApproved && location.pathname !== '/pending-approval' && !(isRejected && location.pathname === '/onboarding')) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Prevent approved users from accessing pending-approval page
  if (isApproved && location.pathname === '/pending-approval') {
    return <Navigate to="/dashboard" replace />;
  }

  // Prevent users who completed onboarding from accessing onboarding page
  if (onboardingCompleted && location.pathname === '/onboarding' && !isRejected) {
    return <Navigate to={isApproved ? '/dashboard' : '/pending-approval'} replace />;
  }

  // Role-based access control
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireRole && !requireRole.some(role => hasRole(role))) {
    return <Navigate to="/dashboard" replace />;
  }


  if (requireAdminAccess && !hasAdminAccess(requireAdminAccess)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
