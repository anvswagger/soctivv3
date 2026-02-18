import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

const INSTALL_PROMPT_DISMISSED_KEY = 'soctiv_install_prompt_dismissed_at';
const INSTALL_PROMPT_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

function getDismissedAt(): number | null {
    try {
        const raw = localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY);
        if (!raw) return null;

        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function setDismissedNow() {
    try {
        localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, String(Date.now()));
    } catch {
        // Ignore storage failures in private mode.
    }
}

function clearDismissed() {
    try {
        localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
    } catch {
        // Ignore storage failures in private mode.
    }
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            const dismissedAt = getDismissedAt();
            const isCoolingDown = dismissedAt !== null && Date.now() - dismissedAt < INSTALL_PROMPT_COOLDOWN_MS;
            if (!isCoolingDown) {
                setIsVisible(true);
            }
        };

        const handleAppInstalled = () => {
            clearDismissed();
            setDeferredPrompt(null);
            setIsVisible(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        const dismissedAt = getDismissedAt();
        const isCoolingDown = dismissedAt !== null && Date.now() - dismissedAt < INSTALL_PROMPT_COOLDOWN_MS;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

        if (isStandalone || isCoolingDown) {
            setIsVisible(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            setDeferredPrompt(null);
            setIsVisible(false);

            if (outcome === 'accepted') {
                clearDismissed();
                toast.success('تم تثبيت التطبيق بنجاح!');
            } else {
                setDismissedNow();
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
        }
    };

    if (!isVisible) return null;

    return (
        <Card className="fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 animate-in slide-in-from-bottom-5 border-primary/20 shadow-lg sm:left-4 sm:right-4 md:left-auto md:right-4 md:w-80" dir="rtl">
            <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Download className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">تثبيت التطبيق</h3>
                            <p className="text-xs text-muted-foreground">قم بتثبيت التطبيق على جهازك للوصول السريع وسهولة الاستخدام.</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                            setDismissedNow();
                            setIsVisible(false);
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <Button onClick={handleInstallClick} className="w-full font-bold">
                    تثبيت الآن
                </Button>
            </CardContent>
        </Card>
    );
}
