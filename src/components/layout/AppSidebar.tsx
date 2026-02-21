import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    Briefcase,
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Calendar,
    Video,
} from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { leadsService } from '@/services/leadsService';
import { appointmentsService } from '@/services/appointmentsService';
import type { AdminAccessKey } from '@/lib/adminAccess';
import { queryKeys } from '@/lib/queryKeys';

interface SidebarItem {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    superAdminOnly?: boolean;
    adminOnly?: boolean;
    accessKey?: AdminAccessKey;
}

const items: SidebarItem[] = [
    { title: 'الرئيسية', url: '/dashboard', icon: LayoutDashboard },
    { title: 'العملاء المحتملون', url: '/leads', icon: Briefcase, accessKey: 'leads' },
    { title: 'المواعيد', url: '/appointments', icon: Calendar, accessKey: 'appointments' },
    { title: 'الأداء', url: '/setter-stats', icon: LayoutDashboard, superAdminOnly: true },
    { title: 'المكتبة', url: '/library', icon: Video, accessKey: 'library' },
    { title: 'العملاء', url: '/clients', icon: Users, adminOnly: true, accessKey: 'clients' },
    { title: 'الإعدادات', url: '/settings', icon: Settings, accessKey: 'settings' },
];

export function AppSidebar() {
    const location = useLocation();
    const { user, isAdmin, isSuperAdmin, profile, client, signOut, hasAdminAccess } = useAuth();
    const { isMobile, setOpenMobile } = useSidebar();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const prefetchData = (url: string) => {
        if (url === '/leads') {
            const filters = isAdmin ? {} : { clientId: client?.id };
            queryClient.prefetchQuery({
                queryKey: queryKeys.leads.list(1, 50, filters),
                queryFn: () => leadsService.getLeads(1, 50, filters),
            });
        } else if (url === '/appointments') {
            queryClient.prefetchQuery({
                queryKey: queryKeys.appointments.root,
                queryFn: () => appointmentsService.getAppointments(),
            });
        }
    };

    const handleLogout = async () => {
        if (isMobile) {
            setOpenMobile(false);
        }

        try {
            await signOut();
        } catch (error) {
            console.error('Logout error:', error);
        }
        navigate('/auth', { replace: true });
    };

    const filteredItems = items.filter((item) => {
        if (item.superAdminOnly) return isSuperAdmin;
        if (item.adminOnly && !isAdmin) return false;

        if (item.accessKey && !isAdmin) return false;
        if (item.accessKey && !isSuperAdmin && !hasAdminAccess(item.accessKey)) {
            return false;
        }

        return true;
    });

    return (
        <Sidebar
            className="border-l border-sidebar-border bg-sidebar text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/95"
            side="right"
        >
            <SidebarHeader className="p-5 pb-2">
                <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sidebar-primary" />
                    Soctiv
                </h1>
            </SidebarHeader>

            <SidebarContent className="px-3 py-6">
                <SidebarGroup>
                    <SidebarGroupLabel className="px-3 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-widest mb-1">
                        القائمة
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredItems.map((item) => {
                                const isActive = location.pathname === item.url;

                                const handleItemClick = () => {
                                    hapticLight();
                                    if (isMobile) {
                                        setOpenMobile(false);
                                    }
                                };

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            onClick={handleItemClick}
                                            className="group h-10 px-3 text-sm font-medium text-sidebar-foreground/85 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground transition-colors rounded-lg overflow-hidden relative"
                                        >
                                            <Link
                                                to={item.url}
                                                className="flex items-center gap-3 w-full h-full"
                                                onMouseEnter={() => prefetchData(item.url)}
                                            >
                                                <motion.div
                                                    className="flex items-center gap-3 w-full h-full"
                                                    whileHover={{ x: -2 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <item.icon className={cn('h-4 w-4', isActive && 'text-sidebar-primary')} />
                                                    <span>{item.title}</span>
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="sidebar-active"
                                                            className="absolute right-0 top-1 bottom-1 w-1 bg-sidebar-primary rounded-l-full"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ duration: 0.2 }}
                                                        />
                                                    )}
                                                </motion.div>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-sidebar-border/60">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-foreground/80">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate text-sidebar-foreground">{profile?.full_name || 'المستخدم'}</span>
                        <span className="text-[10px] text-sidebar-foreground/65 truncate">{user?.email}</span>
                    </div>
                </div>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={handleLogout}
                            className="text-sidebar-foreground/80 hover:text-destructive hover:bg-destructive/10 rounded-lg h-9 px-3 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>تسجيل الخروج</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
