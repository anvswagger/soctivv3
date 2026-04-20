import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, LogOut, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/format';
import type { ApprovalRequest } from '@/types/database';

export default function PendingApproval() {
  const { signOut, profile, isApproved, refreshUserData, client } = useAuth();
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  // If user is already approved, redirect to post approval onboarding
  if (isApproved) {
    return <Navigate to="/post-approval-onboarding" replace />;
  }

  useEffect(() => {
    const fetchApproval = async () => {
      if (!profile?.id) return;
      const { data } = await (supabase as any)
        .from('approval_requests')
        .select('status,submitted_at,sla_due_at,reviewer_notes,rejection_reason')
        .eq('user_id', profile.id)
        .single();
      setApprovalRequest(data as ApprovalRequest || null);
    };
    fetchApproval();

    // Poll for approval status every 10 seconds
    const interval = setInterval(async () => {
      await refreshUserData({ force: true, reason: 'approval-poll' });
      if (isApproved) {
        window.location.assign('/post-approval-onboarding');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [profile?.id, isApproved, refreshUserData]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8 text-center space-y-6">
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="relative mx-auto"
        >
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <Clock className="w-12 h-12 text-primary" />
            </motion.div>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center"
          >
            <span className="text-white text-lg">✓</span>
          </motion.div>
        </motion.div>

        {/* Title & Message */}
        <div className="space-y-3">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-foreground"
          >
            شكراً لك {profile?.full_name ? `, ${profile.full_name}` : ''}!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground leading-relaxed"
          >
            تم استلام طلبك بنجاح وهو الآن قيد المراجعة من قبل فريقنا.
            <br />
            سيتم إعلامك فور الموافقة على حسابك.
          </motion.p>
        </div>

        {profile?.approval_status === 'rejected' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-right space-y-2"
          >
            <p className="font-semibold text-destructive">تم رفض الطلب</p>
            <p className="text-sm text-muted-foreground">
              السبب: {approvalRequest?.rejection_reason || 'لم يتم إدخال سبب محدد.'}
            </p>
            {approvalRequest?.reviewer_notes && (
              <p className="text-sm text-muted-foreground">
                ملاحظات المراجع: {approvalRequest.reviewer_notes}
              </p>
            )}
            <div className="pt-2">
              <Button onClick={() => window.location.assign('/product-onboarding')} className="w-full">
                تعديل بيانات الشركة وإعادة الإرسال
              </Button>
            </div>
          </motion.div>
        )}

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4"
        >
          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="font-medium">
              حالة الحساب: {profile?.approval_status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
            </span>
          </div>
          {approvalRequest?.submitted_at && (
            <div className="mt-2 text-xs text-muted-foreground">
              تم الإرسال: {formatDateTime(approvalRequest.submitted_at)}
            </div>
          )}
        </motion.div>

        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4 pt-4 border-t border-border"
        >
          <p className="text-sm text-muted-foreground">تواصل معانا</p>
          <Button
            onClick={() => window.open('https://wa.me/218914180440', '_blank')}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <MessageCircle className="w-4 h-4" />
            تواصل عبر واتساب
          </Button>
        </motion.div>

        {/* Sign Out Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button variant="ghost" onClick={handleSignOut} className="gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </motion.div>
      </Card>
    </div>
  );
}
