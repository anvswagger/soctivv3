import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Users, TrendingUp, MessageSquare, Calendar, Shield } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  phone: z.string().optional(),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

const features = [
  { icon: Users, title: 'إدارة العملاء', desc: 'تتبع وإدارة جميع عملائك المحتملين' },
  { icon: Calendar, title: 'جدولة المواعيد', desc: 'نظام متكامل لإدارة المواعيد' },
  { icon: MessageSquare, title: 'رسائل SMS', desc: 'تواصل مباشر مع العملاء' },
  { icon: TrendingUp, title: 'تقارير وإحصائيات', desc: 'تحليلات شاملة لأداء فريقك' },
];

export default function Auth() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '',
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
        description: error.message === 'Invalid login credentials' 
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : error.message,
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
    const { error } = await signUp(
      signupData.email,
      signupData.password,
      signupData.fullName,
      signupData.phone
    );
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'المستخدم موجود',
          description: 'هذا البريد الإلكتروني مسجل مسبقاً',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'فشل إنشاء الحساب',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'تم إنشاء الحساب',
        description: 'حسابك قيد المراجعة، سيتم إعلامك عند الموافقة',
      });
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Right Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 bg-primary-foreground rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-foreground rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-xl bg-primary-foreground/10 flex items-center justify-center mb-6">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-heading font-bold text-primary-foreground">
            نظام إدارة العملاء
          </h1>
          <p className="mt-4 text-xl text-primary-foreground/80">
            منصة متكاملة لإدارة أعمالك بكفاءة عالية
          </p>
        </div>
        
        <div className="relative z-10 space-y-6">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="p-3 bg-primary-foreground/10 rounded-xl backdrop-blur-sm">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">{feature.title}</h3>
                <p className="text-sm text-primary-foreground/70">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="relative z-10 flex items-center gap-2 text-sm text-primary-foreground/60">
          <Shield className="h-4 w-4" />
          <span>بياناتك محمية بأعلى معايير الأمان</span>
        </div>
      </div>

      {/* Left Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-background">
        <Card className="w-full max-w-md border-0 shadow-soft">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-heading">مرحباً بك</CardTitle>
            <CardDescription className="text-base">سجل دخولك أو أنشئ حساباً جديداً</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                <TabsTrigger value="login" className="text-base">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup" className="text-base">حساب جديد</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium">البريد الإلكتروني</Label>
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
                    <Label htmlFor="login-password" className="text-sm font-medium">كلمة المرور</Label>
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
                    <Label htmlFor="signup-name" className="text-sm font-medium">الاسم الكامل</Label>
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
                    <Label htmlFor="signup-email" className="text-sm font-medium">البريد الإلكتروني</Label>
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
                    <Label htmlFor="signup-phone" className="text-sm font-medium">رقم الهاتف (اختياري)</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="+966 50 000 0000"
                      className="h-12"
                      value={signupData.phone}
                      onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">كلمة المرور</Label>
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
                      <Label htmlFor="signup-confirm" className="text-sm font-medium">تأكيد كلمة المرور</Label>
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
                    إنشاء حساب
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
