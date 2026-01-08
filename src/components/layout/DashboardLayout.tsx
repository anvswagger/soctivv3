import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { Loader2, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
    children: ReactNode;
    requireApproval?: boolean;
}

export function DashboardLayout({ children, requireApproval = true }: DashboardLayoutProps) {
    const { user, loading, isApproved, profile } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                    <motion.main
                        className="flex-1 p-6 lg:p-8 overflow-auto scrollbar-hide max-w-7xl mx-auto w-full scroll-momentum"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
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
                            </motion.div>
                        </AnimatePresence>
                    </motion.main>
                </div>
            </div>
        </SidebarProvider>
    );
}
