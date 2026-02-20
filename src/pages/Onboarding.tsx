import { Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, LogOut } from 'lucide-react';
const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((module) => ({ default: module.DotLottieReact }))
);
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
const ProgressBar = lazy(() =>
  import('@/components/onboarding/ProgressBar').then((module) => ({ default: module.ProgressBar }))
);
const MultipleChoiceQuestion = lazy(() =>
  import('@/components/onboarding/MultipleChoiceQuestion').then((module) => ({ default: module.MultipleChoiceQuestion }))
);
const TextQuestion = lazy(() =>
  import('@/components/onboarding/TextQuestion').then((module) => ({ default: module.TextQuestion }))
);
import { useAuth } from '@/hooks/useAuth';
import { analyticsService } from '@/services/analyticsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import soctivLogo from '@/assets/soctiv-logo-new.jpeg';
import { toArabicErrorMessage } from '@/lib/errors';

type RpcError = { message?: string } | null;
type ApprovalFeedbackRow = { rejection_reason: string | null; reviewer_notes: string | null };

type ApprovalRequestsQuery = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => Promise<{ data: ApprovalFeedbackRow | null; error: RpcError }>;
    };
  };
};

type SubmitApprovalRequestRpc = (
  fn: 'submit_approval_request',
  params: { p_user_id: string; p_client_id: string }
) => Promise<{ error: RpcError }>;

const approvalRequestsTable = (supabase.from as unknown as (table: string) => ApprovalRequestsQuery)('approval_requests');
const submitApprovalRequest = supabase.rpc as unknown as SubmitApprovalRequestRpc;

// Welcome Lottie animation
const welcomeLottieUrl = 'https://lottie.host/ccb413b1-a457-4b0a-aac4-f6db254ef648/oJPDAICLTd.lottie';

// Lottie animation URLs (dotLottie format)
const lottieUrls = [
  'https://lottie.host/129249b6-cc5f-4d03-8c41-26d56136a4bb/gO6teHwlpg.lottie', // 1. التخصص
  'https://lottie.host/127fcd11-a92b-4ccc-a730-43f6abbe54bb/vcl9y4yQD4.lottie', // 2. منطقة العمل
  'https://lottie.host/98e5c355-f7eb-487d-82fb-fdb662e06934/mbVmPB18tW.lottie', // 3. نقطة القوة
  'https://lottie.host/48d94421-b8e7-4c7e-8942-520fb7d35a6d/4t3Hnx3jnM.lottie', // 4. قيمة التعاقد
  'https://lottie.host/b9b97d6d-dd7a-414e-84d1-c69f918515b5/ESuAIzk15i.lottie', // 5. مقر الشركة
  'https://lottie.host/891085bb-4fd6-40a4-b6b7-7db4448cd15e/Rlfg8b0ekl.lottie', // 6. الإنجازات
  'https://lottie.host/b958ed9a-5281-4952-b988-69217c56bcda/Xxh2b01V1Z.lottie', // 7. العرض التشجيعي
  'https://lottie.host/6d7c8e9f-1234-5678-9abc-def012345678/facebook.lottie', // 8. رابط الفيسبوك
];

interface OnboardingData {
  specialty: string[];
  specialtyCustom: string;
  workArea: string[];
  workAreaCustom: string;
  strength: string[];
  strengthCustom: string;
  minContractValue: string;
  minContractValueCustom: string;
  headquarters: string;
  achievements: string;
  promotionalOffer: string[];
  promotionalOfferCustom: string;
  facebookUrl: string;
}

const TOTAL_STEPS = 8;

const specialtyOptions = [
  { value: 'تشطيبات متكاملة', label: 'تشطيبات متكاملة' },
  { value: 'بناء وإنشاءات (عظم)', label: 'بناء وإنشاءات (عظم)' },
  { value: 'خرائط وتصاميم هندسية', label: 'خرائط وتصاميم هندسية' },
  { value: 'تصنيع وتركيب مطابخ', label: 'تصنيع وتركيب مطابخ' },
];

const workAreaOptions = [
  { value: 'طرابلس', label: 'طرابلس' },
  { value: 'بنغازي', label: 'بنغازي' },
  { value: 'مصراتة', label: 'مصراتة' },
];

const strengthOptions = [
  { value: 'الالتزام التام بالمواعيد', label: 'الالتزام التام بالمواعيد' },
  { value: 'دقة وجودة التنفيذ', label: 'دقة وجودة التنفيذ' },
  { value: 'سرعة الإنجاز القياسية', label: 'سرعة الإنجاز القياسية' },
  { value: 'الأمانة والمصداقية العالية', label: 'الأمانة والمصداقية العالية' },
];

const contractValueOptions = [
  { value: 'نرحب بجميع فئات المشاريع', label: 'نرحب بجميع فئات المشاريع' },
  { value: 'تعاقدات تبدأ من 10,000 د.ل إلى 50,000 د.ل', label: 'تعاقدات تبدأ من 10,000 د.ل إلى 50,000 د.ل' },
  { value: 'تعاقدات تبدأ من 100,000 د.ل فما فوق', label: 'تعاقدات تبدأ من 100,000 د.ل فما فوق' },
];

const promotionalOfferOptions = [
  { value: 'استشارة هندسية أو زيارة ميدانية مجانية', label: 'استشارة هندسية أو زيارة ميدانية مجانية' },
  { value: 'تصميم 3D مجاني عند التعاقد', label: 'تصميم 3D مجاني عند التعاقد' },
  { value: 'خصم نقدي (نسبة مئوية) لفترة محدودة', label: 'خصم نقدي (نسبة مئوية) لفترة محدودة' },
  { value: 'تسهيلات في الدفع (نظام أقساط أو دفعات)', label: 'تسهيلات في الدفع (نظام أقساط أو دفعات)' },
];

const questions = [
  'ما هو تخصصكم الأساسي الذي نركز عليه؟',
  'أين تتركز منطقة عملكم؟',
  'ما هي نقطة قوتكم الكبرى؟',
  'ما هو الحد الأدنى لقيمة التعاقد التي تقبلها الشركة؟',
  'أين يقع مقر الشركة الرسمي؟',
  'نبذة عن أبرز إنجازات الشركة',
  'ما هو العرض التشجيعي الذي يمكننا تقديمه للعملاء الجدد؟',
  'ما هو رابط صفحتكم على الفيسبوك؟',
];

// Smooth spring transition for general UI
const springTransition = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 25,
  mass: 0.8,
};

// Smooth tween transition for step changes - more predictable and controlled
const stepTransition = {
  type: 'tween' as const,
  duration: 0.4,
  ease: 'easeInOut' as const,
};

const ONBOARDING_STORAGE_KEY = 'soctiv_onboarding_draft';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, client, profile, refreshUserData, signOut } = useAuth();
  useEffect(() => {
    if (!user) return;
    const key = `soctiv_onboarding_started:${user.id}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // ignore storage errors
    }

    void analyticsService.trackEvent({
      userId: user.id,
      clientId: client?.id ?? null,
      eventType: 'onboarding_started',
      eventName: 'onboarding_started',
      metadata: { source: 'onboarding_page' },
    });
  }, [user, client?.id]);

  useEffect(() => {
    const fetchApprovalFeedback = async () => {
      if (!profile?.id || profile.approval_status !== 'rejected') {
        setApprovalFeedback(null);
        return;
      }
      const { data: requestData } = await approvalRequestsTable
        .select('rejection_reason,reviewer_notes')
        .eq('user_id', profile.id)
        .single();
      setApprovalFeedback(requestData || null);
    };
    fetchApprovalFeedback();
  }, [profile?.id, profile?.approval_status]);
  const [showWelcome, setShowWelcome] = useState(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.showWelcome !== undefined ? parsed.showWelcome : true;
      } catch (e) {
        return true;
      }
    }
    return true;
  });

  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.step || 1;
      } catch (e) {
        return 1;
      }
    }
    return 1;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
  const [approvalFeedback, setApprovalFeedback] = useState<{ rejection_reason: string | null; reviewer_notes: string | null } | null>(null);
  const [data, setData] = useState<OnboardingData>(() => {
    const defaultData = {
      specialty: [],
      specialtyCustom: '',
      workArea: [],
      workAreaCustom: '',
      strength: [],
      strengthCustom: '',
      minContractValue: '',
      minContractValueCustom: '',
      headquarters: '',
      achievements: '',
      promotionalOffer: [],
      promotionalOfferCustom: '',
      facebookUrl: '',
    };

    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.data || defaultData;
      } catch (e) {
        return defaultData;
      }
    }
    return defaultData;
  });

  // Save draft on every change
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
      data,
      step: currentStep,
      showWelcome,
    }));
  }, [data, currentStep, showWelcome]);

  const updateData = (key: keyof OnboardingData, value: string | string[] | boolean) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const getArrayValue = (selected: string[], custom: string) => {
    // If 'other' is selected, add custom value; filter out 'other' from final result
    const values = selected.filter(v => v !== 'other');
    if (selected.includes('other') && custom.trim()) {
      values.push(custom.trim());
    }
    return values.join(', ');
  };

  const getValue = (selected: string, custom: string) => {
    return selected === 'other' ? custom : selected;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.specialty.length > 0 && (!data.specialty.includes('other') || data.specialtyCustom.trim());
      case 2:
        return data.workArea.length > 0 && (!data.workArea.includes('other') || data.workAreaCustom.trim());
      case 3:
        return data.strength.length > 0 && (!data.strength.includes('other') || data.strengthCustom.trim());
      case 4:
        return data.minContractValue && (data.minContractValue !== 'other' || data.minContractValueCustom.trim());
      case 5:
        return data.headquarters.trim().length > 0;
      case 6:
        return data.achievements.trim().length > 0;
      case 7:
        return data.promotionalOffer.length > 0 && (!data.promotionalOffer.includes('other') || data.promotionalOfferCustom.trim());
      case 8:
        return data.facebookUrl.trim().length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    setDirection(1);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setDirection(-1);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!client && !user) {
      toast.error('تعذر تحميل بيانات الحساب. يرجى إعادة تسجيل الدخول.');
      return;
    }

    setIsSubmitting(true);
    try {
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const metaCompanyName =
        typeof meta.company_name === 'string'
          ? meta.company_name
          : typeof meta.companyName === 'string'
            ? meta.companyName
            : null;

      const userId = user?.id ?? client?.user_id;
      const companyName = client?.company_name ?? metaCompanyName ?? '';

      // Upsert ensures the client row exists even if the DB trigger didn't create it.
      const { data: updatedClient, error } = await supabase
        .from('clients')
        .upsert(
          {
            user_id: userId!,
            company_name: companyName,
            specialty: getArrayValue(data.specialty, data.specialtyCustom),
            work_area: getArrayValue(data.workArea, data.workAreaCustom),
            strength: getArrayValue(data.strength, data.strengthCustom),
            min_contract_value: getValue(data.minContractValue, data.minContractValueCustom),
            headquarters: data.headquarters,
            achievements: data.achievements,
            promotional_offer: getArrayValue(data.promotionalOffer, data.promotionalOfferCustom),
            facebook_url: data.facebookUrl,
            onboarding_completed: true,
          },
          { onConflict: 'user_id' }
        )
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      if (!updatedClient) throw new Error('تعذر العثور على حساب العميل');

      if (profile?.approval_status === 'rejected') {
        const { error: submitError } = await submitApprovalRequest('submit_approval_request', {
          p_user_id: userId!,
          p_client_id: updatedClient.id,
        });
        if (submitError) throw new Error(submitError.message || 'تعذر إرسال طلب المراجعة');
      }

      // Clear draft on success
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);

      await refreshUserData();
      toast.success('تم حفظ البيانات بنجاح!');
      navigate('/pending-approval');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error(toArabicErrorMessage(error, 'حدث خطأ في حفظ البيانات'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    const lottieUrl = lottieUrls[currentStep - 1];

    switch (currentStep) {
      case 1:
        return (
          <MultipleChoiceQuestion
            options={specialtyOptions}
            selectedValue={data.specialty}
            customValue={data.specialtyCustom}
            onSelect={(v) => updateData('specialty', v)}
            onCustomChange={(v) => updateData('specialtyCustom', v)}
            customPlaceholder="اكتب تخصصك هنا..."
            lottieUrl={lottieUrl}
            multiSelect
          />
        );
      case 2:
        return (
          <MultipleChoiceQuestion
            options={workAreaOptions}
            selectedValue={data.workArea}
            customValue={data.workAreaCustom}
            onSelect={(v) => updateData('workArea', v)}
            onCustomChange={(v) => updateData('workAreaCustom', v)}
            customPlaceholder="اكتب المدينة هنا..."
            lottieUrl={lottieUrl}
            multiSelect
          />
        );
      case 3:
        return (
          <MultipleChoiceQuestion
            options={strengthOptions}
            selectedValue={data.strength}
            customValue={data.strengthCustom}
            onSelect={(v) => updateData('strength', v)}
            onCustomChange={(v) => updateData('strengthCustom', v)}
            customPlaceholder="اكتب ميزتكم هنا..."
            lottieUrl={lottieUrl}
            multiSelect
          />
        );
      case 4:
        return (
          <MultipleChoiceQuestion
            options={contractValueOptions}
            selectedValue={data.minContractValue}
            customValue={data.minContractValueCustom}
            onSelect={(v) => updateData('minContractValue', typeof v === 'string' ? v : v[0] || '')}
            onCustomChange={(v) => updateData('minContractValueCustom', v)}
            customPlaceholder="حدد ميزانية معينة..."
            lottieUrl={lottieUrl}
          />
        );
      case 5:
        return (
          <TextQuestion
            value={data.headquarters}
            onChange={(v) => updateData('headquarters', v)}
            placeholder="مثال: طرابلس - حي الأندلس"
            lottieUrl={lottieUrl}
          />
        );
      case 6:
        return (
          <TextQuestion
            value={data.achievements}
            onChange={(v) => updateData('achievements', v)}
            placeholder="اذكر أهم المشاريع التي نفذتها أو عدد سنوات الخبرة"
            isTextArea
            lottieUrl={lottieUrl}
          />
        );
      case 7:
        return (
          <MultipleChoiceQuestion
            options={promotionalOfferOptions}
            selectedValue={data.promotionalOffer}
            customValue={data.promotionalOfferCustom}
            onSelect={(v) => updateData('promotionalOffer', v)}
            onCustomChange={(v) => updateData('promotionalOfferCustom', v)}
            customPlaceholder="اكتب عرضك الخاص هنا..."
            lottieUrl={lottieUrl}
            multiSelect
          />
        );
      case 8:
        return (
          <TextQuestion
            value={data.facebookUrl}
            onChange={(v) => updateData('facebookUrl', v)}
            placeholder="https://facebook.com/yourpage"
            lottieUrl={lottieUrl}
            showFacebookButton
          />
        );
      default:
        return null;
    }
  };

  // Unified step variants - question and answer move together
  const stepVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 15 : -15,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -15 : 15,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <LayoutGroup>
        <AnimatePresence mode="wait">
          {showWelcome ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center gap-6"
            >
              {/* Logo with pulse effect */}
              <motion.div
                layoutId="logo"
                className="relative"
              >
                <motion.img
                  src={soctivLogo}
                  alt="Soctiv"
                  className="w-32 h-32 rounded-2xl object-cover shadow-2xl border-4 border-white"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springTransition}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl border-4 border-primary/30"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>

              {/* Welcome text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...springTransition }}
                className="text-center space-y-2"
              >
                <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary" />
                  مرحباً بك في سوكتيف
                  <Sparkles className="w-6 h-6 text-primary" />
                </h1>
                <p className="text-muted-foreground text-lg">
                  دعنا نتعرف على شركتك في خطوات بسيطة
                </p>
              </motion.div>

              {/* Welcome Lottie Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, ...springTransition }}
              >
                <Suspense fallback={<div className="w-[200px] h-[200px] rounded-full bg-muted/50" />}>
                  <DotLottieReact
                    src={welcomeLottieUrl}
                    loop
                    autoplay
                    style={{ width: 200, height: 200 }}
                  />
                </Suspense>
              </motion.div>

              {/* Start button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ...springTransition }}
                className="flex flex-col gap-3 items-center"
              >
                <Button
                  onClick={() => setShowWelcome(false)}
                  size="lg"
                  className="px-12 py-6 text-lg rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  هيا نبدأ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="w-4 h-4 ml-2" />
                  تسجيل الخروج
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="questions"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springTransition}
              className="w-full max-w-lg"
            >
              <Card className="p-6 shadow-xl overflow-hidden">
                <div className="flex flex-col items-center">
                  {/* Logo at top */}
                  <motion.img
                    layoutId="logo"
                    src={soctivLogo}
                    alt="Soctiv"
                    className="w-16 h-16 rounded-xl object-cover shadow-lg border-2 border-white mb-4"
                    transition={springTransition}
                  />

                  {approvalFeedback && (
                    <div className="w-full mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-right space-y-2">
                      <p className="font-semibold text-destructive">طلبك السابق تم رفضه</p>
                      <p className="text-sm text-muted-foreground">
                        السبب: {approvalFeedback.rejection_reason || 'لم يتم إدخال سبب محدد.'}
                      </p>
                      {approvalFeedback.reviewer_notes && (
                        <p className="text-sm text-muted-foreground">
                          ملاحظات المراجع: {approvalFeedback.reviewer_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="w-full mb-4">
                    <Suspense fallback={<div className="h-2 rounded-full bg-muted/50" />}>
                      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
                    </Suspense>
                  </div>

                  {/* Unified step transition - question and answer together */}
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                      key={`step-${currentStep}`}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={stepTransition}
                      className="w-full min-h-[280px] flex flex-col"
                    >
                      {/* Question */}
                      <h2 className="text-lg font-semibold text-foreground text-center mb-4">
                        {questions[currentStep - 1]}
                      </h2>

                      {/* Answer */}
                      <div className="w-full flex-1">
                        <Suspense fallback={<div className="h-56 rounded-xl bg-muted/50" />}>
                          {renderStep()}
                        </Suspense>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation buttons */}
                  <motion.div
                    layout
                    className="flex gap-3 mt-6 w-full"
                  >
                    {currentStep > 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          onClick={handleBack}
                          className="w-full gap-2 hover:scale-[1.02] transition-transform"
                        >
                          <ArrowRight className="w-4 h-4" />
                          السابق
                        </Button>
                      </motion.div>
                    )}


                    <motion.div layout className="flex-1">
                      <Button
                        onClick={handleNext}
                        disabled={!canProceed() || isSubmitting}
                        className="w-full gap-2 hover:scale-[1.02] transition-transform"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            جاري الحفظ...
                          </>
                        ) : currentStep === TOTAL_STEPS ? (
                          'إنهاء'
                        ) : (
                          <>
                            التالي
                            <ArrowLeft className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
