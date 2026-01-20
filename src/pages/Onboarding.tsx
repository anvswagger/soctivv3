import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { MultipleChoiceQuestion } from '@/components/onboarding/MultipleChoiceQuestion';
import { TextQuestion } from '@/components/onboarding/TextQuestion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import soctivLogo from '@/assets/soctiv-logo-new.jpeg';

// Lottie animation URLs (dotLottie format)
const lottieUrls = [
  'https://lottie.host/129249b6-cc5f-4d03-8c41-26d56136a4bb/gO6teHwlpg.lottie', // specialty
  '', // location (placeholder)
  '', // strength (placeholder)
  '', // contract (placeholder)
  '', // headquarters (placeholder)
  '', // achievements (placeholder)
  '', // offer (placeholder)
];

interface OnboardingData {
  specialty: string;
  specialtyCustom: string;
  workArea: string;
  workAreaCustom: string;
  strength: string;
  strengthCustom: string;
  minContractValue: string;
  minContractValueCustom: string;
  headquarters: string;
  achievements: string;
  promotionalOffer: string;
  promotionalOfferCustom: string;
}

const TOTAL_STEPS = 7;

const specialtyOptions = [
  { value: 'finishing', label: 'تشطيبات متكاملة' },
  { value: 'construction', label: 'بناء وإنشاءات (عظم)' },
  { value: 'engineering', label: 'خرائط وتصاميم هندسية' },
  { value: 'kitchen', label: 'تصنيع وتركيب مطابخ' },
];

const workAreaOptions = [
  { value: 'tripoli', label: 'طرابلس' },
  { value: 'benghazi', label: 'بنغازي' },
  { value: 'misrata', label: 'مصراتة' },
];

const strengthOptions = [
  { value: 'punctuality', label: 'الالتزام التام بالمواعيد' },
  { value: 'quality', label: 'دقة وجودة التنفيذ' },
  { value: 'speed', label: 'سرعة الإنجاز القياسية' },
  { value: 'trust', label: 'الأمانة والمصداقية العالية' },
];

const contractValueOptions = [
  { value: 'all', label: 'نرحب بجميع فئات المشاريع' },
  { value: '10k-50k', label: 'تعاقدات تبدأ من 10,000 د.ل إلى 50,000 د.ل' },
  { value: '100k+', label: 'تعاقدات تبدأ من 100,000 د.ل فما فوق' },
];

const promotionalOfferOptions = [
  { value: 'consultation', label: 'استشارة هندسية أو زيارة ميدانية مجانية' },
  { value: '3d-design', label: 'تصميم 3D مجاني عند التعاقد' },
  { value: 'discount', label: 'خصم نقدي (نسبة مئوية) لفترة محدودة' },
  { value: 'installments', label: 'تسهيلات في الدفع (نظام أقساط أو دفعات)' },
];

const questions = [
  'ما هو تخصصكم الأساسي الذي نركز عليه؟',
  'أين تتركز منطقة عملكم؟',
  'ما هي نقطة قوتكم الكبرى؟',
  'ما هو الحد الأدنى لقيمة التعاقد التي تقبلها الشركة؟',
  'أين يقع مقر الشركة الرسمي؟',
  'نبذة عن أبرز إنجازات الشركة',
  'ما هو العرض التشجيعي الذي يمكننا تقديمه للعملاء الجدد؟',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { client, refreshUserData } = useAuth();
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    specialty: '',
    specialtyCustom: '',
    workArea: '',
    workAreaCustom: '',
    strength: '',
    strengthCustom: '',
    minContractValue: '',
    minContractValueCustom: '',
    headquarters: '',
    achievements: '',
    promotionalOffer: '',
    promotionalOfferCustom: '',
  });

  const updateData = (key: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = (selected: string, custom: string) => {
    return selected === 'other' ? custom : selected;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.specialty && (data.specialty !== 'other' || data.specialtyCustom.trim());
      case 2:
        return data.workArea && (data.workArea !== 'other' || data.workAreaCustom.trim());
      case 3:
        return data.strength && (data.strength !== 'other' || data.strengthCustom.trim());
      case 4:
        return data.minContractValue && (data.minContractValue !== 'other' || data.minContractValueCustom.trim());
      case 5:
        return data.headquarters.trim().length > 0;
      case 6:
        return data.achievements.trim().length > 0;
      case 7:
        return data.promotionalOffer && (data.promotionalOffer !== 'other' || data.promotionalOfferCustom.trim());
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!client) {
      toast.error('حدث خطأ في تحميل بيانات الحساب');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          specialty: getValue(data.specialty, data.specialtyCustom),
          work_area: getValue(data.workArea, data.workAreaCustom),
          strength: getValue(data.strength, data.strengthCustom),
          min_contract_value: getValue(data.minContractValue, data.minContractValueCustom),
          headquarters: data.headquarters,
          achievements: data.achievements,
          promotional_offer: getValue(data.promotionalOffer, data.promotionalOfferCustom),
          onboarding_completed: true,
        })
        .eq('id', client.id);

      if (error) throw error;

      await refreshUserData();
      toast.success('تم حفظ البيانات بنجاح!');
      navigate('/pending-approval');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('حدث خطأ في حفظ البيانات');
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
          />
        );
      case 4:
        return (
          <MultipleChoiceQuestion
            options={contractValueOptions}
            selectedValue={data.minContractValue}
            customValue={data.minContractValueCustom}
            onSelect={(v) => updateData('minContractValue', v)}
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
          />
        );
      default:
        return null;
    }
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
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-8"
            >
              <motion.div
                layoutId="logo"
                className="relative"
              >
                <motion.img
                  src={soctivLogo}
                  alt="Soctiv"
                  className="w-40 h-40 rounded-2xl object-cover shadow-2xl border-4 border-white"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.8 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl border-4 border-primary/30"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  onClick={() => setShowWelcome(false)} 
                  size="lg"
                  className="px-12 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-shadow"
                >
                  ابدأ
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-lg"
            >
              <Card className="p-6 shadow-xl">
                <div className="flex flex-col items-center">
                  {/* Logo at top */}
                  <motion.img
                    layoutId="logo"
                    src={soctivLogo}
                    alt="Soctiv"
                    className="w-20 h-20 rounded-xl object-cover shadow-lg border-2 border-white mb-6"
                  />
                  
                  {/* Progress bar */}
                  <div className="w-full mb-6">
                    <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
                  </div>
                  
                  {/* Question */}
                  <motion.h2
                    key={currentStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-lg font-semibold text-foreground text-center mb-4"
                  >
                    {questions[currentStep - 1]}
                  </motion.h2>
                  
                  {/* Answers */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="w-full"
                    >
                      {renderStep()}
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation buttons */}
                  <div className="flex gap-3 mt-6 w-full">
                    {currentStep > 1 && (
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1 gap-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        السابق
                      </Button>
                    )}
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed() || isSubmitting}
                      className="flex-1 gap-2"
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
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
