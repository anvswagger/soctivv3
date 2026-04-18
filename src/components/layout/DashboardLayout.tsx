import { ReactNode, Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
const AppSidebar = lazy(() =>
  import('./AppSidebar').then((module) => ({ default: module.AppSidebar }))
);
const AppHeader = lazy(() =>
  import('./AppHeader').then((module) => ({ default: module.AppHeader }))
);
const Breadcrumbs = lazy(() =>
  import('./Breadcrumbs').then((module) => ({ default: module.Breadcrumbs }))
);
import { Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { PushOptInBanner } from '@/components/notifications/PushOptInBanner';

interface DashboardLayoutProps {
    children: ReactNode;
    requireApproval?: boolean;
}

export function DashboardLayout({ children, requireApproval = true }: DashboardLayoutProps) {
    const { user, profile } = useAuth();
    useRealtimeSync(!!user);

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    const isPending = profile?.approval_status === 'pending';
    const isRejected = profile?.approval_status === 'rejected';

    return (
        <SidebarProvider>
            <div className="min-h-[100svh] flex w-full bg-background" dir="rtl">
                <Suspense fallback={<div className="hidden lg:block w-64 border-l border-border bg-sidebar" />}>
                    <AppSidebar />
                </Suspense>
                <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                    <Suspense fallback={<div className="h-16 border-b bg-card" />}>
                        <AppHeader />
                    </Suspense>

                    <main className="flex-1 w-full max-w-7xl mx-auto overflow-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] scrollbar-hide scroll-momentum">
                        <Suspense fallback={null}>
                            <Breadcrumbs />
                        </Suspense>
                        <div className="animate-in fade-in duration-300">
                            <PushOptInBanner />
                            {requireApproval && isPending && (
                                <Alert className="mb-6 border-warning/50 bg-warning/5 text-warning-foreground">
                                    <Clock className="h-4 w-4" />
                                    <AlertTitle>حسابك قيد المراجعة</AlertTitle>
                                    <AlertDescription>
                                        شكرًا لتسجيلك! حسابك قيد المراجعة من قبل الإدارة.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {requireApproval && isRejected && (
                                <Alert className="mb-6 border-destructive/50 bg-destructive/5 text-destructive">
                                    <Clock className="h-4 w-4" />
                                    <AlertTitle>تم رفض حسابك</AlertTitle>
                                    <AlertDescription>
                                        نأسف، تم رفض طلب تسجيلك.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
