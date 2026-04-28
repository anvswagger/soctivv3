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

export default function PhoneOnboarding() {
  const { user, profile, loading, authRoutingReady, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
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

  // If user already has phone, redirect to product onboarding
  if (profile?.phone) {
    return <Navigate to="/product-onboarding" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (phone.trim().length < 10) {
      toast.error('رقم الهاتف يجب أن يكون 10 أرقام على الأقل');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update profile with phone number
      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh user data to get updated profile
      await refreshUserData({ force: true, mode: 'blocking', reason: 'phone-onboarding-submit' });

      toast.success('تم حفظ رقم الهاتف بنجاح!');
      navigate('/product-onboarding');
    } catch (error: any) {
      console.error('[PhoneOnboarding] Error saving phone:', error);
      toast.error(error.message || 'حدث خطأ أثناء حفظ رقم الهاتف');
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

        {/* Auth Card */}
        <motion.div
          className="bg-card rounded-3xl p-6 shadow-xl border border-border/50"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 22 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold mb-1.5">أدخل رقم هاتفك</h1>
            <p className="text-muted-foreground text-sm">
              نحتاج رقم هاتفك لإكمال إنشاء حسابك
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">رقم الهاتف</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="09XXXXXXXX"
                className="h-12 text-base rounded-xl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                autoFocus
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium rounded-xl" 
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
              {isSubmitting ? 'جاري الحفظ...' : 'إكمال التسجيل'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
