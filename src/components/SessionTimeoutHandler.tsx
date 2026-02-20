import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes of inactivity
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000; // 2 minutes before timeout warning
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

interface SessionTimeoutHandlerProps {
    children: React.ReactNode;
}

// Track user activity events
const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

export function SessionTimeoutHandler({ children }: SessionTimeoutHandlerProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, signOut } = useAuth();
    const userId = user?.id ?? null;
    const [showWarning, setShowWarning] = useState(false);
    const [lastActivity, setLastActivity] = useState<number>(Date.now());

    const resetTimeout = useCallback(() => {
        setLastActivity(Date.now());
        setShowWarning(false);
    }, []);

    const handleLogout = useCallback(async () => {
        if (!userId) return;
        try {
            await signOut();
            toast({
                title: 'Session expired',
                description: 'You have been logged out due to inactivity.',
                variant: 'destructive',
            });
            navigate('/auth');
        } catch (error) {
            console.error('Error signing out:', error);
            navigate('/auth');
        }
    }, [navigate, signOut, toast, userId]);

    const handleExtendSession = useCallback(async () => {
        if (!userId) return;
        // Refresh the session
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (!error && session) {
            resetTimeout();
        } else {
            handleLogout();
        }
    }, [resetTimeout, handleLogout, userId]);

    useEffect(() => {
        if (!userId) {
            setShowWarning(false);
            return;
        }
        setLastActivity(Date.now());
    }, [userId]);

    // Track user activity and update last activity timestamp
    useEffect(() => {
        if (!userId) return;

        const updateActivity = () => {
            setLastActivity(Date.now());
        };

        activityEvents.forEach((event) => {
            window.addEventListener(event, updateActivity);
        });

        return () => {
            activityEvents.forEach((event) => {
                window.removeEventListener(event, updateActivity);
            });
        };
    }, [userId]);

    // Monitor idle state
    useEffect(() => {
        if (!userId) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - lastActivity;

            // Show warning 2 minutes before timeout
            if (elapsed > IDLE_TIMEOUT - WARNING_BEFORE_TIMEOUT && !showWarning) {
                setShowWarning(true);
            }

            // Log out if timeout exceeded
            if (elapsed > IDLE_TIMEOUT) {
                handleLogout();
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [lastActivity, showWarning, handleLogout, userId]);

    if (!userId) {
        return <>{children}</>;
    }

    return (
        <>
            {children}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4 border">
                        <h3 className="text-lg font-semibold mb-2">Session Expiring Soon</h3>
                        <p className="text-muted-foreground mb-4">
                            Your session will expire in 2 minutes due to inactivity.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleExtendSession}
                                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
                            >
                                Stay Logged In
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80 px-4 py-2 rounded-md transition-colors"
                            >
                                Log Out Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
