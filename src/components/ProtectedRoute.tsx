import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

type AppRole = 'super_admin' | 'admin' | 'client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: AppRole[];
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireRole,
  requireAdmin,
  requireSuperAdmin
}: ProtectedRouteProps) {
  const { user, loading, dataLoading, isAdmin, isSuperAdmin, isApproved, hasRole, onboardingCompleted } = useAuth();
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
    return <Navigate to="/" replace />;
  }

  // Check onboarding status for clients (not admins)
  if (!isAdmin && !onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Check approval status for clients who completed onboarding
  if (!isAdmin && onboardingCompleted && !isApproved && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Prevent approved users from accessing pending-approval page
  if (isApproved && location.pathname === '/pending-approval') {
    return <Navigate to="/dashboard" replace />;
  }

  // Prevent users who completed onboarding from accessing onboarding page
  if (onboardingCompleted && location.pathname === '/onboarding') {
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

  return <>{children}</>;
}
