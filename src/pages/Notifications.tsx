import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Notification } from '@/types/database';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const db = supabase as any;

const typeColors: Record<string, string> = {
  success: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-info text-info-foreground',
};

const typeLabels: Record<string, string> = {
  success: 'نجاح',
  error: 'خطأ',
  warning: 'تحذير',
  info: 'معلومات',
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await db.from('notifications').select('*').order('created_at', { ascending: false });
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await db.from('notifications').update({ read: true }).eq('id', notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );

    // Navigate to URL if present in data
    const url = notification.data?.url as string | undefined;
    if (url) {
      navigate(url);
    }
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await db.from('notifications').update({ read: true }).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">الإشعارات</h1>
            <p className="text-muted-foreground">جميع الإشعارات الخاصة بك</p>
          </div>
          {notifications.some(n => !n.read) && (
            <Button variant="outline" onClick={markAllAsRead}>تحديد الكل كمقروء</Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <Bell className="h-12 w-12 opacity-20" />
                لا توجد إشعارات
              </div>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/30 ${!notification.read ? 'bg-muted/50 border-primary/20' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{notification.title}</h4>
                          <Badge className={typeColors[notification.type] || typeColors.info} variant="secondary">
                            {typeLabels[notification.type] || notification.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDateTime(notification.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => markAsRead(notification.id, e)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
