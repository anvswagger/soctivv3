import { type ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { AdminAccessKey } from '@/lib/adminAccess';
import { Button } from '@/components/ui/button';

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
    authRoutingReady,
    authBootstrapState,
    authBootstrapError,
    profile,
    isAdmin,
    isSuperAdmin,
    isApproved,
    hasRole,
    hasAdminAccess,
    onboardingCompleted,
    hasCachedAuth,
    retryUserData,
    signOut,
  } = useAuth();
  const location = useLocation();
  const [retryingBootstrap, setRetryingBootstrap] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleRetryBootstrap = async () => {
    setRetryingBootstrap(true);
    try {
      await retryUserData();
    } finally {
      setRetryingBootstrap(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

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

  if (authBootstrapState === 'error' && !hasCachedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-right space-y-4">
          <h2 className="text-lg font-semibold">تعذر تحميل بيانات الحساب</h2>
          <p className="text-sm text-muted-foreground">
            {authBootstrapError || 'حدث خطأ أثناء تحميل صلاحيات وبيانات المستخدم.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button onClick={handleRetryBootstrap} disabled={retryingBootstrap || signingOut}>
              {retryingBootstrap ? 'جاري إعادة المحاولة...' : 'إعادة المحاولة'}
            </Button>
            <Button variant="outline" onClick={handleSignOut} disabled={retryingBootstrap || signingOut}>
              {signingOut ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Block route decisions until auth routing context is deterministically ready.
  if (!authRoutingReady) {
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


  if (requireAdminAccess && (!isAdmin || !hasAdminAccess(requireAdminAccess))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
