import { Bell, Menu, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsFetching, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/format';
import { formatNotificationMessage, getNotificationTypeMeta } from '@/lib/notificationFormatting';
import { cn } from '@/lib/utils';
import { Notification } from '@/types/database';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_POLICY } from '@/lib/queryPolicy';

export function AppHeader() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const {
    data: notifications = [],
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications.header(user?.id),
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    staleTime: QUERY_POLICY.crm.notifications.staleTime,
  });

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const isFetchingNotifications = useIsFetching({ queryKey: queryKeys.notifications.root }) > 0;

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          void refetch();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, user?.id]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)
        .eq('user_id', user?.id ?? '');
    }

    const url = notification.data?.url as string | undefined;
    navigate(url || '/notifications');
  };

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'مستخدم';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:h-16 sm:px-4 lg:px-6" dir="rtl">
      <div className="flex items-center gap-2 sm:gap-4">
        <SidebarTrigger className="h-9 w-9 lg:hidden">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        >
          <Search className="h-5 w-5" />
          <span className="sr-only">بحث سريع</span>
        </Button>

        <div
          className="relative hidden cursor-pointer md:block"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
        >
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            placeholder="بحث سريع (Ctrl+K)..."
            className="w-64 cursor-pointer border-0 bg-muted/50 pr-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {isFetchingNotifications && (
          <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1 rounded-full bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary sm:gap-2">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">جاري تحديث الإشعارات...</span>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center p-0 text-[10px] tabular-nums"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[92vw] max-w-96 p-0">
            <DropdownMenuLabel className="flex items-center justify-between p-3">
              <span>الإشعارات</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {unreadCount} جديد
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
            ) : (
              notifications.map((notification) => {
                const typeMeta = getNotificationTypeMeta(notification.type);

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'cursor-pointer items-start gap-0 px-3 py-3 focus:bg-muted/60',
                      !notification.read && 'bg-primary/5'
                    )}
                  >
                    <div className="w-full space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 rounded-full', typeMeta.dotClassName)} />
                          <span className="line-clamp-1 text-sm font-semibold">{notification.title}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('border px-1.5 py-0 text-[10px] font-medium', typeMeta.badgeClassName)}
                        >
                          {typeMeta.label}
                        </Badge>
                      </div>

                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {formatNotificationMessage(notification.message)}
                      </p>

                      <time className="block text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                        {formatDateTime(notification.created_at)}
                      </time>
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mr-2 hidden text-sm font-medium sm:block">مرحبًا، {firstName}</span>
      </div>
    </header>
  );
}
