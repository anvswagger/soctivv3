import { useState, useMemo } from 'react';
import { LeadWithRelations } from '@/types/app';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { transliterateFullName } from '@/lib/transliterate';
import { MoreHorizontal, Trash2, Edit, PhoneCall, History, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { LeadActivityTimeline } from './LeadActivityTimeline';

interface LeadListViewProps {
  leads: LeadWithRelations[];
  onEdit: (lead: LeadWithRelations) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  isAdmin?: boolean;
  clients?: any[];
}

const statusLabels: Record<string, string> = {
  new: 'قيد الانتظار',
  contacting: 'قيد المعالجة',
  appointment_booked: 'مؤكد',
  interviewed: 'تم الشحن',
  no_show: 'مرتجع',
  sold: 'تم التسليم',
  cancelled: 'ملغي',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  contacting: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
  appointment_booked: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200',
  interviewed: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200',
  no_show: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200',
  sold: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200',
  cancelled: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200',
};

export function LeadListView({
  leads,
  onEdit,
  onDelete,
  onRefresh,
  onStatusChange,
  isAdmin,
  clients,
}: LeadListViewProps) {
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedHistoryLead, setSelectedHistoryLead] = useState<LeadWithRelations | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof LeadWithRelations | 'client_name', direction: 'asc' | 'desc' } | null>(null);

  const { user } = useAuth();

  // Toggle selection for all visible leads
  const toggleSelectAll = () => {
    if (selectedLeads.length === leads.length && leads.length > 0) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(l => l.id));
    }
  };

  // Toggle selection for a single lead
  const toggleSelectLead = (id: string) => {
    setSelectedLeads(prev =>
      prev.includes(id)
        ? prev.filter(leadId => leadId !== id)
        : [...prev, id]
    );
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    selectedLeads.forEach(id => onDelete(id));
    setSelectedLeads([]);
    setDeleteDialogOpen(false);
    hapticSuccess();
  };

  // Sorting logic
  const sortedLeads = useMemo(() => {
    if (!sortConfig) return leads;

    return [...leads].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof LeadWithRelations];
      let bValue: any = b[sortConfig.key as keyof LeadWithRelations];

      if (sortConfig.key === 'client_name') {
        aValue = a.client?.company_name || '';
        bValue = b.client?.company_name || '';
      }

      // Handle null/undefined values safely
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortConfig]);

  const requestSort = (key: keyof LeadWithRelations | 'client_name') => {
    setSortConfig(current => {
      if (current?.key === key && current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleCall = (phone: string) => {
    hapticLight();
    window.open(`tel:${phone}`, '_self');
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <div className="bg-muted/50 p-2 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2 border border-border/50 shadow-sm">
          <span className="text-sm font-medium px-2 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selectedLeads.length}
            </span>
            تم التحديد
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-2 h-8"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف المحدد
          </Button>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[40px] px-4">
                <Checkbox
                  checked={leads.length > 0 && selectedLeads.length === leads.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('first_name')}>
                <div className="flex items-center gap-1 font-semibold">
                  الاسم
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                </div>
              </TableHead>
              <TableHead className="w-[120px]">الحالة</TableHead>
              <TableHead>الهاتف</TableHead>
              {isAdmin && (
                <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('client_name')}>
                  <div className="flex items-center gap-1 font-semibold">
                    العميل
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                  </div>
                </TableHead>
              )}
              <TableHead className="cursor-pointer hover:text-foreground transition-colors hidden md:table-cell w-[140px]" onClick={() => requestSort('created_at')}>
                <div className="flex items-center gap-1 font-semibold">
                  تاريخ الإضافة
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                </div>
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeads.length > 0 ? (
              sortedLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className={cn(
                    "group hover:bg-muted/40 transition-colors cursor-pointer",
                    selectedLeads.includes(lead.id) && "bg-muted/30"
                  )}
                  onClick={(e) => {
                    // Prevent row click when clicking on specific interactive elements
                    if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return;
                    onEdit(lead);
                  }}
                >
                  <TableCell className="px-4 py-3">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleSelectLead(lead.id)}
                      aria-label={`Select ${lead.first_name}`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span className="body-font font-medium text-base">
                        {transliterateFullName(lead.first_name, lead.last_name)}
                      </span>
                      {lead.worktype && (
                        <span className="text-xs text-muted-foreground truncate max-w-[150px] md:hidden mt-0.5">
                          {lead.worktype}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-normal border h-6 px-2 text-xs", statusColors[lead.status] || 'bg-secondary')}>
                      {statusLabels[lead.status] || lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell dir="ltr" className="text-right">
                    {lead.phone ? (
                      <span className="font-mono text-sm block">{lead.phone}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {lead.client?.company_name ? (
                        <span className="font-medium text-sm text-foreground/80">{lead.client.company_name}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs font-mono">
                    {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: ar })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCall(lead.phone!);
                          }}
                          title="اتصال"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" />
                            <span>تعديل</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHistoryLead(lead);
                            setShowHistoryDialog(true);
                          }} className="cursor-pointer">
                            <History className="mr-2 h-4 w-4" />
                            <span>السجل</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }} className="text-destructive cursor-pointer hover:text-destructive focus:text-destructive hover:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>حذف</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="text-4xl mb-2">📭</div>
                    <p>لا توجد بيانات لعرضها</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف الجماعي</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف {selectedLeads.length} عميل؟ لا يمكن التراجع عن هذا الإجراء وسوف يتم فقدان جميع البيانات المرتبطة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>حذف نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              سجل العميل: {selectedHistoryLead ? transliterateFullName(selectedHistoryLead.first_name, selectedHistoryLead.last_name) : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedHistoryLead && (
            <LeadActivityTimeline leadId={selectedHistoryLead.id} leadCreatedAt={selectedHistoryLead.created_at} />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
