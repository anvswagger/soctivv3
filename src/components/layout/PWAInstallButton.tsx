import React, { useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Download, Smartphone, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function PWAInstallButton() {
    const { installPrompt, isStandalone, install } = usePWA();
    const [showIOSDialog, setShowIOSDialog] = useState(false);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isStandalone) return null;

    const handleInstallClick = async () => {
        if (installPrompt) {
            const success = await install();
            if (success) {
                console.log('Installation started');
            }
        } else {
            // Fallback: Always show dialog if native prompt is unavailable/unfired
            setShowIOSDialog(true);
        }
    };

    return (
        <>
            <Button
                onClick={handleInstallClick}
                variant="outline"
                className="w-full flex items-center gap-2 justify-start h-10 px-3 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary transition-all font-semibold"
            >
                <Smartphone className="h-4 w-4" />
                <span>تثبيت التطبيق</span>
            </Button>

            <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
                <DialogContent className="max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-right">تثبيت التطبيق</DialogTitle>
                        <DialogDescription className="text-right">
                            اتبع هذه الخطوات البسيطة لإضافة التطبيق إلى شاشتك الرئيسية:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-right dir-rtl">
                        <div className="flex items-center gap-3 justify-end text-sm">
                            <span>1. اضغط على زر **المشاركة** (iOS) أو **قائمة المتصفح** (Android/Desktop)</span>
                            <div className="p-2 bg-muted rounded-lg">
                                <Share className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 justify-end text-sm">
                            <span>2. اختر **"إضافة إلى الشاشة الرئيسية"** أو **"تثبيت التطبيق"**</span>
                            <div className="p-2 bg-muted rounded-lg">
                                <PlusSquare className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 justify-end">
                            <span>3. اضغط على **"إضافة"** في الأعلى</span>
                            <div className="p-2 bg-muted rounded-lg text-xs font-bold">ADD</div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
