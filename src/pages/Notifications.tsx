import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { formatNotificationMessage, getNotificationTypeMeta } from '@/lib/notificationFormatting';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/types/database';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    void fetchNotifications();

    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user?.id]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)
        .eq('user_id', user?.id ?? '');

      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
      );
    }

    const url = notification.data?.url as string | undefined;
    if (url) {
      navigate(url);
    }
  };

  const markAsRead = async (id: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user?.id ?? '');
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const hasUnread = notifications.some((item) => !item.read);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-heading font-bold">الإشعارات</h1>
            <p className="text-muted-foreground">كل التنبيهات المهمة الخاصة بحسابك.</p>
          </div>
          {hasUnread && (
            <Button variant="outline" onClick={markAllAsRead}>
              تحديد الكل كمقروء
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Bell className="h-12 w-12 opacity-20" />
                لا توجد إشعارات حاليًا
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const typeMeta = getNotificationTypeMeta(notification.type);

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'group cursor-pointer rounded-xl border p-4 transition-colors',
                        notification.read
                          ? 'hover:bg-muted/40'
                          : 'border-primary/25 bg-primary/5 hover:bg-primary/10'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', typeMeta.dotClassName)} />

                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold leading-6">{notification.title}</h3>
                            <Badge
                              variant="outline"
                              className={cn('border px-2 py-0.5 text-[11px] font-medium', typeMeta.badgeClassName)}
                            >
                              {typeMeta.label}
                            </Badge>
                            {!notification.read && (
                              <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                                جديد
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm leading-6 text-muted-foreground">
                            {formatNotificationMessage(notification.message)}
                          </p>

                          <time className="block text-xs text-muted-foreground tabular-nums" dir="ltr">
                            {formatDateTime(notification.created_at)}
                          </time>
                        </div>

                        {!notification.read && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => markAsRead(notification.id, e)}>
                            <Check className="h-4 w-4" />
                            <span className="sr-only">تحديد الإشعار كمقروء</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
