import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { MultipleChoiceQuestion } from '@/components/onboarding/MultipleChoiceQuestion';
import { TextQuestion } from '@/components/onboarding/TextQuestion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export default function Onboarding() {
  const navigate = useNavigate();
  const { client, refreshUserData } = useAuth();
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
    switch (currentStep) {
      case 1:
        return (
          <MultipleChoiceQuestion
            question="ما هو تخصصكم الأساسي الذي نركز عليه؟"
            options={specialtyOptions}
            selectedValue={data.specialty}
            customValue={data.specialtyCustom}
            onSelect={(v) => updateData('specialty', v)}
            onCustomChange={(v) => updateData('specialtyCustom', v)}
            customPlaceholder="اكتب تخصصك هنا..."
          />
        );
      case 2:
        return (
          <MultipleChoiceQuestion
            question="أين تتركز منطقة عملكم؟"
            options={workAreaOptions}
            selectedValue={data.workArea}
            customValue={data.workAreaCustom}
            onSelect={(v) => updateData('workArea', v)}
            onCustomChange={(v) => updateData('workAreaCustom', v)}
            customPlaceholder="اكتب المدينة هنا..."
          />
        );
      case 3:
        return (
          <MultipleChoiceQuestion
            question="ما هي نقطة قوتكم الكبرى؟"
            options={strengthOptions}
            selectedValue={data.strength}
            customValue={data.strengthCustom}
            onSelect={(v) => updateData('strength', v)}
            onCustomChange={(v) => updateData('strengthCustom', v)}
            customPlaceholder="اكتب ميزتكم هنا..."
          />
        );
      case 4:
        return (
          <MultipleChoiceQuestion
            question="ما هو الحد الأدنى لقيمة التعاقد التي تقبلها الشركة؟"
            options={contractValueOptions}
            selectedValue={data.minContractValue}
            customValue={data.minContractValueCustom}
            onSelect={(v) => updateData('minContractValue', v)}
            onCustomChange={(v) => updateData('minContractValueCustom', v)}
            customPlaceholder="حدد ميزانية معينة..."
          />
        );
      case 5:
        return (
          <TextQuestion
            question="أين يقع مقر الشركة الرسمي؟"
            description="مثال: طرابلس - حي الأندلس"
            value={data.headquarters}
            onChange={(v) => updateData('headquarters', v)}
            placeholder="اكتب العنوان هنا..."
          />
        );
      case 6:
        return (
          <TextQuestion
            question="نبذة عن أبرز إنجازات الشركة"
            description="اذكر أهم المشاريع التي نفذتها أو عدد سنوات الخبرة"
            value={data.achievements}
            onChange={(v) => updateData('achievements', v)}
            placeholder="اكتب إنجازاتكم هنا..."
            isTextArea
          />
        );
      case 7:
        return (
          <MultipleChoiceQuestion
            question="ما هو العرض التشجيعي الذي يمكنكم تقديمه للعملاء الجدد؟"
            options={promotionalOfferOptions}
            selectedValue={data.promotionalOffer}
            customValue={data.promotionalOfferCustom}
            onSelect={(v) => updateData('promotionalOffer', v)}
            onCustomChange={(v) => updateData('promotionalOfferCustom', v)}
            customPlaceholder="اكتب عرضك الخاص هنا..."
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center"
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً بك في سوكتيف</h1>
          <p className="text-muted-foreground text-sm">
            أجب على الأسئلة التالية لتخصيص تجربتك
          </p>
        </div>

        {/* Progress */}
        <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="min-h-[300px]"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            السابق
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            className="gap-2 min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : currentStep === TOTAL_STEPS ? (
              'إرسال'
            ) : (
              <>
                التالي
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
