import { useState, memo } from 'react';
import { Lead, Client } from '@/types/database';
import { LeadWithRelations } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Edit, Trash2, Briefcase, Layers } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { transliterateFullName } from '@/lib/transliterate';
import type { Database } from '@/integrations/supabase/types';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { Checkbox } from '@/components/ui/checkbox';

// Typed client used directly

type LeadStatus = Database['public']['Enums']['lead_status'];



const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: 'جديد', color: 'bg-blue-500' },
  contacting: { label: 'قيد التواصل', color: 'bg-yellow-500' },
  appointment_booked: { label: 'موعد محجوز', color: 'bg-purple-500' },
  interviewed: { label: 'تمت المقابلة', color: 'bg-cyan-500' },
  no_show: { label: 'غائب', color: 'bg-orange-500' },
  sold: { label: 'تم البيع', color: 'bg-green-500' },
  cancelled: { label: 'ملغاة', color: 'bg-red-500' },
};

interface LeadListViewProps {
  leads: LeadWithRelations[];
  onEdit: (lead: LeadWithRelations) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onStatusChange: (id: string, status: LeadStatus) => Promise<void>;
  isAdmin?: boolean;
  clients?: Client[];
}

function LeadListViewComponent({ leads, onEdit, onDelete, onRefresh, onStatusChange, isAdmin, clients }: LeadListViewProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
    hapticLight();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    hapticLight();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} من العملاء؟`)) return;

    try {
      const { error } = await supabase.from('leads').delete().in('id', selectedIds);
      if (error) throw error;

      hapticSuccess();
      toast({ title: 'تم الحذف', description: `تم حذف ${selectedIds.length} عميل بنجاح` });
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkStatusUpdate = async (status: LeadStatus) => {
    try {
      const { error } = await supabase.from('leads').update({ status }).in('id', selectedIds);
      if (error) throw error;

      hapticSuccess();
      toast({ title: 'تم التحديث', description: `تم تحديث حالة ${selectedIds.length} عميل` });
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // Internal handler just delegates to prop
  // We can remove the local handleStatusChange and call onStatusChange directly in the Select
  // But for now let's keep it simple


  const getClientName = (clientId: string | null) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  return (
    <div className="overflow-x-auto" dir="rtl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={selectedIds.length === leads.length && leads.length > 0}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="text-right">الاسم</TableHead>
            <TableHead className="text-right">الهاتف</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">العميل</TableHead>
            <TableHead className="text-right hidden md:table-cell">نوع المشروع</TableHead>
            <TableHead className="text-right hidden lg:table-cell">المرحلة</TableHead>
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, index) => (
            <motion.tr
              key={lead.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={`border-b transition-colors hover:bg-muted/50 ${selectedIds.includes(lead.id) ? 'bg-muted' : ''}`}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(lead.id)}
                  onCheckedChange={() => toggleSelect(lead.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex flex-col">
                  <span>{transliterateFullName(lead.first_name, lead.last_name)}</span>
                  {!isAdmin && lead.client?.company_name && (
                    <span className="text-[10px] text-muted-foreground md:hidden italic">
                      {lead.client.company_name}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                    onClick={() => hapticLight()}
                  >
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </a>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={lead.status}
                  onValueChange={async (value: LeadStatus) => {
                    hapticLight();
                    await onStatusChange(lead.id, value);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8 transition-all hover:bg-primary/5 active:scale-95">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusConfig[lead.status]?.color || 'bg-gray-500'}`} />
                      <span className="text-xs">{statusConfig[lead.status]?.label || lead.status}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, { label, color }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color}`} />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {lead.worktype && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {lead.worktype}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {lead.stage && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {lead.stage}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-xs font-semibold text-primary">
                  {lead.client?.company_name || getClientName(lead.client_id) || '-'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-transform active:scale-90"
                    onClick={() => {
                      hapticLight();
                      onEdit(lead);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive transition-transform active:scale-90"
                    onClick={() => {
                      hapticLight();
                      onDelete(lead.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-lg rounded-full px-6 py-3 flex items-center gap-6"
          >
            <span className="text-sm font-medium border-l pl-6 ml-2">
              تم تحديد {selectedIds.length} عملاء
            </span>

            <div className="flex items-center gap-2">
              <Select onValueChange={(v: LeadStatus) => handleBulkStatusUpdate(v)}>
                <SelectTrigger className="w-[160px] h-9 bg-transparent border-dashed">
                  <SelectValue placeholder="تغيير الحالة..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                size="sm"
                className="gap-2 h-9 rounded-full px-4"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4" />
                حذف المحدد
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => setSelectedIds([])}
              >
                إلغاء
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const LeadListView = memo(LeadListViewComponent);
