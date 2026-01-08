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
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';

const db = supabase as any;

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

export function LeadListView({ leads, onEdit, onDelete, onRefresh, onStatusChange, isAdmin, clients }: LeadListViewProps) {
  const { toast } = useToast();

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
            <TableHead className="text-right">الاسم</TableHead>
            <TableHead className="text-right">الهاتف</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">نوع المشروع</TableHead>
            <TableHead className="text-right">المرحلة</TableHead>
            {isAdmin && <TableHead className="text-right">العميل</TableHead>}
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, index) => (
            <motion.tr
              key={lead.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 }
              }}
              className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
            >
              <TableCell className="font-medium">
                {transliterateFullName(lead.first_name, lead.last_name)}
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
              <TableCell>
                {lead.worktype && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {lead.worktype}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {lead.stage && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {lead.stage}
                  </span>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <span className="text-xs text-primary">{getClientName(lead.client_id)}</span>
                </TableCell>
              )}
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
    </div>
  );
}
