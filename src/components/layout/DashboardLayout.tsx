import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DashboardLayoutProps {
    children: ReactNode;
    requireApproval?: boolean;
}

export function DashboardLayout({ children, requireApproval = true }: DashboardLayoutProps) {
    const { user, isApproved, profile } = useAuth();

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
                    <main className="flex-1 p-6 lg:p-8 overflow-auto scrollbar-hide max-w-7xl mx-auto w-full scroll-momentum">
                        <div className="animate-in fade-in duration-300">
                            {requireApproval && isPending && (
                                <Alert className="mb-6 border-warning/50 bg-warning/5 text-warning-foreground">
                                    <Clock className="h-4 w-4" />
                                    <AlertTitle>حسابك قيد المراجعة</AlertTitle>
                                    <AlertDescription>
                                        شكراً لتسجيلك! حسابك قيد المراجعة من قبل الإدارة.
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
