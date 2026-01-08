import { Navigate } from 'react-router-dom';
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
  const { user, loading, isAdmin, isSuperAdmin, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  // CRITICAL: Check if user is authenticated
  if (!user) {
    return <Navigate to="/" replace />;
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
