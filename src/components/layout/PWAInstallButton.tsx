import React, { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

export function PWAInstallButton() {
    const { installPrompt, isStandalone, install, isIOSSafari } = usePWA();
    const [showIOSDialog, setShowIOSDialog] = useState(false);
    const [showAndroidDialog, setShowAndroidDialog] = useState(false);
    const [waitingForPrompt, setWaitingForPrompt] = useState(false);

    useEffect(() => {
        if (installPrompt && waitingForPrompt) {
            setWaitingForPrompt(false);
        }
    }, [installPrompt, waitingForPrompt]);

    if (isStandalone) return null;

    const handleInstallClick = async () => {
        if (installPrompt) {
            const success = await install();
            if (success) {
                toast.success('تم بدء التثبيت!');
            }
        } else if (isIOSSafari) {
            setShowIOSDialog(true);
        } else {
            // Android/Desktop - prompt not ready, show manual instructions
            setShowAndroidDialog(true);
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

            {/* iOS Instructions Dialog */}
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

            {/* Android/Desktop Instructions Dialog */}
            <Dialog open={showAndroidDialog} onOpenChange={setShowAndroidDialog}>
                <DialogContent className="max-w-[90vw] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-right">تثبيت التطبيق</DialogTitle>
                        <DialogDescription className="text-right">
                            لتثبيت التطبيق على جهازك:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-right dir-rtl">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0 text-sm font-bold text-primary">
                                ⋮
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اضغط على قائمة المتصفح</p>
                                <p className="text-xs text-muted-foreground">النقاط الثلاث في أعلى الشاشة</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">1</span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0 text-xs font-bold text-primary">
                                تثبيت
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اختر "تثبيت التطبيق"</p>
                                <p className="text-xs text-muted-foreground">أو "إضافة إلى الشاشة الرئيسية"</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">2</span>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0 text-xs font-bold text-primary">
                                تأكيد
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-sm">اضغط "تثبيت" للتأكيد</p>
                                <p className="text-xs text-muted-foreground">سيظهر التطبيق على جهازك</p>
                            </div>
                            <span className="text-2xl font-bold text-primary/30">3</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
