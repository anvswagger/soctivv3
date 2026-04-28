import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnimatedButton } from '@/components/ui/animated-button';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { analyticsService, facebookPixel } from '@/services/analyticsService';
import { debounce } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

import soctivLogo from '@/../public/Soctiv-Logo.svg';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  phone: z.string().min(10, 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().or(z.literal('')),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
});

function getAuthErrorMessage(message: string) {
  let decoded = message;
  try {
    while (decoded.includes('%25')) {
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // Ignore decoding errors
  }
  
  const lower = decoded.toLowerCase();
  if (decoded === 'Invalid login credentials') return 'رقم الهاتف أو كلمة المرور غير صحيحة';
  if (lower.includes('already registered')) return 'هذا الرقم مسجل مسبقاً';
  if (lower.includes('email not confirmed')) return 'يرجى تأكيد الحساب قبل تسجيل الدخول';
  if (lower.includes('rate limit')) return 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
  if (lower.includes('unable to exchange external code')) return 'فشل في إكمال تسجيل الدخول مع جوجل. الرجاء المحاولة مرة أخرى.';
  if (lower.includes('code verifier')) return 'انتهت صلاحية جلسة تسجيل الدخول. الرجاء المحاولة مرة أخرى.';
  if (lower.includes('invalid grant') || lower.includes('unsupported_grant_type')) return 'فشل في مصادقة جوجل. الرجاء المحاولة مرة أخرى.';
  if (lower.includes('unexpected_failure')) return 'فشل الاتصال بخدمة جوجل. الرجاء المحاولة مرة أخرى.';
  if (/[a-z]/i.test(decoded)) return 'حدث خطأ. حاول مرة أخرى.';
  return decoded;
}

export default function Auth() {
  const { user, loading, signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [authMode, setAuthMode] = useState<'signup' | 'login'>(() => {
    const tab = searchParams.get('tab');
    const mode = searchParams.get('mode');
    if (tab === 'login' || mode === 'login') return 'login';
    return 'signup';
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signupStep, setSignupStep] = useState<'phone' | 'credentials'>('phone');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
  });
  const [signupErrors, setSignupErrors] = useState<{ fullName?: string; phone?: string; email?: string; password?: string }>({});
  const [fieldValidity, setFieldValidity] = useState<{ fullName?: boolean; email?: boolean; password?: boolean }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    
    if (url.hash && url.hash.startsWith('#')) {
      const hashParams = new URLSearchParams(url.hash.slice(1));
      hashParams.forEach((value, key) => {
        params.append(key, value);
      });
    }
    
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (error) {
      console.error('[Auth] OAuth error received:', error, errorDescription);
      toast({
        title: 'فشل تسجيل الدخول مع جوجل',
        description: getAuthErrorMessage(decodeURIComponent(errorDescription || 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.')),
        variant: 'destructive',
      });
      
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('error');
      cleanUrl.searchParams.delete('error_code');
      cleanUrl.searchParams.delete('error_description');
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('state');
      cleanUrl.hash = '';
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error: exchangeError }) => {
          if (exchangeError) {
            console.error('[Auth] Failed to exchange code for session:', exchangeError);
          }
        })
        .finally(() => {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('code');
          cleanUrl.searchParams.delete('state');
          cleanUrl.hash = '';
          window.history.replaceState({}, '', cleanUrl.toString());
        });
    } 
    else if (accessToken) {
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          try {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
          } catch (err) {
            console.error('[Auth] Failed to set session from hash:', err);
          }
        }
        const cleanUrl = new URL(window.location.href);
        cleanUrl.hash = '';
        window.history.replaceState({}, '', cleanUrl.toString());
      }, 100);
    }
  }, [searchParams, toast]);

  const validateSignupField = useCallback(
    debounce((field: string, value: string) => {
      try {
        if (field === 'fullName') {
          z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').parse(value);
        } else if (field === 'email') {
          if (value.trim() !== '') {
            z.string().email('البريد الإلكتروني غير صالح').parse(value);
          }
        } else if (field === 'password') {
          z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').parse(value);
        }
        setSignupErrors(prev => ({ ...prev, [field]: undefined }));
        setFieldValidity(prev => ({ ...prev, [field]: true }));
      } catch (error) {
        if (error instanceof z.ZodError) {
          setSignupErrors(prev => ({ ...prev, [field]: error.errors[0].message }));
          setFieldValidity(prev => ({ ...prev, [field]: false }));
        }
      }
    }, 800),
    []
  );

  const handlePhoneSubmit = () => {
    if (phoneNumber.length < 10) {
      toast({
        title: 'خطأ في البيانات',
        description: 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل',
        variant: 'destructive',
      });
      return;
    }
    setSignupData(prev => ({ ...prev, phone: phoneNumber }));
    setSignupStep('credentials');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loginSchema.parse(loginData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: 'خطأ في البيانات', description: error.errors[0].message, variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);

    if (error) {
      toast({ title: 'فشل تسجيل الدخول', description: getAuthErrorMessage(error.message), variant: 'destructive' });
    } else {
      setShowSuccess(true);
      navigate('/dashboard');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    if (error) {
      toast({ title: 'فشل تسجيل الدخول مع جوجل', description: getAuthErrorMessage(error.message), variant: 'destructive' });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      signupSchema.parse(signupData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: any = {};
        error.errors.forEach(err => { if (err.path[0]) newErrors[err.path[0]] = err.message; });
        setSignupErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    const signUpOptions: any = {
      password: signupData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: signupData.fullName, phone: phoneNumber },
      },
    };
    
    if (signupData.email && signupData.email.trim() !== '') {
      signUpOptions.email = signupData.email;
    } else {
      signUpOptions.phone = phoneNumber;
    }
    
    const { error: signUpError } = await supabase.auth.signUp(signUpOptions);

    if (signUpError) {
      setIsLoading(false);
      toast({ title: 'فشل إنشاء الحساب', description: getAuthErrorMessage(signUpError.message), variant: 'destructive' });
      return;
    }

    const signInOptions: any = { password: signupData.password };
    if (signupData.email && signupData.email.trim() !== '') {
      signInOptions.email = signupData.email;
    } else {
      signInOptions.phone = phoneNumber;
    }
    
    const { error: signInError } = await supabase.auth.signInWithPassword(signInOptions);
    setIsLoading(false);

    if (signInError) {
      toast({ title: 'تم إنشاء الحساب', description: 'يرجى تسجيل الدخول للمتابعة.' });
      return;
    }

    setShowSuccess(true);
    facebookPixel.track('Lead');
    navigate('/product-onboarding');
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return 0;
    if (password.length < 4) return 1;
    if (password.length < 8) return 2;
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return 4;
    if (password.length >= 8) return 3;
    return 2;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-4 bg-background" dir="rtl">
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        <motion.div 
          className="flex items-center justify-center gap-3 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg overflow-hidden">
            <img src={soctivLogo} alt="Soctiv" className="w-full h-full object-cover" />
          </div>
          <span className="text-2xl font-heading font-bold">سوكتيف</span>
        </motion.div>

        <motion.div
          className="bg-white rounded-3xl p-6 shadow-xl border border-border/50 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold mb-1.5">
              {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {authMode === 'login' ? 'أدخل بياناتك للدخول إلى حسابك' : 'أدخل بياناتك لإنشاء حساب جديد'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={authMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {authMode === 'login' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">البريد الإلكتروني</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="example@domain.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="h-12 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">كلمة المرور</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        className="h-12 rounded-xl"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <AnimatedButton
                    className="w-full h-12 mt-2 rounded-2xl"
                    onClick={handleLogin}
                    loading={isLoading}
                  >
                    تسجيل الدخول
                  </AnimatedButton>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center"><span className="bg-white px-4 text-muted-foreground text-sm">أو</span></div>
                  </div>

                  <button
                    className="w-full h-12 rounded-2xl border-2 border-border flex items-center justify-center gap-2 hover:bg-accent transition-all duration-200"
                    onClick={handleGoogleSignIn}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium">المتابعة مع قوقل</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {signupStep === 'phone' ? (
                      <motion.div key="phone-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-phone">رقم الهاتف</Label>
                          <Input
                            id="signup-phone"
                            type="tel"
                            placeholder="09X XXX XXXX"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="h-12 rounded-xl"
                          />
                        </div>
                        <AnimatedButton className="w-full h-12 rounded-2xl" onClick={handlePhoneSubmit} loading={isLoading}>
                          متابعة بالرقم
                        </AnimatedButton>
                        <div className="relative my-6">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                          <div className="relative flex justify-center"><span className="bg-white px-4 text-muted-foreground text-sm">أو</span></div>
                        </div>
                        <button 
                          className="w-full h-12 rounded-2xl border-2 border-border flex items-center justify-center gap-2 hover:bg-accent transition-all duration-200" 
                          onClick={handleGoogleSignIn}
                        >
                           <svg className="h-5 w-5" viewBox="0 0 24 24">
                             <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                             <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                             <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                             <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                           </svg>
                           <span className="font-medium">المتابعة مع قوقل</span>
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="credentials-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <div className="bg-muted/50 p-4 rounded-2xl flex justify-between items-center">
                          <div>
                            <div className="text-xs text-muted-foreground">رقم الهاتف</div>
                            <div className="text-sm font-medium">{phoneNumber}</div>
                          </div>
                          <button className="text-primary text-sm underline" onClick={() => setSignupStep('phone')}>تغيير</button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-fullname">الاسم بالكامل</Label>
                          <Input id="signup-fullname" value={signupData.fullName} onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">البريد الالكتروني</Label>
                          <Input id="signup-email" type="email" value={signupData.email} onChange={(e) => setSignupData({ ...signupData, email: e.target.value })} className="h-12 rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">كلمة المرور</Label>
                          <div className="relative">
                            <Input id="signup-password" type={showSignupPassword ? 'text' : 'password'} value={signupData.password} onChange={(e) => setSignupData({ ...signupData, password: e.target.value })} className="h-12 rounded-xl" dir="ltr" />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowSignupPassword(!showSignupPassword)}>
                              {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <AnimatedButton className="w-full h-12 rounded-2xl" onClick={handleSignup} loading={isLoading}>إنشاء الحساب</AnimatedButton>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="text-center mt-6 text-sm">
          <span className="text-muted-foreground">{authMode === 'signup' ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'}</span>{' '}
          <button className="font-medium underline" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>
            {authMode === 'signup' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </button>
        </div>
      </div>

      <footer className="w-full py-6 text-center text-muted-foreground/50 text-xs border-t mt-8">
        <p>&copy; 2026 سوكتيف. جميع الحقوق محفوظة.</p>
        <a href="/privacy-policy" className="underline hover:text-primary">سياسة الخصوصية</a>
      </footer>
    </div>
  );
}