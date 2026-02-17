import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  enablePushNotifications,
  getPushErrorMessage,
  getPushPermissionState,
  isPushSupported,
} from '@/lib/pushNotifications';

const DISMISS_KEY = 'soctiv_push_opt_in_dismissed_at';
const DISMISS_DAYS = 30;

function wasDismissedRecently() {
  try {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    const ts = Date.parse(stored);
    if (!Number.isFinite(ts)) return false;
    const ageMs = Date.now() - ts;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
  } catch {
    // ignore storage errors
  }
}

export function PushOptInBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setVisible(false);
      return;
    }
    if (!isPushSupported()) {
      setVisible(false);
      return;
    }
    const permission = getPushPermissionState();
    if (permission !== 'default') {
      setVisible(false);
      return;
    }
    if (wasDismissedRecently()) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [user?.id]);

  const handleDismiss = () => {
    markDismissed();
    setVisible(false);
  };

  const handleEnable = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await enablePushNotifications(user.id);
      toast({
        title: 'تم التفعيل',
        description: 'تم تفعيل الإشعارات بنجاح.',
      });
      markDismissed();
      setVisible(false);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: getPushErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Alert className="mb-6 border-primary/30 bg-primary/5">
      <BellRing className="h-4 w-4" />
      <AlertTitle>تفعيل الإشعارات</AlertTitle>
      <AlertDescription>
        فعّل الإشعارات لتصلك التنبيهات المهمة حول العملاء والمواعيد وتحديثات الموافقة.
      </AlertDescription>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleEnable} disabled={loading}>
          {loading ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
        </Button>
        <Button variant="outline" onClick={handleDismiss} disabled={loading}>
          ليس الآن
        </Button>
      </div>
    </Alert>
  );
}
