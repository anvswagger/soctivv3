
import React from "react";
import { useNavigate } from "react-router-dom";
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
    Video,
    Settings,
    Search,
    Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { leadsService } from "@/services/leadsService";
import { LeadWithRelations } from "@/types/app";

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const { data: leads = [] } = useQuery({
        queryKey: ['leads-search'],
        queryFn: () => leadsService.getLeads() as Promise<LeadWithRelations[]>,
    });

    const runCommand = React.useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="ابحث عن عملاء، صفحات، أو إجراءات..." className="text-right" dir="rtl" />
            <CommandList className="text-right" dir="rtl">
                <CommandEmpty>لم يتم العثور على نتائج.</CommandEmpty>
                <CommandGroup heading="الصفحات">
                    <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
                        <LayoutDashboard className="ml-2 h-4 w-4" />
                        <span>الرئيسية</span>
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
                    <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
                        <Settings className="ml-2 h-4 w-4" />
                        <span>الإعدادات</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="العملاء المحتملين">
                    {leads.slice(0, 5).map((lead) => (
                        <CommandItem
                            key={lead.id}
                            onSelect={() => runCommand(() => navigate("/leads"))}
                        >
                            <Search className="ml-2 h-4 w-4" />
                            <span>{lead.first_name} {lead.last_name}</span>
                            <span className="mr-auto text-xs text-muted-foreground">{lead.phone}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
