import { useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Calendar, 
  MessageSquare, 
  Settings,
  Shield,
  Building2,
  LogOut,
  Bell
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function AppSidebar() {
  const { profile, roles, signOut, isSuperAdmin, isAdmin, isClient } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  // Menu items for all users
  const mainMenuItems = [
    { title: 'لوحة التحكم', url: '/dashboard', icon: LayoutDashboard },
    { title: 'العملاء المحتملين', url: '/leads', icon: UserPlus },
    { title: 'المواعيد', url: '/appointments', icon: Calendar },
    { title: 'الرسائل', url: '/sms', icon: MessageSquare },
    { title: 'الإشعارات', url: '/notifications', icon: Bell },
  ];

  // Client-only menu items
  const clientMenuItems = [
    { title: 'الإعدادات', url: '/client-settings', icon: Settings },
  ];

  // Admin menu items
  const adminMenuItems = [
    { title: 'إدارة المستخدمين', url: '/users', icon: Users },
    { title: 'إدارة العملاء', url: '/clients', icon: Building2 },
  ];

  // Super admin menu items
  const superAdminMenuItems = [
    { title: 'إعدادات النظام', url: '/settings', icon: Settings },
    { title: 'صلاحيات المسؤولين', url: '/admin-permissions', icon: Shield },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r-0 border-l" side="right" dir="rtl">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-heading font-bold text-sidebar-foreground">نظام CRM</h2>
              <p className="text-xs text-sidebar-foreground/60">إدارة العملاء</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">القائمة الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Client-only menu */}
        {isClient && !isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">حسابي</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {clientMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">الإدارة</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">المسؤول الرئيسي</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Separator className="bg-sidebar-border mb-4" />
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'مستخدم'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {roles[0] === 'super_admin' ? 'مسؤول رئيسي' : 
                 roles[0] === 'admin' ? 'مسؤول' : 'عميل'}
              </p>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
