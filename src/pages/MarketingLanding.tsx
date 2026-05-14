import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, X, Loader2 } from 'lucide-react';
import { facebookPixel } from '@/services/analyticsService';

// Wistia global types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wistia-player': any;
    }
  }
  interface Window {
    wistiaLoaded?: boolean;
    fbq?: any;
  }
}

export default function MarketingLanding() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState({
    price: '',
    quantity: '',
    budget: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    // Load Wistia script
    if (!window.wistiaLoaded) {
      window.wistiaLoaded = true;
      const s1 = document.createElement('script');
      s1.src = 'https://fast.wistia.com/player.js';
      s1.async = true;
      const s2 = document.createElement('script');
      s2.src = 'https://fast.wistia.com/embed/fqsot50ggc.js';
      s2.async = true;
      s2.type = 'module';
      document.body.appendChild(s1);
      document.body.appendChild(s2);
    }
  }, []);

  const openModal = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
    facebookPixel.track('InitiateCheckout');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    document.body.style.overflow = '';
  };

  const handleAnswer = (question: 'price' | 'quantity' | 'budget', value: string) => {
    if (value === 'disqualify') {
      facebookPixel.track('Lead', {
        content_name: `Disqualified Lead - Q${currentStep}`,
        content_category: 'Disqualified'
      });
      // Assuming disqualified page is just an external HTML in public or handled via a route
      window.location.href = '/disqualified.html';
      return;
    }

    setAnswers(prev => ({ ...prev, [question]: value }));

    setTimeout(() => {
      if (currentStep < 3) {
        setCurrentStep(prev => prev + 1);
      }
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answers.price || !answers.quantity || !answers.budget) return;

    if (answers.price === 'disqualify' || answers.quantity === 'disqualify' || answers.budget === 'disqualify') {
      window.location.href = '/disqualified.html';
      return;
    }

    setIsSubmitting(true);
    facebookPixel.track('Lead', { content_name: 'Qualified Lead', content_category: 'Booking' });

    setTimeout(() => {
      setIsSubmitting(false);
      closeModal();
      setShowCalendar(true);
      setTimeout(() => {
        document.getElementById('calendar-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, 600);
  };

  return (
    <div className="bg-brand-dark text-white min-h-screen antialiased flex flex-col items-center overflow-x-hidden w-full relative">
      <style>{`
        .premium-blur {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(10, 23, 40, .75);
        }
        .step-circle {
          transition: all .4s ease;
        }
        .progress-step.active .step-circle {
          background: #39c8ff;
          color: #02060d;
          box-shadow: 0 0 20px rgba(57, 200, 255, .4);
        }
        .progress-step.completed .step-circle {
          background: #169fd7;
          color: #fff;
        }
        .answer-card {
          transition: all .3s ease;
          cursor: pointer;
          position: relative;
        }
        .answer-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(57, 200, 255, .15);
        }
        .answer-card.selected {
          border-color: #39c8ff;
          background: rgba(57, 200, 255, .1);
        }
        .answer-checkmark {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 24px;
          height: 24px;
          background: #39c8ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(.5);
          transition: all 0.3s ease;
        }
        .answer-card.selected .answer-checkmark {
          opacity: 1;
          transform: scale(1);
        }
        .modal-overlay {
          background: rgba(0, 0, 0, .7);
          backdrop-filter: blur(4px);
        }
      `}</style>

      {/* Decorative Glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-cyan opacity-[0.05] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-accent opacity-[0.05] rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="w-full max-w-[1024px] px-4 sm:px-6 py-6 flex justify-between items-center animate-fade-in-up">
        <div className="flex items-center gap-2">
          <img src="/assets/logo.webp" alt="سوكتيف شعار" className="w-10 h-10 object-contain" />
          <span className="font-bold text-xl tracking-tight text-white">سوكتيف</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[1024px] px-4 sm:px-6 py-4 flex flex-col items-center relative gap-8 flex-1">
        
        <section className="text-center opacity-0 animate-fade-in-up" style={{ marginTop: '40px', animationFillMode: 'forwards' }}>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[1.3] md:leading-[1.2] mb-5 text-white">
            كيف تقدر <span className="text-brand-cyan">تزيد مبيعات</span> متجرك الإلكتروني
          </h1>
          <p className="text-brand-gray text-lg md:text-xl leading-relaxed font-medium max-w-2xl mx-auto">
            نبني لك نظام مبيعات متكامل يزيد أرباحك وينمي متجرك. شاهد الفيديو واكتشف كيف نعمل.
          </p>
        </section>

        <section className="relative w-full max-w-3xl opacity-0 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-cyan to-brand-accent rounded-2xl blur-xl opacity-30 hover:opacity-50 transition duration-500"></div>
          <div className="relative w-full bg-brand-dark rounded-2xl overflow-hidden border border-white/10 shadow-2xl" style={{ aspectRatio: '16/9', width: '100%', height: 'auto' }}>
             {/* Wistia player element will be initialized by script */}
             <wistia-player media-id="fqsot50ggc" aspect="1.7777777777777777" style={{ width: '100%', height: '100%' }}></wistia-player>
          </div>
        </section>

        <section className="w-full flex flex-col items-center opacity-0 animate-fade-in-up" style={{ animationDelay: '400ms', marginTop: '20px', animationFillMode: 'forwards' }}>
          <button onClick={openModal} className="group bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold text-xl md:text-2xl py-5 px-12 rounded-2xl shadow-glow-cyan transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3">
            <span>احجز اجتماع أونلاين</span>
            <ChevronRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </section>

        <section className="w-full max-w-3xl opacity-0 animate-fade-in-up mb-12" style={{ animationDelay: '600ms', marginTop: '40px', animationFillMode: 'forwards' }}>
          <div className="premium-blur border border-white/10 rounded-3xl p-8 shadow-inner">
            <h2 className="text-2xl font-bold mb-8 text-white relative flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-cyan rounded-full"></span>
              ماذا تحصل؟
            </h2>

            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <Check className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-1">إدارة تسويقية متكاملة</h3>
                  <p className="text-brand-gray leading-relaxed text-sm">
                    نتولى صناعة المحتوى الإعلاني بالكامل لجذب فئتك المستهدفة، مما يعفيك من تعقيدات التسويق.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <Check className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-1">أتمتة عملية البيع</h3>
                  <p className="text-brand-gray leading-relaxed text-sm">
                    صفحة هبوط تتولى الرد على العملاء وتصفيتهم، لتستلم طلبات جاهزة دون الغرق في الرسائل.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <Check className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-1">تأكيد الطلبات</h3>
                  <p className="text-brand-gray leading-relaxed text-sm">
                    فريق مختص يتواصل هاتفياً لتأكيد جدية الطلبات قبل الشحن، مما يقلل الهدر المالي.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay">
          <div className="w-full max-w-2xl bg-[#0a1728] border border-white/10 rounded-3xl shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-[#0a1728] border-b border-white/10 px-8 py-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-8 bg-brand-cyan rounded-full"></span>
                  <h2 className="text-2xl font-bold text-white">احجز مكالمة استشارة</h2>
                </div>
                <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors p-2">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  {[1, 2, 3].map((step) => (
                    <React.Fragment key={step}>
                      <div className={`progress-step ${currentStep === step ? 'active' : currentStep > step ? 'completed' : ''}`}>
                        <div className={`step-circle w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${currentStep === step ? 'bg-brand-cyan text-brand-darker' : currentStep > step ? 'bg-brand-accent text-white' : 'bg-white/20 text-white/60'}`}>
                          {step}
                        </div>
                      </div>
                      {step < 3 && (
                        <div className="flex-1 h-1 bg-white/20 rounded max-w-[100px]">
                          <div className="h-full bg-brand-cyan rounded transition-all duration-500" style={{ width: currentStep > step ? '100%' : '0%' }}></div>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-center text-brand-gray text-sm">السؤال <span className="current-step font-bold text-brand-cyan">{currentStep}</span> من 3 أسئلة</p>
              </div>
            </div>

            <div className="px-8 py-6">
              <p className="text-brand-gray mb-8 text-sm">أجب على الأسئلة التالية لنحدد ما إذا كانت خدماتنا تناسب احتياجاتكم</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {currentStep === 1 && (
                  <div className="question-block animate-fade-in-up">
                    <h3 className="text-lg font-bold text-white mb-4">1. ما هو متوسط سعر القطعة في متجرك؟</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { value: 'disqualify', label: 'أقل من 150 د.ل' },
                        { value: '150-200', label: '150 - 200 د.ل' },
                        { value: '200-500', label: '200 - 500 د.ل' },
                        { value: '500+', label: '500 د.ل فأكثر' },
                      ].map((opt) => (
                        <div key={opt.value} onClick={() => handleAnswer('price', opt.value)} className={`answer-card p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${answers.price === opt.value ? 'selected' : ''}`}>
                          <div className="answer-checkmark"><Check className="h-4 w-4 text-brand-darker" /></div>
                          <div className="text-center"><span className="text-white font-medium text-lg">{opt.label}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="question-block animate-fade-in-up">
                    <h3 className="text-lg font-bold text-white mb-4">2. كم عدد القطع المتاحة في مخزونك؟</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { value: 'disqualify', label: 'أقل من 150 قطعة' },
                        { value: '150-200', label: '150 - 200 قطعة' },
                        { value: '200-500', label: '200 - 500 قطعة' },
                        { value: '500+', label: '500 قطعة فأكثر' },
                      ].map((opt) => (
                        <div key={opt.value} onClick={() => handleAnswer('quantity', opt.value)} className={`answer-card p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${answers.quantity === opt.value ? 'selected' : ''}`}>
                          <div className="answer-checkmark"><Check className="h-4 w-4 text-brand-darker" /></div>
                          <div className="text-center"><span className="text-white font-medium text-lg">{opt.label}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="question-block animate-fade-in-up">
                    <h3 className="text-lg font-bold text-white mb-4">3. هل يمكنك تخصيص ميزانية 150 دولار شهرياً للإعلانات الممولة؟</h3>
                    <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
                      <div onClick={() => handleAnswer('budget', 'yes')} className={`answer-card p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${answers.budget === 'yes' ? 'selected' : ''}`}>
                        <div className="answer-checkmark"><Check className="h-4 w-4 text-brand-darker" /></div>
                        <div className="text-center"><span className="text-white font-medium text-lg">نعم، أملك الميزانية للإعلانات</span></div>
                      </div>
                      <div onClick={() => handleAnswer('budget', 'disqualify')} className={`answer-card p-5 rounded-xl border border-red-400/30 bg-red-400/5 hover:bg-red-400/10 transition-all ${answers.budget === 'disqualify' ? 'selected' : ''}`}>
                        <div className="answer-checkmark"><Check className="h-4 w-4 text-brand-darker" /></div>
                        <div className="text-center"><span className="text-white font-medium text-lg">لا، حالياً لا أملك الميزانية</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && answers.budget && !isSubmitting && (
                  <div className="animate-fade-in-up mt-6">
                    <button type="submit" className="w-full bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold text-xl py-4 px-8 rounded-2xl shadow-glow-cyan transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3">
                      <span>عرض المواعيد المتاحة</span>
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>
                )}

                {isSubmitting && (
                  <div className="text-center py-8">
                    <Loader2 className="w-10 h-10 text-brand-cyan animate-spin mx-auto" />
                    <p className="mt-4 text-brand-gray">جاري التحميل...</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Section */}
      {showCalendar && (
        <section id="calendar-section" className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in-up">
          <div className="premium-blur border border-white/10 rounded-3xl p-6 shadow-inner">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-brand-cyan rounded-full"></span>
                احجز موعدك الآن
              </h2>
              <button onClick={() => setShowCalendar(false)} className="text-white/60 hover:text-white transition-colors p-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="w-full rounded-2xl overflow-hidden border border-white/10" style={{ height: '700px' }}>
              <iframe
                src="https://soctivcrm.netlify.app/book/de5f1af4-7913-4c52-9b83-c9bdac5d3162?embed=true"
                className="w-full h-full border-0"
                title="Booking Calendar"
                onLoad={() => setIframeLoaded(true)}
              />
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-brand-dark/50">
                  <Loader2 className="w-8 h-8 text-brand-cyan animate-spin" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="w-full py-8 text-center text-brand-gray/50 text-xs border-t border-white/5 mt-auto">
        &copy; {new Date().getFullYear()} سوكتيف. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}
