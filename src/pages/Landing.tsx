import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Type declaration for Wistia player custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wistia-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'media-id'?: string;
        'aspect'?: string;
        'poster'?: string;
      }, HTMLElement>;
    }
  }
}

const Landing = () => {
  const navigate = useNavigate();
  const { user, isApproved, onboardingCompleted, loading } = useAuth();

  // Redirect authenticated users appropriately
  if (user && !loading) {
    if (isApproved) {
      if (onboardingCompleted) {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/product-onboarding" replace />;
      }
    } else {
      return <Navigate to="/pending-approval" replace />;
    }
  }

  return (
    <div className="bg-brand-dark text-white min-h-screen flex flex-col items-center overflow-x-hidden w-full" style={{
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility'
    }}>
      {/* Decorative Glows */}
     <div 
       className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-cyan opacity-[0.05] rounded-full blur-[120px] pointer-events-none"
       style={{ willChange: 'auto', contain: 'strict', contentVisibility: 'auto' }}
     ></div>
     <div 
       className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-accent opacity-[0.05] rounded-full blur-[120px] pointer-events-none"
       style={{ willChange: 'auto', contain: 'strict', contentVisibility: 'auto' }}
     ></div>

      {/* Header Section */}
      <header className="w-full max-w-[450px] md:max-w-[650px] lg:max-w-[800px] px-4 sm:px-6 py-6 flex justify-between items-center opacity-0 animate-fade-in-up">
         <div className="flex items-center gap-2">
            <img 
              src="/Soctiv Logo.webp" 
              alt="سوكتيف شعار" 
              className="w-10 h-10 object-contain"
              width={40}
              height={40}
              fetchPriority="high"
              loading="eager"
            />
           <span className="font-bold text-xl tracking-tight text-white">سوكتيف</span>
         </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/auth?mode=signin')}
            className="px-4 py-2 text-white hover:text-brand-cyan transition-colors font-medium"
          >
            تسجيل الدخول
          </button>
          <button 
            onClick={() => navigate('/auth?mode=signup')}
            className="px-5 py-2 bg-brand-cyan hover:bg-brand-cyan-light text-brand-darker font-bold rounded-lg transition-all"
          >
            ابدأ
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-[450px] md:max-w-[650px] lg:max-w-[800px] px-4 sm:px-6 py-4 flex flex-col items-center relative gap-8">
        
        {/* Hero Section */}
        <section className="text-center opacity-0 animate-fade-in-up animation-delay-200">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.5] mb-5 text-white max-w-[600px] lg:max-w-[800px] mx-auto tracking-normal" style={{ wordSpacing: '0.2em' }}>
            كيف تقدر <span className="text-brand-cyan">تزيد مبيعات</span> متجرك الالكتروني
          </h1>
          <p className="text-brand-gray text-lg md:text-xl leading-relaxed font-medium max-w-[550px] mx-auto tracking-tight">
            تفرج الفيديو لوطة باش تعرف كيف حنبنو سستم مبيعات لمتجرك الالتروني
          </p>
        </section>

        {/* Video Section */}
         <section className="relative w-full opacity-0 animate-fade-in-up animation-delay-400 group">
           {/* Glow behind video */}
           <div className="absolute -inset-1 bg-gradient-to-r from-brand-cyan to-brand-accent rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition duration-500"></div>
           
           <div className="relative w-full bg-brand-dark rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video">
            <wistia-player 
              media-id="fqsot50ggc" 
              aspect="1.7777777777777777" 
              className="w-full h-full"
              poster="https://embed-ssl.wistia.com/deliveries/dff7db668c38f9c01677486050d6e00192c01e66.webp?image_crop_resized=960x540"
              player-color="00bcd4"
              play-button="true"
              fetchpriority="high"
            ></wistia-player>
           </div>
         </section>

        {/* CTA Section */}
        <section className="w-full flex flex-col items-center opacity-0 animate-fade-in-up animation-delay-600">
          <button 
            onClick={() => navigate('/auth')}
            className="w-full max-w-[320px] md:max-w-[400px] bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold text-xl md:text-2xl py-4 md:py-5 px-8 rounded-2xl shadow-glow-cyan transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
          >
            <span>اطلب سستم المبيعات الآن</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <p className="mt-4 text-brand-gray text-sm md:text-base font-medium">مبيعات تزيد يومياً، رسائل تقل</p>
        </section>

         {/* Features Section */}
         <section 
           className="w-full opacity-0 animate-fade-in-up animation-delay-600 mb-12"
         >
          <div className="w-full premium-blur border border-white/10 rounded-3xl p-6 md:p-8 lg:p-10 shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white relative flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-cyan rounded-full"></span>
              ماذا تحصل؟
            </h2>
            
            <ul className="space-y-6 md:space-y-8">
              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg md:text-xl mb-1">إدارة تسويقية متكاملة</h3>
                  <p className="text-brand-gray leading-relaxed md:text-lg">
                    نتولى صناعة المحتوى الإعلاني بالكامل لجذب فئتك المستهدفة، مما يعفيك من تعقيدات التسويق ويضمن لك تدفق العملاء.
                  </p>
                </div>
              </li>
              
              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg md:text-xl mb-1">أتمتة عملية البيع</h3>
                  <p className="text-brand-gray leading-relaxed md:text-lg">
                    توفير صفحة هبوط تتولى الرد على استفسارات العملاء وتصفيتهم، لتستلم طلبات جاهزة ببيانات كاملة دون الغرق في رسائل "المسنجر" غير الجادة.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg md:text-xl mb-1">تأكيد الطلبات</h3>
                  <p className="text-brand-gray leading-relaxed md:text-lg">
                    فريق مختص يتواصل هاتفياً مع العملاء لتأكيد جديته قبل الشحن، مما يقلل من نسب الهدر المالي والطلبات الوهمية.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

      </main>

      {/* Cookie Consent Notice */}
      <div className="w-full max-w-[700px] px-4 py-4 text-center text-brand-gray/60 text-xs">
        باستخدامك للموقع ومشاهدة المحتوى، أنت توافق على استخدام ملفات تعريف الارتباط لتخصيص تجربتك الإعلانية.
      </div>

      <footer className="w-full py-8 text-center text-brand-gray/50 text-xs border-t border-white/5 mt-auto">
        <div className="flex flex-col items-center gap-2">
          <p>&copy; 2026 سوكتيف. جميع الحقوق محفوظة.</p>
          <a 
            href="/privacy-policy" 
            className="text-brand-gray/70 hover:text-brand-cyan transition-colors"
          >
            سياسة الخصوصية
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;