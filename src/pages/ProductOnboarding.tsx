import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Package, Plus, Trash2, Upload, X, Image as ImageIcon, Check, LogOut, Sparkles, RotateCcw, Edit3 } from 'lucide-react';
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
import { ProductOnboarding as AiProductOnboarding } from '@/components/productDna/ProductOnboarding';
import { enhanceDescriptionWithAnswers } from '@/lib/enhanceDescription';
import type { OnboardingData } from '@/types/productDNA';

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

// ─── Small visual helpers ───────────────────────────────────────────────

function descriptionRichness(len: number) {
  if (len === 0) return { label: 'فارغ', color: 'text-muted-foreground', bar: 'bg-muted', pct: 0 };
  if (len < 40) return { label: 'مختصر', color: 'text-orange-600', bar: 'bg-orange-400', pct: 33 };
  if (len < 120) return { label: 'جيد', color: 'text-blue-600', bar: 'bg-blue-500', pct: 66 };
  return { label: 'ممتاز', color: 'text-green-600', bar: 'bg-green-500', pct: 100 };
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

  // AI enhancement phase state. When `aiActive` is true, the AI questions
  // wizard is shown in place of the regular form steps for the *current*
  // product. Each new product gets its own AI round.
  const [aiActive, setAiActive] = useState(false);
  const [aiOnboarding, setAiOnboarding] = useState<OnboardingData | null>(null);

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
    if (typeof draft.aiActive === 'boolean') setAiActive(draft.aiActive);
    if (draft.aiOnboarding && typeof draft.aiOnboarding === 'object') {
      setAiOnboarding(draft.aiOnboarding as OnboardingData);
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
      aiActive,
      aiOnboarding,
    }));
  }, [storageKey, savedProducts, showWelcome, currentStep, product, aiActive, aiOnboarding]);

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
    if (isSubmitting || uploadingImage) return;
    setDirection(1);
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Final step. The AI enhancement wizard is only useful when the user
      // has a description to enhance — if they skipped the description field,
      // skip the AI flow entirely and save directly so the user is never
      // stuck on an indefinite loading spinner.
      if (!product.description.trim()) {
        handleSaveProduct();
        return;
      }
      setAiActive(true);
      setAiOnboarding(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleNext();
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
    // Guard against partially-loaded drafts or undefined fields. Every field
    // falls back to a safe default so the insert can't fail on missing keys.
    const imageUrl = product.uploadedImageUrl || null;
    const trimmedName = (product.name ?? '').trim();
    const trimmedPrice = (product.price ?? '').trim();
    const trimmedDescription = (product.description ?? '').trim();
    const trimmedOffer = (product.offer ?? '').trim();
    const safeReturnRate =
      typeof product.returnRate === 'number' && Number.isFinite(product.returnRate)
        ? product.returnRate
        : 25;

    if (!trimmedName) {
      toast.error('اسم المنتج مطلوب');
      return;
    }
    if (!trimmedPrice || Number.isNaN(parseFloat(trimmedPrice))) {
      toast.error('السعر مطلوب');
      return;
    }

    const saved: SavedProduct = {
      name: trimmedName,
      description: trimmedDescription,
      price: trimmedPrice,
      returnRate: safeReturnRate,
      offer: trimmedOffer,
      imageUrl,
    };

    setSavedProducts((prev) => [...prev, saved]);
    setProduct({ ...DEFAULT_PRODUCT });
    setCurrentStep(1);
    setDirection(1);
    setAiActive(false);
    setAiOnboarding(null);
    toast.success(`✅ تمت إضافة "${saved.name}" بنجاح! يمكنك إضافة منتج آخر أو النهاء مباشرة.`);
  };

  // ─── AI enhancement phase handlers ──────────────────────────────────

  const handleAiComplete = (onboarding: OnboardingData) => {
    // Enhance the product description with the answers, then commit.
    const enhanced = enhanceDescriptionWithAnswers({
      originalDescription: product.description,
      answers: onboarding.answers,
    });
    setProduct((prev) => ({ ...prev, description: enhanced }));
    setAiOnboarding(onboarding);
  };

  const handleAiCommit = () => {
    // Commit the product with the (possibly enhanced) description.
    handleSaveProduct();
  };

  const handleAiSkip = () => {
    // Save the product as-is (no enhancement) and close the AI phase.
    setAiActive(false);
    setAiOnboarding(null);
    handleSaveProduct();
  };

  const handleAiReanswer = () => {
    // Clear the in-memory onboarding and re-open the AI wizard.
    setAiOnboarding(null);
  };

  const handleAiEditDescription = () => {
    // Close the AI phase and send the user back to the description step so
    // they can tweak the enhanced text before committing.
    setAiActive(false);
    setAiOnboarding(null);
    setCurrentStep(2);
    setDirection(-1);
  };

  const handleRemoveSaved = (index: number) => {
    setSavedProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    console.log('[ProductOnboarding] handleFinish: clicked', {
      savedProductsCount: savedProducts.length,
      hasUser: !!user,
      hasClient: !!client,
      clientId: client?.id,
      profileApproval: profile?.approval_status,
    });

    if (savedProducts.length === 0) {
      toast.error('يجب إضافة منتج واحد على الأقل');
      return;
    }

    if (!user) {
      toast.error('تعذر تحميل بيانات الحساب. يرجى إعادة تسجيل الدخول.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Resolve clientId. Prefer the in-memory client from useAuth (fast path).
      // If it's missing (stale context, first paint, slow bootstrap), fall back
      // to a direct DB lookup using maybeSingle() so an empty result doesn't
      // throw and silently kill the flow.
      let clientId = client?.id ?? null;

      if (!clientId && user?.id) {
        const { data: clientData, error: clientErr } = await (supabase as any)
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (clientErr) {
          console.warn('[ProductOnboarding] clients lookup error:', clientErr);
          throw new Error(clientErr.message || 'تعذر العثور على حساب العميل');
        }
        if (clientData?.id) {
          clientId = clientData.id;
        }
      }

      if (!clientId) {
        console.error('[ProductOnboarding] handleFinish: no clientId after lookup');
        toast.error('تعذر العثور على حساب العميل. يرجى إعادة تسجيل الدخول.');
        return;
      }

      // 1) Insert products. We use the SECURITY DEFINER RPC
      // `create_product_with_dna` instead of a direct table insert because
      // the live DB has an AFTER INSERT trigger on `products` that writes
      // a stub row into `product_dna`. That trigger runs in a context where
      // `auth.uid()` may not be set, so the standard RLS policy on
      // `product_dna` (`client_id = public.get_user_client_id(auth.uid())`)
      // was rejecting the trigger's insert and rolling back the products
      // insert with a 42501 RLS error.
      //
      // The RPC does an explicit ownership check on the calling user, then
      // performs both inserts in a single transaction with the function
      // owner's privileges, sidestepping the RLS issue entirely.
      for (const p of savedProducts) {
        const { data: productId, error: insertErr } = await supabase.rpc(
          'create_product_with_dna',
          {
            p_name: p.name,
            p_description: p.description || null,
            p_price: parseFloat(p.price) || 0,
            p_return_rate: p.returnRate || null,
            p_offer: p.offer || null,
            p_image_url: p.imageUrl,
            p_client_id: clientId,
          }
        );
        if (insertErr) {
          console.error('[ProductOnboarding] create_product_with_dna error:', insertErr);
          throw new Error(insertErr.message || 'فشل حفظ المنتجات');
        }
        if (!productId) {
          throw new Error('فشل حفظ المنتجات: لم يتم إرجاع معرف المنتج');
        }
      }

      // 2) Mark onboarding complete. The DB trigger
      // `on_onboarding_completed_submit_approval` fires on this update and
      // submits an approval request, so we don't need to call the RPC here.
      const { error: updateErr } = await supabase
        .from('clients')
        .update({ onboarding_completed: true } as any)
        .eq('id', clientId as any);
      if (updateErr) {
        console.error('[ProductOnboarding] clients.update error:', updateErr);
        throw new Error(updateErr.message || 'تعذر تحديث حالة الإعداد');
      }

      if (storageKey) {
        // Don't let a broken localStorage block the success path — products
        // are already saved in the DB, so cleanup is best-effort.
        try {
          safeLocalRemove(storageKey);
        } catch (storageErr) {
          console.warn('[ProductOnboarding] safeLocalRemove failed:', storageErr);
        }
      }

      // 3) Refresh user data so the next route guard sees onboardingCompleted=true.
      // The route guard checks `client.onboarding_completed`; if refresh fails,
      // we still want the user to land on the pending-approval page so they
      // see progress, not get redirected back here in a loop.
      try {
        await refreshUserData({ force: true, mode: 'blocking', reason: 'product-onboarding-submit' });
      } catch (refreshErr) {
        console.warn('[ProductOnboarding] refreshUserData failed (continuing):', refreshErr);
      }

      toast.success('تم حفظ المنتجات بنجاح!');

      // Track SubmitApplication event in Facebook Pixel
      facebookPixel.track('SubmitApplication');

      // After product onboarding, go to pending approval page, NOT dashboard
      navigate('/pending-approval');
    } catch (error) {
      console.error('[ProductOnboarding] Error saving products:', error);
      toast.error(toArabicErrorMessage(error, 'حدث خطأ في حفظ المنتجات'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-3 w-full">
            <div>
              <Label className="text-sm font-medium block mb-1">اسم المنتج</Label>
              <p className="text-xs text-muted-foreground mb-3">
                اختر اسماً واضحاً يصف منتجك بحيث يفهمه الزبون فوراً.
              </p>
            </div>
            <Input
              value={product.name}
              onChange={(e) => updateProduct('name', e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="مثال: ساعة ذكية"
              className="text-right text-lg"
              autoFocus
            />
          </div>
        );
      case 2: {
        const descLen = product.description.trim().length;
        const richness =
          descLen === 0
            ? { label: 'فارغ', color: 'text-muted-foreground', bar: 'bg-muted', pct: 0 }
            : descLen < 40
              ? { label: 'مختصر', color: 'text-orange-600', bar: 'bg-orange-400', pct: 33 }
              : descLen < 120
                ? { label: 'جيد', color: 'text-blue-600', bar: 'bg-blue-500', pct: 66 }
                : { label: 'ممتاز', color: 'text-green-600', bar: 'bg-green-500', pct: 100 };
        return (
          <div className="space-y-3 w-full">
            <div>
              <Label className="text-sm font-medium block mb-1">وصف المنتج</Label>
              <p className="text-xs text-muted-foreground mb-3">
                صف ما هو المنتج، ماذا يفعل، ومن يستخدمه. كلما زاد الوصف، كلما فهمنا منتجك اكتر.
              </p>
            </div>
            <textarea
              value={product.description}
              onChange={(e) => updateProduct('description', e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="مثال: كريم ترطيب للوجه يحتوي على فيتامين سي وحمض الهيالورونيك، يرطب البشرة ويقلل التجاعيد…"
              className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-right text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              autoFocus
            />
            {/* Richness meter */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${richness.bar}`}
                  style={{ width: `${richness.pct}%` }}
                />
              </div>
              <span className={`text-[11px] font-medium ${richness.color}`}>
                {richness.label}
              </span>
            </div>
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
      }
      case 3:
        return (
          <div className="space-y-4 w-full">
            <div>
              <Label className="text-sm font-medium block mb-1">صورة المنتج</Label>
              <p className="text-xs text-muted-foreground mb-3">
                صورة واضحة تساعد في جذب الزبائن. اختيارية.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {product.imagePreview ? (
                <div className="relative w-36 h-36 rounded-xl overflow-hidden border-2 border-border">
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-36 h-36 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <Upload className="h-7 w-7 text-muted-foreground/50" />
                  <span className="text-[11px] text-muted-foreground">اضغط للرفع</span>
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
      case 4: {
        const quickPrices = [150, 200, 300, 500, 1000];
        return (
          <div className="space-y-4 w-full">
            <div>
              <Label className="text-sm font-medium block mb-1">السعر</Label>
              <p className="text-xs text-muted-foreground mb-3">
                السعر بعملة الدينار الليبي (د.ل).
              </p>
            </div>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={product.price}
                onChange={(e) => updateProduct('price', e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="0.00"
                className="text-right text-2xl text-center pr-16 h-14"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                د.ل
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground text-center">اختصارات سريعة</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {quickPrices.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => updateProduct('price', String(q))}
                    className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {q} د.ل
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 5:
        return (
          <div className="space-y-3 w-full">
            <div>
              <Label className="text-sm font-medium block mb-1">العرض (اختياري)</Label>
              <p className="text-xs text-muted-foreground mb-3">
                عرض خاص يجذب الزبون للطلب الآن. مثل: خصم، شحن مجاني، هدية مع الطلب.
              </p>
            </div>
            <Input
              value={product.offer}
              onChange={(e) => updateProduct('offer', e.target.value)}
              onKeyDown={handleInputKeyDown}
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
          {aiActive ? (
            <motion.div
              key="ai"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={springTransition}
              className="w-full max-w-2xl"
            >
              <Card className="p-6 shadow-xl overflow-hidden">
                <div className="flex flex-col items-center w-full">
                  <motion.img
                    layoutId="logo"
                    src={soctivLogo}
                    alt="Soctiv"
                    className="w-14 h-14 object-contain shadow-lg mb-4"
                    transition={springTransition}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  {/* Product summary */}
                  <div className="w-full mb-4 rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">المنتج:</span>
                      <span className="text-sm font-semibold text-foreground truncate">{product.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">السعر:</span>
                      <span className="text-sm font-medium text-foreground">
                        {parseFloat(product.price || '0').toLocaleString()} د.ل
                      </span>
                    </div>
                    {product.imagePreview && (
                      <div className="flex items-center gap-2 mt-1">
                        <img
                          src={product.imagePreview}
                          alt="preview"
                          className="w-10 h-10 rounded-md object-cover border"
                        />
                        {product.uploadedImageUrl && !uploadingImage && (
                          <span className="text-[10px] text-green-600 font-medium">✓ تم الرفع</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Two sub-states: answering (wizard visible) or committed (review/continue) */}
                  {!aiOnboarding ? (
                    <>
                      <div className="w-full mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>تحسين ذكي للوصف</span>
                      </div>

                      {/* Explainer removed per feedback */}

                      <div className="w-full">
                        <AiProductOnboarding
                          key={`ai-${savedProducts.length}`}
                          initialDescription={product.description}
                          productName={product.name}
                          autoCommit
                          minDescriptionLength={1}
                          onComplete={handleAiComplete}
                          onSkip={handleAiSkip}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-full space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span>الوصف المحسّن جاهز</span>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            الوصف الجديد
                          </h4>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {product.description}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            الإجابات ({aiOnboarding.answers.length})
                          </h4>
                          {aiOnboarding.questions.map((q, i) => {
                            const answer = aiOnboarding.answers.find((a) => a.questionId === q.id);
                            const displayText = answer?.customText?.trim() || answer?.selectedLabel;
                            return (
                              <div
                                key={q.id}
                                className="bg-card border border-border rounded-lg p-3 text-sm"
                              >
                                <p className="text-xs text-muted-foreground mb-1">{q.question}</p>
                                <p className="text-sm font-medium text-foreground">
                                  {displayText || <span className="text-muted-foreground italic">لم تتم الإجابة</span>}
                                </p>
                                {answer?.customText?.trim() ? (
                                  <span className="inline-block mt-1.5 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    إجابة مخصّصة
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <Button
                            onClick={handleAiCommit}
                            className="flex-1 gap-2"
                          >
                            <Check className="w-4 h-4" />
                            حفظ المنتج ({savedProducts.length + 1})
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleAiEditDescription}
                            className="gap-2"
                          >
                            <Edit3 className="w-4 h-4" />
                            تعديل الوصف
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={handleAiReanswer}
                            className="gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            إعادة الإجابة
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>

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
            </motion.div>
          ) : showWelcome ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center gap-7 w-full max-w-lg"
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
                <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2">
                  <Package className="w-7 h-7 text-primary" />
                  أضف منتجاتك
                </h1>
                <p className="text-muted-foreground text-lg">
                  خطوة واحدة لتبدأ بإدارة طلباتك ومبيعاتك
                </p>
              </motion.div>

              {/* Value props removed per feedback */}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ...springTransition }}
                className="flex flex-col gap-3 items-center w-full"
              >
                <Button
                  onClick={() => setShowWelcome(false)}
                  size="lg"
                  className="px-12 py-6 text-lg rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 w-full sm:w-auto"
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground text-right font-medium">
                          المنتجات المضافة ({savedProducts.length})
                        </p>
                        {savedProducts.length > 0 && (
                          <span className="text-[10px] text-green-600 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            جاهزة للحفظ
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                        {savedProducts.map((sp, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 border border-border/60 text-sm"
                          >
                            {sp.imageUrl ? (
                              <img
                                src={sp.imageUrl}
                                alt={sp.name}
                                className="w-9 h-9 rounded-md object-cover border shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate text-[13px]">{sp.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {parseFloat(sp.price || '0').toLocaleString()} د.ل
                                {sp.offer ? ' • ' + sp.offer : ''}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveSaved(idx)}
                              className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                              aria-label={`حذف ${sp.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
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

                  {/* Finish / Add Another (duplicate button removed; kept outside-card version below) */}
                </div>
              </Card>

              {/* Prominent, always-visible "Start Using" button outside the card so it can't be clipped by overflow-hidden. */}
              {savedProducts.length > 0 && !aiActive && !showWelcome && (
                <div className="w-full max-w-lg mt-2 mb-4">
                  <Button
                    type="button"
                    onClick={handleFinish}
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-2xl text-base font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all relative z-10 pointer-events-auto cursor-pointer"
                    variant="default"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 ml-2" />
                        🚀 بدء الاستخدام ({savedProducts.length} منتج)
                      </>
                    )}
                  </Button>
                </div>
              )}

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
