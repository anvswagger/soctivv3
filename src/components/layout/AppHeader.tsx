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
import { useIsFetching, useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppHeader() {
  const { profile } = useAuth();
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return data as Notification[];
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const isFetching = useIsFetching();

  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  useEffect(() => {
    const channel = supabase.channel('notifications-changes').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => refetch()
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6" dir="rtl">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="lg:hidden"><Menu className="h-5 w-5" /></SidebarTrigger>
        <div
          className="relative hidden md:block cursor-pointer"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        >
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            readOnly
            placeholder="بحث (Ctrl+K)..."
            className="w-64 pr-9 bg-muted/50 border-0 cursor-pointer"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isFetching > 0 && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-primary/5 text-primary text-[10px] font-medium animate-in fade-in slide-in-from-top-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>جاري المزامنة...</span>
          </div>
        )}
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