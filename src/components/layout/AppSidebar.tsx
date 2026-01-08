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
    SidebarProvider,
    useSidebar,
} from '@/components/ui/sidebar';
import {
    Briefcase,
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Calendar,
} from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { PWAInstallButton } from './PWAInstallButton';
import { hapticLight } from '@/lib/haptics';

const items = [
    { title: 'الرئيسية', url: '/', icon: LayoutDashboard },
    { title: 'العملاء المحتملين', url: '/leads', icon: Briefcase },
    { title: 'المواعيد', url: '/appointments', icon: Calendar },
    { title: 'العملاء', url: '/clients', icon: Users, adminOnly: true },
    { title: 'الإعدادات', url: '/settings', icon: Settings },
];

export function AppSidebar() {
    const location = useLocation();
    const { user, isAdmin, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Always redirect to auth page and clear any local state
            localStorage.clear();
            navigate('/auth');
        }
    };

    const filteredItems = items.filter(item => !item.adminOnly || isAdmin);

    return (
        <Sidebar className="border-l border-border bg-sidebar" side="right">
            <SidebarHeader className="p-5 pb-2">
                <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Soctiv
                </h1>
            </SidebarHeader>

            <SidebarContent className="px-3 py-6">
                <SidebarGroup>
                    <SidebarGroupLabel className="px-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mb-1">
                        القائمة
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredItems.map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            onClick={() => hapticLight()}
                                            className="group h-10 px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[active=true]:text-primary data-[active=true]:bg-primary/5 transition-colors rounded-lg overflow-hidden relative"
                                        >
                                            <Link to={item.url} className="flex items-center gap-3 w-full h-full">
                                                <motion.div
                                                    className="flex items-center gap-3 w-full h-full"
                                                    whileHover={{ x: -2 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    <item.icon className={cn("h-4 w-4", isActive && "text-primary")} />
                                                    <span>{item.title}</span>
                                                    {isActive && (
                                                        <motion.div
                                                            layoutId="sidebar-active"
                                                            className="absolute right-0 top-1 bottom-1 w-1 bg-primary rounded-l-full"
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

            <SidebarFooter className="p-4 border-t border-border/40">
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate text-foreground">{profile?.full_name || 'المستخدم'}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                    </div>
                </div>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={handleLogout}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg h-9 px-3 transition-colors"
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
// Helper utils import needed for cn if not imported, assumed standard import
import { cn } from '@/lib/utils';
