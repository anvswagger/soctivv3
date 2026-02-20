import { type ReactNode } from 'react';
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


  if (requireAdminAccess && (!isAdmin || !hasAdminAccess(requireAdminAccess))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
