import { Bell, Search, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Notification } from '@/types/database';

const db = supabase as any;

export function AppHeader() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
      if (data) {
        setNotifications(data as Notification[]);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
      }
    };
    fetchNotifications();

    const channel = supabase.channel('notifications-changes').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => fetchNotifications()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAsRead = async (id: string) => {
    await db.from('notifications').update({ read: true }).eq('id', id);
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6" dir="rtl">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="lg:hidden"><Menu className="h-5 w-5" /></SidebarTrigger>
        <div className="relative hidden md:block">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث..." className="w-64 pr-9 bg-muted/50 border-0" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs" variant="destructive">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>الإشعارات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">لا توجد إشعارات</div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} onClick={() => markAsRead(notification.id)}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}>
                  <span className="font-medium">{notification.title}</span>
                  <span className="text-xs text-muted-foreground">{notification.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-sm font-medium hidden sm:block mr-2">مرحباً، {profile?.full_name?.split(' ')[0] || 'مستخدم'}</span>
      </div>
    </header>
  );
}