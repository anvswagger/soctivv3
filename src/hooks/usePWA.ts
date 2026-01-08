import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWA() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            console.log('beforeinstallprompt event fired');
            e.preventDefault();
            setInstallPrompt(e);
        };

        const handleAppInstalled = () => {
            console.log('App successfully installed');
            setInstallPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
            setIsStandalone(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const install = async () => {
        if (!installPrompt) {
            console.warn('Install prompt not deferred yet');
            return false;
        }
        try {
            await installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            if (outcome === 'accepted') {
                setInstallPrompt(null);
                return true;
            }
        } catch (err) {
            console.error('Error during PWA installation:', err);
        }
        return false;
    };

    return { installPrompt, isStandalone, install, canInstall: !!installPrompt };
}
