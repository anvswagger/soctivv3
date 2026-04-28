import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const soctivLogo = '/Soctiv-Logo.svg';

export default function PostApprovalOnboarding() {
  const { user, client, profile, loading, authRoutingReady, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState(client?.company_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If loading, show loader
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If already completed, redirect to dashboard
  if (client?.company_name && client?.company_name !== 'New Client' && client?.company_name !== profile?.full_name) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error('يرجى إدخال اسم المتجر');
      return;
    }

    if (password && password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update client company name
      const { error: clientError } = await supabase
        .from('clients')
        .update({ company_name: companyName.trim() } as any)
        .eq('id', client!.id as any);

      if (clientError) throw clientError;

      // Update password if provided
      if (password) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
      }

      // Refresh user data
      await refreshUserData({ force: true, mode: 'blocking', reason: 'post-approval-onboarding' });

      toast.success('تم إكمال الإعداد بنجاح! مرحباً بك في سوكتيف');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[PostApproval] Error:', error);
      toast.error(error.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <motion.div
          className="flex items-center justify-center gap-3 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg overflow-hidden">
            <img src={soctivLogo} alt="Soctiv" className="w-full h-full object-cover" />
          </div>
          <span className="text-2xl font-heading font-bold">سوكتيف</span>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-card rounded-3xl p-6 shadow-xl border border-border/50"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 22 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold mb-1.5">تهانينا! تمت الموافقة على حسابك 🎉</h1>
            <p className="text-muted-foreground text-sm">
              أكمل إعداد حسابك الأخير للبدء في استخدام سوكتيف
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name" className="text-sm font-medium">اسم المتجر / الشركة</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="اسم متجرك"
                className="h-12 text-base rounded-xl"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">كلمة المرور (اختياري)</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="h-12 text-base rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                يمكنك ترك هذا فارغاً إذا تريد الاستمرار بتسجيل الدخول عبر جوجل فقط
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">تأكيد كلمة المرور</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                className="h-12 text-base rounded-xl"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium rounded-xl" 
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
              {isSubmitting ? 'جاري الحفظ...' : 'ابدأ الآن'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
