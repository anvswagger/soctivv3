import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Calendar,
    Settings,
    Search,
    Zap,
    Plus,
    Bell,
    FileText,
    BarChart3,
    Phone,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsService } from "@/services/leadsService";
import { useAuth } from "@/hooks/useAuth";
import { LeadsFilter } from "@/types/app";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { safeLocalGet, safeLocalRemove, safeLocalSet } from "@/lib/safeStorage";
import { toast } from "sonner";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

const RECENT_SEARCHES_KEY = 'soctiv_recent_searches';

function readRecentSearches(): string[] {
    const raw = safeLocalGet(RECENT_SEARCHES_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
            safeLocalRemove(RECENT_SEARCHES_KEY);
            return [];
        }

        return parsed
            .map((item) => item.trim())
            .filter((item) => item.length >= 2)
            .slice(0, 10);
    } catch {
        safeLocalRemove(RECENT_SEARCHES_KEY);
        return [];
    }
}

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = useState("");
    const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { client, isAdmin, isSuperAdmin, assignedClients } = useAuth();
    const queryClient = useQueryClient();

    // Add keyboard shortcut indicator to body
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", handleKeyPress);
        return () => document.removeEventListener("keydown", handleKeyPress);
    }, []);

    // Add recent search
    const addRecentSearch = useCallback((term: string) => {
        const trimmed = term.trim();
        if (!trimmed || trimmed.length < 2) return;

        setRecentSearches((previous) => {
            const updated = [trimmed, ...previous.filter((search) => search !== trimmed)].slice(0, 10);
            safeLocalSet(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Clear recent searches
    const clearRecentSearches = () => {
        setRecentSearches([]);
        safeLocalRemove(RECENT_SEARCHES_KEY);
        toast.success("تم مسح سجل البحث");
    };

    React.useEffect(() => {
        if (!open) {
            setQuery("");
        }
    }, [open]);

    // Check for quick action shortcuts
    const handleQuickAction = (action: string) => {
        switch (action) {
            case 'new-lead':
                navigate('/leads?new=true');
                break;
            case 'new-appointment':
                navigate('/appointments?new=true');
                break;
            case 'focus-mode':
                navigate('/focus-mode');
                break;
            case 'notifications':
                navigate('/notifications');
                break;
            default:
                break;
        }
        setOpen(false);
    };

    const searchFilters = useMemo(() => {
        // Super admins see all leads, so no client filter needed
        const filters: LeadsFilter = {};
        if (!isSuperAdmin) {
            if (isAdmin) {
                filters.clientId = assignedClients;
            } else {
                filters.clientId = client?.id;
            }
        }
        return filters;
    }, [isSuperAdmin, isAdmin, assignedClients, client]);

    const trimmedQuery = query.trim();
    const debouncedQuery = useDebounce(trimmedQuery, 300);
    const searchEnabled = open && debouncedQuery.length >= 1;
    const isOnlyNavigation = trimmedQuery.length === 0;

    const escapeSearch = (value: string) =>
        value
            .substring(0, 200)
            .replace(/\\/g, "\\\\")
            .replace(/%/g, "\\%")
            .replace(/_/g, "\\_");

    const { data } = useQuery({
        queryKey: ['leads-search', searchFilters, debouncedQuery],
        queryFn: () => leadsService.getLeads(1, 10, {
            ...searchFilters,
            ...(debouncedQuery ? { search: debouncedQuery } : {}),
        }),
        enabled: searchEnabled,
    });

    const leads = data?.data || [];

    const { data: clients = [] } = useQuery({
        queryKey: ['clients-search', debouncedQuery, searchFilters],
        queryFn: async () => {
            const escaped = escapeSearch(debouncedQuery);
            let queryBuilder = supabase
                .from('clients')
                .select('id, company_name, phone')
                .or(`company_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
                .order('company_name')
                .limit(5);

            if (!isSuperAdmin) {
                if (isAdmin && assignedClients?.length) {
                    queryBuilder = queryBuilder.in('id', assignedClients);
                } else if (client?.id) {
                    queryBuilder = queryBuilder.eq('id', client.id);
                }
            }

            const { data, error } = await queryBuilder;
            if (error) return [];
            return data || [];
        },
        enabled: searchEnabled,
    });

    const leadIds = leads.map((lead: any) => lead.id).filter(Boolean);
    const { data: appointments = [] } = useQuery({
        queryKey: ['appointments-search', trimmedQuery, leadIds.join(',')],
        queryFn: async () => {
            if (leadIds.length === 0) return [];
            const { data, error } = await supabase
                .from('appointments')
                .select('id, scheduled_at, status, lead:leads(id, first_name, last_name, phone), client:clients(company_name)')
                .in('lead_id', leadIds)
                .order('scheduled_at', { ascending: false })
                .limit(5);
            if (error) return [];
            return data || [];
        },
        enabled: searchEnabled,
    });

    const runCommand = React.useCallback((command: () => void, searchTerm?: string) => {
        if (searchTerm) {
            addRecentSearch(searchTerm);
        }
        setOpen(false);
        command();
    }, [addRecentSearch]);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput
                placeholder="ابحث عن العملاء المحتملين، العملاء، المواعيد... أو اكتب '/' للبحث السريع"
                className="text-right"
                dir="rtl"
                value={query}
                onValueChange={setQuery}
            />
            <CommandList className="text-right" dir="rtl">
                <CommandEmpty>
                    {trimmedQuery.length > 0 ? (
                        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                            <Search className="h-8 w-8 mb-2 opacity-20" />
                            <p>لا توجد نتائج لـ "{trimmedQuery}"</p>
                            <p className="text-xs mt-1">جرّب مصطلحاً مختلفاً</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                            <Zap className="h-8 w-8 mb-2 opacity-20" />
                            <p>ابدأ بالكتابة للبحث</p>
                            <p className="text-xs mt-1">استخدم Ctrl+K لفتح قائمة الأوامر</p>
                        </div>
                    )}
                </CommandEmpty>

                {/* Quick Actions - always visible */}
                {isOnlyNavigation && (
                    <>
                        <CommandGroup heading="الإجراءات السريعة">
                            <CommandItem onSelect={() => handleQuickAction('new-lead')}>
                                <Plus className="ml-2 h-4 w-4" />
                                <span>إضافة عميل محتمل جديد</span>
                                <CommandShortcut>⌘N</CommandShortcut>
                            </CommandItem>
                            <CommandItem onSelect={() => handleQuickAction('new-appointment')}>
                                <Calendar className="ml-2 h-4 w-4" />
                                <span>جدولة موعد جديد</span>
                                <CommandShortcut>⌘⇧N</CommandShortcut>
                            </CommandItem>
                            <CommandItem onSelect={() => handleQuickAction('focus-mode')}>
                                <Phone className="ml-2 h-4 w-4" />
                                <span>وضع التركيز للمكالمات</span>
                                <CommandShortcut>⌘⇧F</CommandShortcut>
                            </CommandItem>
                            <CommandItem onSelect={() => handleQuickAction('notifications')}>
                                <Bell className="ml-2 h-4 w-4" />
                                <span>عرض الإشعارات</span>
                                <CommandShortcut>⌘U</CommandShortcut>
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />

                        {/* Recent Searches */}
                        {recentSearches.length > 0 && (
                            <>
                                <CommandGroup heading="عمليات البحث الأخيرة">
                                    {recentSearches.slice(0, 5).map((search, index) => (
                                        <CommandItem
                                            key={`recent-${index}`}
                                            onSelect={() => {
                                                setQuery(search);
                                                addRecentSearch(search);
                                            }}
                                        >
                                            <Search className="ml-2 h-4 w-4" />
                                            <span>{search}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        )}
                    </>
                )}

                {/* Navigation */}
                {isOnlyNavigation && (
                    <CommandGroup heading="الصفحات">
                        <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
                            <LayoutDashboard className="ml-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/leads"))}>
                            <Briefcase className="ml-2 h-4 w-4" />
                            <span>العملاء المحتملين</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/appointments"))}>
                            <Calendar className="ml-2 h-4 w-4" />
                            <span>المواعيد</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/clients"))}>
                            <Users className="ml-2 h-4 w-4" />
                            <span>العملاء</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/sms"))}>
                            <FileText className="ml-2 h-4 w-4" />
                            <span>الرسائل القصيرة</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/setter-stats"))}>
                            <BarChart3 className="ml-2 h-4 w-4" />
                            <span>إحصائيات الموظفين</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
                            <Settings className="ml-2 h-4 w-4" />
                            <span>الإعدادات</span>
                        </CommandItem>
                    </CommandGroup>
                )}
                <CommandSeparator />
                {/* Search Results */}
                {searchEnabled && !isOnlyNavigation && (
                    <>
                        <CommandGroup heading="العملاء المحتملين">
                            {leads.slice(0, 5).map((lead: any) => (
                                <CommandItem
                                    key={lead.id}
                                    onSelect={() => runCommand(
                                        () => navigate(`/leads?q=${encodeURIComponent(`${lead.first_name} ${lead.last_name}`.trim())}`),
                                        trimmedQuery
                                    )}
                                >
                                    <Search className="ml-2 h-4 w-4" />
                                    <span>{lead.first_name} {lead.last_name}</span>
                                    <span className="mr-auto text-xs text-muted-foreground">{lead.phone}</span>
                                </CommandItem>
                            ))}
                            {leads.length === 0 && (
                                <p className="text-sm text-muted-foreground px-2">لا توجد نتائج</p>
                            )}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="العملاء">
                            {clients.map((clientData: any) => (
                                <CommandItem
                                    key={clientData.id}
                                    onSelect={() => runCommand(
                                        () => navigate(`/clients?clientId=${clientData.id}`),
                                        trimmedQuery
                                    )}
                                >
                                    <Users className="ml-2 h-4 w-4" />
                                    <span>{clientData.company_name}</span>
                                    {clientData.phone && (
                                        <span className="mr-auto text-xs text-muted-foreground">{clientData.phone}</span>
                                    )}
                                </CommandItem>
                            ))}
                            {clients.length === 0 && (
                                <p className="text-sm text-muted-foreground px-2">لا توجد نتائج</p>
                            )}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="المواعيد">
                            {appointments.map((appointment: any) => (
                                <CommandItem
                                    key={appointment.id}
                                    onSelect={() => runCommand(
                                        () => navigate(`/appointments?leadId=${appointment.lead?.id ?? ''}`),
                                        trimmedQuery
                                    )}
                                >
                                    <Calendar className="ml-2 h-4 w-4" />
                                    <span>{appointment.lead ? `${appointment.lead.first_name} ${appointment.lead.last_name}` : 'موعد'}</span>
                                    <span className="mr-auto text-xs text-muted-foreground">
                                        {appointment.scheduled_at ? formatDateTime(appointment.scheduled_at) : ''}
                                    </span>
                                </CommandItem>
                            ))}
                            {appointments.length === 0 && (
                                <p className="text-sm text-muted-foreground px-2">لا توجد نتائج</p>
                            )}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}
