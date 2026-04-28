import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Package, Plus, Trash2, Upload, X, Image as ImageIcon, Check, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useImageKit } from '@/hooks/useImageKit';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
const soctivLogo = '/Soctiv-Logo.svg';
import { toArabicErrorMessage } from '@/lib/errors';
import { safeLocalRemove, safeLocalSet, safeReadJson } from '@/lib/safeStorage';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { facebookPixel } from '@/services/analyticsService';

interface ProductForm {
  name: string;
  description: string;
  price: string;
  returnRate: number;
  offer: string;
  imageFile: File | null;
  imagePreview: string | null;
  uploadedImageUrl: string | null;
}

interface SavedProduct {
  name: string;
  description: string;
  price: string;
  returnRate: number;
  offer: string;
  imageUrl: string | null;
}

const TOTAL_STEPS = 5;

const STEP_LABELS = [
  'اسم المنتج',
  'وصف المنتج',
  'صورة المنتج',
  'السعر',
  'العرض',
];

const PRODUCT_ONBOARDING_STORAGE_KEY_PREFIX = 'soctiv_product_onboarding_draft';

const DEFAULT_PRODUCT: ProductForm = {
  name: '',
  description: '',
  price: '',
  returnRate: 25, // Default smart average return rate
  offer: '',
  imageFile: null,
  imagePreview: null,
  uploadedImageUrl: null,
};

const springTransition = {
  type: 'spring' as const,
  stiffness: 200,
  damping: 25,
  mass: 0.8,
};

const stepTransition = {
  type: 'tween' as const,
  duration: 0.4,
  ease: 'easeInOut' as const,
};

function getStorageKey(userId: string): string {
  return `${PRODUCT_ONBOARDING_STORAGE_KEY_PREFIX}:${userId}`;
}

export default function ProductOnboarding() {
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const navigate = useNavigate();
  const { user, client, profile, signOut, refreshUserData, onboardingCompleted, loading, isApproved } = useAuth();
  const { upload: uploadToImageKit, isUploading: uploadingImage } = useImageKit();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showWelcome, setShowWelcome] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [product, setProduct] = useState<ProductForm>({ ...DEFAULT_PRODUCT });
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);

  const storageKey = useMemo(() => (user?.id ? getStorageKey(user.id) : null), [user?.id]);

  // Restore draft from localStorage
  useEffect(() => {
    if (!storageKey) return;
    const raw = safeReadJson<unknown>('local', storageKey, null);
    if (!raw || typeof raw !== 'object') return;
    const draft = raw as Record<string, unknown>;

    if (Array.isArray(draft.savedProducts)) {
      setSavedProducts(draft.savedProducts as SavedProduct[]);
    }
    if (typeof draft.showWelcome === 'boolean') setShowWelcome(draft.showWelcome);
    if (typeof draft.currentStep === 'number') setCurrentStep(Math.min(TOTAL_STEPS, Math.max(1, draft.currentStep)));
    if (draft.currentProduct && typeof draft.currentProduct === 'object') {
      setProduct(draft.currentProduct as ProductForm);
    }
  }, [storageKey]);

  // Save draft to localStorage - auto save everything including current product
  useEffect(() => {
    if (!storageKey) return;
    safeLocalSet(storageKey, JSON.stringify({
      savedProducts,
      showWelcome,
      currentStep,
      currentProduct: product,
    }));
  }, [storageKey, savedProducts, showWelcome, currentStep, product]);
  
  console.log('[ProductOnboarding] render state:', { 
    user: !!user, 
    client: !!client, 
    onboardingCompleted, 
    loading 
  });

  // If already completed, redirect appropriately
  if (onboardingCompleted) {
    console.log('[ProductOnboarding] onboarding completed');
    if (!isApproved) {
      return <Navigate to="/pending-approval" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  if (loading) {
    console.log('[ProductOnboarding] showing loader');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const updateProduct = (key: keyof ProductForm, value: any) => {
    setProduct((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    updateProduct('imageFile', file);
    updateProduct('uploadedImageUrl', null);
    const reader = new FileReader();
    reader.onloadend = () => updateProduct('imagePreview', reader.result as string);
    reader.readAsDataURL(file);

    // Auto-upload immediately
    setUploadProgress(0);
    try {
      const result = await uploadToImageKit(file, '/products', {
        onProgress: (progress) => setUploadProgress(progress.percentage),
      });
      updateProduct('uploadedImageUrl', result.url);
      setUploadProgress(100);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error: any) {
      updateProduct('imageFile', null);
      updateProduct('imagePreview', null);
      setUploadProgress(0);
      toast.error(toArabicErrorMessage(error, 'فشل رفع الصورة'));
    }
  };

  const clearImage = () => {
    updateProduct('imageFile', null);
    updateProduct('imagePreview', null);
    updateProduct('uploadedImageUrl', null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return product.name.trim().length > 0;
      case 2: return true; // description optional
      case 3: return !uploadingImage; // image optional
      case 4: return product.price.trim().length > 0 && !isNaN(parseFloat(product.price));
      case 5: return true; // slider always has a value
      case 6: return true; // offer is optional
      default: return false;
    }
  };

  const handleNext = () => {
    setDirection(1);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSaveProduct();
    }
  };

  const handleSkipStep = () => {
    handleNext();
    toast.info('تم تخطي الخطوة');
  };

  const handleBack = () => {
    setDirection(-1);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSaveProduct = async () => {
    const imageUrl = product.uploadedImageUrl || null;

    const saved: SavedProduct = {
      name: product.name.trim(),
      description: product.description.trim(),
      price: product.price.trim(),
      returnRate: product.returnRate,
      offer: product.offer.trim(),
      imageUrl,
    };

    setSavedProducts((prev) => [...prev, saved]);
    setProduct({ ...DEFAULT_PRODUCT });
    setCurrentStep(1);
    setDirection(1);
    toast.success(`✅ تمت إضافة "${saved.name}" بنجاح! يمكنك إضافة منتج آخر أو النهاء مباشرة.`);
  };

  const handleRemoveSaved = (index: number) => {
    setSavedProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (savedProducts.length === 0) {
      toast.error('يجب إضافة منتج واحد على الأقل');
      return;
    }

    if (!client && !user) {
      toast.error('تعذر تحميل بيانات الحساب. يرجى إعادة تسجيل الدخول.');
      return;
    }

    setIsSubmitting(true);
    try {
      const clientId = client?.id;
      if (!clientId) throw new Error('تعذر العثور على حساب العميل');

      if (savedProducts.length > 0) {
        const productsToInsert = savedProducts.map((p) => ({
          name: p.name,
          description: p.description || null,
          price: parseFloat(p.price) || 0,
          return_rate: p.returnRate || null,
          offer: p.offer || null,
          image_url: p.imageUrl,
          client_id: clientId,
          is_active: true,
        }));

        const { error } = await supabase.from('products').insert(productsToInsert as any);
        if (error) throw new Error(error.message);
      }

      // Set onboarding_completed flag
      await supabase
        .from('clients')
        .update({ onboarding_completed: true } as any)
        .eq('id', clientId as any);

      // Handle rejected users re-submitting for approval
      if (profile?.approval_status === 'rejected') {
        const userId = user?.id ?? client?.user_id;
        const { error: submitError } = await supabase.rpc('submit_approval_request', {
          p_user_id: userId!,
          p_client_id: clientId,
        } as any);
        if (submitError) throw new Error(submitError.message || 'تعذر إرسال طلب المراجعة');
      }

      if (storageKey) safeLocalRemove(storageKey);

      await refreshUserData({ force: true, mode: 'blocking', reason: 'product-onboarding-submit' });
      toast.success('تم حفظ المنتجات بنجاح!');

      // Track SubmitApplication event in Facebook Pixel
      facebookPixel.track('SubmitApplication');

      // After product onboarding, go to pending approval page, NOT dashboard
      navigate('/pending-approval');
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error(toArabicErrorMessage(error, 'حدث خطأ في حفظ المنتجات'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4 w-full">
            <Label className="text-sm font-medium block mb-2">اسم المنتج</Label>
            <Input
              value={product.name}
              onChange={(e) => updateProduct('name', e.target.value)}
              placeholder="مثال: ساعة ذكية"
              className="text-right text-lg"
              autoFocus
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 w-full">
            <Label className="text-sm font-medium block mb-2">وصف المنتج</Label>
            <textarea
              value={product.description}
              onChange={(e) => updateProduct('description', e.target.value)}
              placeholder="اكتب وصفاً تفصيلياً للمنتج..."
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-right text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              autoFocus
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleSkipStep}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              تخطي الوصف
            </Button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4 w-full">
            <Label className="text-sm font-medium block mb-2">صورة المنتج</Label>
            <div className="flex items-center justify-center gap-3">
              {product.imagePreview ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-border">
                  <img src={product.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                      <span className="text-white text-xs font-medium">{uploadProgress}%</span>
                    </div>
                  )}
                  {product.uploadedImageUrl && !uploadingImage && (
                    <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {uploadingImage && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {product.uploadedImageUrl && !uploadingImage && (
              <p className="text-xs text-green-600 text-center font-medium">تم رفع الصورة بنجاح</p>
            )}

            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {product.imageFile ? 'تغيير الصورة' : 'رفع صورة'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">PNG, JPG حتى 5MB — اختياري</p>
            </div>
            
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleSkipStep}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              تخطي الصورة
            </Button>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4 w-full">
            <Label className="text-sm font-medium block mb-2">السعر</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={product.price}
                onChange={(e) => updateProduct('price', e.target.value)}
                placeholder="0.00"
                className="text-right text-2xl text-center pr-16"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                د.ل
              </span>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 w-full">
            <Label className="text-sm font-medium block mb-2">العرض (اختياري)</Label>
            <Input
              value={product.offer}
              onChange={(e) => updateProduct('offer', e.target.value)}
              placeholder="مثال: خصم 20% للطلب الأول"
              className="text-right"
              autoFocus
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={handleSkipStep}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              تخطي
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

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

  console.log('[ProductOnboarding] showWelcome:', showWelcome, 'currentStep:', currentStep);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4" dir="rtl">
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
              <motion.div layoutId="logo" className="relative">
                <motion.img
                  src={soctivLogo}
                  alt="Soctiv"
                  className="w-32 h-32 object-contain shadow-2xl"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={springTransition}
                  onError={(e) => {
                    console.error('[ProductOnboarding] Logo image failed to load');
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, ...springTransition }}
                className="text-center space-y-2"
              >
                <h1 className="text-3xl font-bold text-foreground">
                  <Package className="w-7 h-7 text-primary inline-block ml-2" />
                  أضف منتجاتك
                </h1>
                <p className="text-muted-foreground text-lg">
                  أضف منتجاتك وحدد أسعارها وعروضك
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ...springTransition }}
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
              <Card className="p-6 shadow-xl overflow-hidden mb-4">
                <div className="flex flex-col items-center">
                  <motion.img
                    layoutId="logo"
                    src={soctivLogo}
                    alt="Soctiv"
                    className="w-14 h-14 object-contain shadow-lg mb-4"
                    transition={springTransition}
                    onError={(e) => {
                      console.error('[ProductOnboarding] Logo image failed to load');
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  {/* Saved products list */}
                  {savedProducts.length > 0 && (
                    <div className="w-full mb-4 space-y-2">
                      <p className="text-xs text-muted-foreground text-right font-medium">المنتجات المضافة:</p>
                      {savedProducts.map((sp, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border text-sm">
                          <Badge variant="secondary" className="shrink-0">
                            <Check className="h-3 w-3 ml-1" />
                            {idx + 1}
                          </Badge>
                          <span className="flex-1 truncate font-medium">{sp.name}</span>
                          <span className="text-muted-foreground">{parseFloat(sp.price).toLocaleString()} د.ل</span>
                          <button
                            onClick={() => handleRemoveSaved(idx)}
                            className="text-destructive hover:text-destructive/80 p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="w-full mb-4">
                    <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
                  </div>

                  {/* Step content */}
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                      key={`step-${currentStep}`}
                      custom={direction}
                      variants={stepVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={stepTransition}
                      className="w-full min-h-[200px] flex flex-col"
                    >
                      <h2 className="text-lg font-semibold text-foreground text-center mb-4">
                        {STEP_LABELS[currentStep - 1]}
                      </h2>

                      <div className="w-full flex-1">
                        {renderStep()}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <motion.div layout className="flex gap-3 mt-6 w-full">
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
                        disabled={!canProceed() || isSubmitting || uploadingImage}
                        className="w-full gap-2 hover:scale-[1.02] transition-transform"
                      >
                         {uploadingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جاري الرفع...
                            </>
                          ) : currentStep === TOTAL_STEPS ? (
                            <>
                              <Plus className="w-4 h-4" />
                              🎯 إضافة المنتج
                            </>
                          ) : (
                            <>
                              التالي
                              <ArrowLeft className="w-4 h-4" />
                            </>
                          )}
                      </Button>
                    </motion.div>
                  </motion.div>

                  {/* Finish / Add Another */}
                  {savedProducts.length > 0 && (
                    <div className="flex gap-2 mt-4 w-full">
                      <Button
                        onClick={handleFinish}
                        disabled={isSubmitting}
                        className="flex-1"
                        variant="default"
                      >
                         {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin ml-2" />
                              جاري الحفظ...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 ml-2" />
                              🚀 بدء الاستخدام ({savedProducts.length} منتج)
                            </>
                          )}
                      </Button>
                    </div>
                  )}
                </div>
               </Card>
               
               {!showWelcome && (
                 <div className="text-center mt-4">
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => signOut()}
                     className="text-muted-foreground hover:text-foreground"
                   >
                     <LogOut className="w-4 h-4 ml-2" />
                     تسجيل الخروج
                   </Button>
                 </div>
               )}
             </motion.div>
           )}
         </AnimatePresence>
       </LayoutGroup>
     </div>
  );
}
