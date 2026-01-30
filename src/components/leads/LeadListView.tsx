import { useState, memo, useRef } from 'react';
import { Lead, Client } from '@/types/database';
import { LeadWithRelations } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Edit, Trash2, Briefcase, Layers } from 'lucide-react';
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
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

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
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

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

  const getClientName = (clientId: string | null) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.company_name;
  };

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="relative border rounded-lg bg-card overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b bg-muted/50 text-muted-foreground text-sm font-medium sticky top-0 z-20">
        <div className="w-[40px] shrink-0">
          <Checkbox
            checked={selectedIds.length === leads.length && leads.length > 0}
            onCheckedChange={toggleSelectAll}
          />
        </div>
        <div className="flex-1 min-w-[150px]">الاسم</div>
        <div className="w-[140px] shrink-0">الهاتف</div>
        <div className="w-[160px] shrink-0">الحالة</div>
        <div className="w-[160px] shrink-0">العميل</div>
        <div className="w-[120px] shrink-0 hidden md:block">نوع المشروع</div>
        <div className="w-[100px] shrink-0 text-center">إجراءات</div>
      </div>

      {/* Virtualized Container */}
      <div
        ref={parentRef}
        className="overflow-y-auto h-[600px]"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const lead = leads[virtualRow.index];
            const isSelected = selectedIds.includes(lead.id);

            return (
              <div
                key={lead.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  "flex items-center px-4 py-3 border-b transition-colors hover:bg-muted/30 absolute top-0 left-0 w-full",
                  isSelected && "bg-muted/50"
                )}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="w-[40px] shrink-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(lead.id)}
                  />
                </div>

                <div className="flex-1 min-w-[150px] font-medium truncate">
                  <div className="flex flex-col">
                    <span>{transliterateFullName(lead.first_name, lead.last_name)}</span>
                    {!isAdmin && lead.client?.company_name && (
                      <span className="text-[10px] text-muted-foreground md:hidden italic">
                        {lead.client.company_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-[140px] shrink-0">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1.5 text-primary hover:underline text-sm"
                      onClick={() => hapticLight()}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone}
                    </a>
                  )}
                </div>

                <div className="w-[160px] shrink-0 pr-2">
                  <Select
                    value={lead.status}
                    onValueChange={async (value: LeadStatus) => {
                      hapticLight();
                      await onStatusChange(lead.id, value);
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-8 bg-transparent transition-all hover:bg-primary/5">
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
                </div>

                <div className="w-[160px] shrink-0 truncate text-sm font-semibold text-primary">
                  {lead.client?.company_name || getClientName(lead.client_id) || '-'}
                </div>

                <div className="w-[120px] shrink-0 hidden md:block">
                  {lead.worktype && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="h-3.5 w-3.5" />
                      {lead.worktype}
                    </span>
                  )}
                </div>

                <div className="w-[100px] shrink-0 flex items-center justify-center gap-1">
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
              </div>
            );
          })}
        </div>
      </div>

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
