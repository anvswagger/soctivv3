import { useState, useEffect } from 'react';
import { Phone, Calendar, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Lead } from '@/types/database';
import { LeadWithRelations } from '@/types/app';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { callLogsService } from '@/services/callLogsService';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];

interface CallOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadWithRelations | null;
  callStartTime: number;
  onRefresh: () => void;
}

const outcomeOptions: { label: string; status: LeadStatus | null; icon: React.ReactNode; color: string }[] = [
  { label: 'لم يرد / مشغول', status: 'contacting', icon: <Phone className="h-5 w-5" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
  { label: 'موعد محجوز', status: 'appointment_booked', icon: <Calendar className="h-5 w-5" />, color: 'bg-purple-500 hover:bg-purple-600' },
  { label: 'تمت المقابلة', status: 'interviewed', icon: <CheckCircle className="h-5 w-5" />, color: 'bg-cyan-500 hover:bg-cyan-600' },
  { label: 'غير مهتم', status: 'cancelled', icon: <XCircle className="h-5 w-5" />, color: 'bg-red-500 hover:bg-red-600' },
  { label: 'سأتصل لاحقاً', status: null, icon: <Clock className="h-5 w-5" />, color: 'bg-muted hover:bg-muted/80 text-foreground' },
];

export function CallOutcomeDialog({
  open,
  onOpenChange,
  lead,
  callStartTime,
  onRefresh,
}: CallOutcomeDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [callDuration, setCallDuration] = useState('00:00');
  const [loading, setLoading] = useState(false);

  // Update call duration every second
  useEffect(() => {
    if (!open || !callStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [open, callStartTime]);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(() => {
      onOpenChange(false);
    }, 60000);

    return () => clearTimeout(timeout);
  }, [open, onOpenChange]);

  const { user } = useAuth(); // Get current user

  const handleOutcome = async (status: LeadStatus | null) => {
    if (!lead || !user) return;

    setLoading(true);

    try {
      // 1. Update Lead Status
      const updates: { status?: LeadStatus; notes?: string } = {};

      if (status) {
        updates.status = status;
        // If appointment booked, stage will be updated elsewhere or manually
      }

      if (notes.trim()) {
        updates.notes = lead.notes ? `${lead.notes}\n---\n${notes}` : notes;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await (supabase as any)
          .from('leads')
          .update(updates)
          .eq('id', lead.id);

        if (error) throw error;
      }

      // 2. Create Call Log
      const durationSeconds = Math.floor((Date.now() - callStartTime) / 1000);

      await callLogsService.createLog({
        user_id: user.id,
        lead_id: lead.id,
        client_id: lead.client_id,
        status: status || 'no_answer', // Default to no_answer if no status change (e.g. 'Call later')
        duration: durationSeconds,
        notes: notes,
      });

      toast({
        title: '✅ تم الحفظ',
        description: status ? 'تم تسجيل المكالمة وتحديث الحالة' : 'تم تسجيل المكالمة',
      });

      onRefresh();
      onOpenChange(false);
      setNotes('');
    } catch (error) {
      console.error(error);
      toast({
        title: 'خطأ',
        description: 'فشل في حفظ البيانات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Phone className="h-6 w-6 text-primary" />
            كيف كانت المكالمة؟
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-lg">
              {lead.first_name} {lead.last_name}
            </p>
            {lead.phone && (
              <p className="text-sm text-muted-foreground" dir="ltr">
                {lead.phone}
              </p>
            )}
            <div className="flex items-center gap-2 text-primary font-medium">
              <Clock className="h-4 w-4" />
              <span>مدة المكالمة: {callDuration}</span>
            </div>
          </div>

          {/* Outcome Options */}
          <div className="space-y-2">
            {outcomeOptions.map((option) => (
              <Button
                key={option.label}
                variant="ghost"
                className={`w-full h-14 justify-start gap-3 text-base text-white ${option.color}`}
                onClick={() => handleOutcome(option.status)}
                disabled={loading}
              >
                {option.icon}
                {option.label}
              </Button>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              ملاحظات (اختياري)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظة سريعة..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Skip Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            تخطي
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
