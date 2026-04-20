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
    client,
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

  // Check if user needs to provide phone number first
  // Only allow phone onboarding page if phone is missing
  if (!profile?.phone && location.pathname !== '/phone-onboarding' && location.pathname !== '/auth') {
    return <Navigate to="/phone-onboarding" replace />;
  }

  // If user already has phone, don't show phone onboarding page
  if (profile?.phone && location.pathname === '/phone-onboarding') {
    return <Navigate to="/product-onboarding" replace />;
  }

  // Check if user needs to complete post-approval onboarding
  if (isApproved 
      && !isSuperAdmin 
      && !isAdmin 
      && client 
      && (client.company_name === 'New Client' || client.company_name === profile?.full_name)
      && location.pathname !== '/post-approval-onboarding' 
      && location.pathname !== '/pending-approval'
      && location.pathname !== '/product-onboarding') {
    return <Navigate to="/post-approval-onboarding" replace />;
  }

  // Check if user is pending approval
  if (!isApproved && !isSuperAdmin && !isAdmin && location.pathname !== '/pending-approval' && location.pathname !== '/product-onboarding') {
    return <Navigate to="/pending-approval" replace />;
  }

  // If user is already approved, don't show pending approval page
  if (isApproved && location.pathname === '/pending-approval') {
    return onboardingCompleted ? <Navigate to="/dashboard" replace /> : <Navigate to="/product-onboarding" replace />;
  }

  // Only show product onboarding for clients who haven't completed it
  // Only redirect to onboarding if we are NOT already on that page
  if ((!isAdmin && !onboardingCompleted) 
      || (hasRole('client') && !client && location.pathname !== '/product-onboarding' && location.pathname !== '/pending-approval')) {
    if (location.pathname !== '/product-onboarding') {
      return <Navigate to="/product-onboarding" replace />;
    }
  }

  // Allow direct access to dashboard after onboarding
  if (onboardingCompleted && location.pathname === '/product-onboarding') {
    return <Navigate to="/dashboard" replace />;
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
