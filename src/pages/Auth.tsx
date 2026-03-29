import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Users, TrendingUp, MessageSquare, Calendar, Shield } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { PWAInstallButton } from '@/components/layout/PWAInstallButton';
import soctivLogo from '@/assets/soctiv-logo-new.jpeg';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  companyName: z.string().min(2, 'اسم المتجر يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  phone: z.string().min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

const features = [
  { icon: Users, title: 'ادارة العملاء', desc: 'تتبع جميع عملائك وطلباتهم في مكان واحد' },
  { icon: Calendar, title: 'ادارة الطلبات', desc: 'جدولة وتتبع مواعيد التسليم بسهولة' },
  { icon: MessageSquare, title: 'إشعارات تلقائية', desc: 'تنبيهات SMS للعملاء حول حالة طلباتهم' },
  { icon: TrendingUp, title: 'تقارير المبيعات', desc: 'إحصائيات واضحة لأداء متجرك' },
];

function getAuthErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (message === 'Invalid login credentials') return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (lower.includes('already registered')) return 'هذا البريد الإلكتروني مسجل مسبقاً';
  if (lower.includes('email not confirmed')) return 'يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول';
  if (lower.includes('rate limit')) return 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
  if (/[a-z]/i.test(message)) return 'حدث خطأ. حاول مرة أخرى.';
  return message;
}

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '',
    companyName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loginSchema.parse(loginData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'خطأ في البيانات',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'فشل تسجيل الدخول',
        description: getAuthErrorMessage(error.message),
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      signupSchema.parse(signupData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'خطأ في البيانات',
          description: error.errors[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: signupData.fullName,
          phone: signupData.phone,
          company_name: signupData.companyName,
        },
      },
    });

    if (signUpError) {
      setIsLoading(false);
      if (signUpError.message.includes('already registered')) {
        toast({
          title: 'المستخدم موجود',
          description: 'هذا البريد الإلكتروني مسجل مسبقاً',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'فشل إنشاء الحساب',
          description: getAuthErrorMessage(signUpError.message),
          variant: 'destructive',
        });
      }
      return;
    }

    // Auto-login after signup to go straight to onboarding
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: signupData.email,
      password: signupData.password,
    });

    setIsLoading(false);

    if (signInError) {
      // If auto-login fails (e.g. email confirmation still required), show helpful message
      toast({
        title: 'تم إنشاء الحساب',
        description: 'تم إنشاء حسابك بنجاح. يرجى تسجيل الدخول للمتابعة.',
      });
      return;
    }

    toast({
      title: 'مرحباً بك في Soctiv!',
      description: 'تم إنشاء حسابك بنجاح. هيا نبدأ بإعداد متجرك.',
    });
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Right Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/95 to-primary/80 p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center shadow-lg border border-primary-foreground/10 overflow-hidden">
              <img src={soctivLogo} alt="Soctiv" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-5xl font-heading font-bold text-primary-foreground tracking-tight">Soctiv</h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-heading font-bold text-primary-foreground leading-tight">
              نظام إدارة متجرك<br />الإلكتروني
            </h2>
            <p className="text-lg text-primary-foreground/70 leading-relaxed max-w-md">
              إدارة العملاء والطلبات والمواعيد من مكان واحد. كل ما تحتاجه لإدارة متجرك بنجاح.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-5 p-4 rounded-2xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-all duration-300 group"
            >
              <div className="p-3 bg-primary-foreground/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground text-base">{feature.title}</h3>
                <p className="text-sm text-primary-foreground/60 mt-0.5">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Left Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-lg">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-heading font-bold">Soctiv</span>
          </div>

          <Card className="rounded-3xl shadow-2xl shadow-primary/5 border border-border/50 overflow-hidden">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-heading font-bold">
                {defaultTab === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {defaultTab === 'signup' ? 'أنشئ حسابك للبدء في إدارة متجرك' : 'ادخل إلى حسابك لإدارة متجرك'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-muted/50 rounded-2xl p-1.5">
                  <TabsTrigger value="login" className="text-base rounded-xl">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="signup" className="text-base rounded-xl">حساب جديد</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-0">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">البريد الإلكتروني</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@email.com"
                        className="h-12"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">كلمة المرور</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="h-12"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-medium shadow-soft" disabled={isLoading}>
                      {isLoading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                      تسجيل الدخول
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">الاسم الكامل</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="أحمد محمد"
                        className="h-12"
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-company">اسم المتجر</Label>
                      <Input
                        id="signup-company"
                        type="text"
                        placeholder="متجر النجاح"
                        className="h-12"
                        value={signupData.companyName}
                        onChange={(e) => setSignupData({ ...signupData, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="example@email.com"
                        className="h-12"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">رقم الهاتف</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+218 91 1234567"
                        className="h-12"
                        value={signupData.phone}
                        onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">كلمة المرور</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          className="h-12"
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">تأكيد كلمة المرور</Label>
                        <Input
                          id="signup-confirm"
                          type="password"
                          placeholder="••••••••"
                          className="h-12"
                          value={signupData.confirmPassword}
                          onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-medium shadow-soft" disabled={isLoading}>
                      {isLoading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                      ابدأ الآن
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
              <div className="mt-8 border-t border-border/50 pt-6">
                <PWAInstallButton />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
