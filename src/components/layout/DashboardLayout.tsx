import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  requireApproval?: boolean;
}

export function DashboardLayout({ children, requireApproval = true }: DashboardLayoutProps) {
  const { user, loading, isApproved, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isPending = profile?.approval_status === 'pending';
  const isRejected = profile?.approval_status === 'rejected';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <AppHeader />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {requireApproval && isPending && (
              <Alert className="mb-6 border-warning bg-warning/10">
                <Clock className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">حسابك قيد المراجعة</AlertTitle>
                <AlertDescription>
                  شكراً لتسجيلك! حسابك قيد المراجعة من قبل الإدارة. سيتم إعلامك عند الموافقة.
                </AlertDescription>
              </Alert>
            )}
            {requireApproval && isRejected && (
              <Alert className="mb-6 border-destructive bg-destructive/10">
                <Clock className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">تم رفض حسابك</AlertTitle>
                <AlertDescription>
                  نأسف، تم رفض طلب تسجيلك. يرجى التواصل مع الدعم لمزيد من المعلومات.
                </AlertDescription>
              </Alert>
            )}
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}