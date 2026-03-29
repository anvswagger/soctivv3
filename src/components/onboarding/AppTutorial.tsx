import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, MessageSquare, Settings, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { safeLocalGet, safeLocalSet } from '@/lib/safeStorage';

const TUTORIAL_STORAGE_PREFIX = 'soctiv_tutorial_seen_v1';

const steps = [
  {
    title: 'مرحبًا بك في سوكتيف',
    description: 'جولة سريعة لتتعرف على أهم الأقسام وكيف تبدأ خلال أول يوم لك في النظام.',
    icon: Sparkles,
  },
  {
    title: 'لوحة التحكم',
    description: 'تابع الأداء العام، آخر الأنشطة، وأهم المؤشرات بسرعة.',
    icon: LayoutDashboard,
  },
  {
    title: 'الطلبات',
    description: 'إدارة الطلبات حسب الحالة، وتتبع التقدم خطوة بخطوة.',
    icon: Users,
  },
  {
    title: 'الطلبات المؤكدة',
    description: 'تنظيم الطلبات المؤكدة وتحديث الحالة لضمان سير العمليات بسلاسة.',
    icon: Calendar,
  },
  {
    title: 'الرسائل والتنبيهات',
    description: 'أرسل رسائل SMS وتابع الإشعارات المهمة في الوقت المناسب.',
    icon: MessageSquare,
  },
  {
    title: 'الإعدادات',
    description: 'خصص الحساب، التكاملات، وأتمتة التنبيهات حسب احتياجك.',
    icon: Settings,
  },
];

export function AppTutorial() {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const isApproved = profile?.approval_status === 'approved';
  const eligible = Boolean(user && (isAdmin || isSuperAdmin || isApproved));
  const shouldAutoOpen = location.pathname === '/dashboard';
  const storageKey = useMemo(() => (user ? `${TUTORIAL_STORAGE_PREFIX}:${user.id}` : null), [user]);

  useEffect(() => {
    if (!eligible || !shouldAutoOpen || !storageKey) return;
    const seen = safeLocalGet(storageKey) === 'true';
    if (!seen) {
      setStepIndex(0);
      setOpen(true);
    }
  }, [eligible, shouldAutoOpen, storageKey]);

  const closeAndMarkSeen = () => {
    if (storageKey) {
      safeLocalSet(storageKey, 'true');
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (stepIndex >= steps.length - 1) {
      closeAndMarkSeen();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  const currentStep = steps[stepIndex];
  const StepIcon = currentStep.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeAndMarkSeen();
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{currentStep.title}</span>
            <span className="text-xs text-muted-foreground">
              الخطوة {stepIndex + 1} من {steps.length}
            </span>
          </DialogTitle>
          <DialogDescription>{currentStep.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-muted/40 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <StepIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            استكشف القسم المناسب الآن من القائمة الجانبية، وستكون الأمور أوضح مع أول استخدام.
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          {steps.map((_, index) => (
            <span
              key={`tutorial-dot-${index}`}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === stepIndex ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <DialogFooter className="flex-row-reverse justify-between">
          <Button variant="ghost" onClick={closeAndMarkSeen}>
            تخطي الجولة
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBack} disabled={stepIndex === 0}>
              السابق
            </Button>
            <Button onClick={handleNext}>
              {stepIndex === steps.length - 1 ? 'إنهاء' : 'التالي'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
