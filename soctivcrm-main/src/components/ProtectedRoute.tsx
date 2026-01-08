import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

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
  const { loading, isAdmin, isSuperAdmin, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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
