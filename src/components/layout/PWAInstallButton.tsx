import React, { useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Smartphone, Share } from 'lucide-react';
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
                            لإضافة التطبيق إلى شاشتك الرئيسية:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-right dir-rtl">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                                <Share className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اضغط على زر المشاركة</p>
                                <p className="text-xs text-muted-foreground">الأيقونة في أسفل الشاشة</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">1</span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0 text-xs font-bold text-primary">
                                إضافة
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اختر "إضافة إلى الشاشة الرئيسية"</p>
                                <p className="text-xs text-muted-foreground">من القائمة التي ستظهر</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">2</span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0 text-xs font-bold text-primary">
                                تأكيد
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اضغط "إضافة" للتأكيد</p>
                                <p className="text-xs text-muted-foreground">سيظهر التطبيق على شاشتك</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">3</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}