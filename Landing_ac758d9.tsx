import { useState, useCallback, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Settings2, Phone, ChevronRight, Play } from "lucide-react";

// Preconnect to Wistia CDN domains on hover for instant playback
const wistiaHints = [
  'https://fast.wistia.net',
  'https://fast.wistia.com',
  'https://embedwistia-a.akamaihd.net',
];
let wistiaPreconnected = false;
function preconnectWistia() {
  if (wistiaPreconnected) return;
  wistiaPreconnected = true;
  wistiaHints.forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// Type declaration for Wistia player custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'wistia-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'media-id'?: string;
        'aspect'?: string;
        'poster'?: string;
        'fetchpriority'?: string;
        'player-color'?: string;
        'play-button'?: string;
        'autoplay'?: string | boolean;
      }, HTMLElement>;
    }
  }
}

const Landing = () => {
  const navigate = useNavigate();
  const { user, isApproved, onboardingCompleted, loading, authRoutingReady } = useAuth();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const handleVideoHover = useCallback(() => {
    preconnectWistia();
  }, []);


  // Show loader while auth state is being determined
  if (loading || (user && !authRoutingReady)) {
    return <div className="min-h-screen bg-background flex items-center justify-center"></div>;
  }

  // Redirect authenticated users appropriately
  if (user && authRoutingReady) {
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

  const handleVideoClick = () => {
    setIsVideoPlaying(true);
  };

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
          <picture>
            <source srcSet="/Soctiv-Logo-80.webp" type="image/webp" />
            <img
              src="/Soctiv-Logo-80.webp"
              alt="╪│┘ê┘â╪ز┘è┘ ╪┤╪╣╪د╪▒"
              className="w-10 h-10 object-contain"
              width={40}
              height={40}
              decoding="async"
            />
          </picture>
          <span className="font-bold text-xl tracking-tight text-white">╪│┘ê┘â╪ز┘è┘</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/auth?mode=signin')}
            className="px-4 py-2 text-white hover:text-brand-cyan transition-colors font-medium"
          >
            ╪ز╪│╪ش┘è┘ ╪د┘╪»╪«┘ê┘
          </button>
          <button
            onClick={() => navigate('/auth?mode=signup')}
            className="px-5 py-2 bg-brand-cyan hover:bg-brand-cyan-light text-brand-darker font-bold rounded-lg transition-all"
          >
            ╪د╪ذ╪»╪ث
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="w-full max-w-[450px] md:max-w-[650px] lg:max-w-[800px] px-4 sm:px-6 py-4 flex flex-col items-center relative gap-8">

        {/* Hero Section */}
        <section className="text-center opacity-0 animate-fade-in-up animation-delay-200">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-[1.5] mb-5 text-white max-w-[600px] lg:max-w-[800px] mx-auto tracking-normal" style={{ wordSpacing: '0.2em' }}>
            ┘â┘è┘ ╪ز┘é╪»╪▒ <span className="text-brand-cyan">╪ز╪▓┘è╪» ┘à╪ذ┘è╪╣╪د╪ز</span> ┘à╪ز╪ش╪▒┘â ╪د┘╪د┘┘â╪ز╪▒┘ê┘┘è
          </h1>
          <p className="text-brand-gray text-lg md:text-xl leading-relaxed font-medium max-w-[550px] mx-auto tracking-tight">
            ╪ز┘╪▒╪ش ╪د┘┘┘è╪»┘è┘ê ┘┘ê╪╖╪ر ╪ذ╪د╪┤ ╪ز╪╣╪▒┘ ┘â┘è┘ ╪ص┘╪ذ┘┘ê ╪│╪│╪ز┘à ┘à╪ذ┘è╪╣╪د╪ز ┘┘à╪ز╪ش╪▒┘â ╪د┘╪د┘╪ز╪▒┘ê┘┘è
          </p>
        </section>

        {/* Video Section */}
        <section
          className="relative w-full opacity-0 animate-fade-in-up animation-delay-400 group"
          onMouseEnter={handleVideoHover}
          onTouchStart={handleVideoHover}
        >
          {/* Glow behind video */}
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-cyan to-brand-accent rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition duration-500"></div>

          <div 
            ref={videoContainerRef}
            className={`relative w-full bg-[#000] rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video ${!isVideoPlaying ? 'cursor-pointer group' : ''}`}
            onClick={!isVideoPlaying ? handleVideoClick : undefined}
          >
            {!isVideoPlaying ? (
               <>
                 <img 
                   src="/video-thumbnail.webp" 
                   alt="Soctiv Video Presenter"
                   className="w-full h-full object-cover transition-opacity hover:opacity-90"
                   fetchPriority="high"
                 />
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="w-16 h-12 md:w-20 md:h-14 bg-brand-cyan hover:bg-brand-cyan-light rounded-xl flex items-center justify-center transition-all transform group-hover:scale-110 shadow-[0_0_20px_rgba(0,188,212,0.6)]">
                     <Play className="text-brand-darker fill-brand-darker w-6 h-6 md:w-8 md:h-8 ml-1" />
                   </div>
                 </div>
               </>
            ) : (
               <>
                 {/* Loading spinner while iframe connects */}
                 {!iframeLoaded && (
                   <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                     <div style={{ width: 40, height: 40, border: '3px solid rgba(0,188,212,0.3)', borderTopColor: '#00bcd4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                   </div>
                 )}
                 <iframe
                   src="https://fast.wistia.net/embed/iframe/fqsot50ggc?autoPlay=true&playButton=false&controlsVisibleOnLoad=true&qualityControl=true"
                   title="Soctiv Video Presenter"
                   allow="autoplay; fullscreen"
                   allowFullScreen
                   frameBorder="0"
                   scrolling="no"
                   name="wistia_embed"
                   onLoad={() => setIframeLoaded(true)}
                   style={{
                     position: 'absolute',
                     top: 0,
                     left: 0,
                     width: '100%',
                     height: '100%',
                     border: 'none',
                   }}
                 />
               </>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full flex flex-col items-center opacity-0 animate-fade-in-up animation-delay-600">
           <button
             onClick={() => navigate('/auth')}
             className="w-full max-w-[320px] md:max-w-[400px] bg-gradient-to-r from-brand-cyan to-brand-accent hover:from-brand-cyan-light hover:to-brand-cyan text-brand-darker font-extrabold text-xl md:text-2xl py-4 md:py-5 px-8 rounded-2xl shadow-glow-cyan transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
           >
             <span>╪د╪╖┘╪ذ ╪│╪│╪ز┘à ╪د┘┘à╪ذ┘è╪╣╪د╪ز ╪د┘╪ت┘</span>
             <ChevronRight className="h-6 w-6 md:h-7 md:w-7" />
           </button>
          <p className="mt-4 text-brand-gray text-sm md:text-base font-medium">┘à╪ذ┘è╪╣╪د╪ز ╪ز╪▓┘è╪» ┘è┘ê┘à┘è╪د┘ï╪î ╪▒╪│╪د╪خ┘ ╪ز┘é┘</p>
        </section>

        {/* Features Section - Below the fold, lazy render */}
        <section
          className="w-full opacity-0 animate-fade-in-up animation-delay-600 mb-12"
          style={{ contentVisibility: 'auto' }}
        >
          <div className="w-full premium-blur border border-white/10 rounded-3xl p-6 md:p-8 lg:p-10 shadow-inner">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-white relative flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-cyan rounded-full"></span>
              ┘à╪د╪░╪د ╪ز╪ص╪╡┘╪ا
            </h2>

             <ul className="space-y-6 md:space-y-8">
               <li className="flex items-start gap-4">
                 <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                   <CheckCircle2 className="h-6 w-6 md:h-7 md:w-7" />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-bold text-white text-lg md:text-xl mb-1">╪ح╪»╪د╪▒╪ر ╪ز╪│┘ê┘è┘é┘è╪ر ┘à╪ز┘â╪د┘à┘╪ر</h3>
                   <p className="text-brand-gray leading-relaxed md:text-lg">
                     ┘╪ز┘ê┘┘ë ╪╡┘╪د╪╣╪ر ╪د┘┘à╪ص╪ز┘ê┘ë ╪د┘╪ح╪╣┘╪د┘┘è ╪ذ╪د┘┘â╪د┘à┘ ┘╪ش╪░╪ذ ┘╪خ╪ز┘â ╪د┘┘à╪│╪ز┘ç╪»┘╪ر╪î ┘à┘à╪د ┘è╪╣┘┘è┘â ┘à┘ ╪ز╪╣┘é┘è╪»╪د╪ز ╪د┘╪ز╪│┘ê┘è┘é ┘ê┘è╪╢┘à┘ ┘┘â ╪ز╪»┘┘é ╪د┘╪╣┘à┘╪د╪ة.
                   </p>
                 </div>
               </li>

               <li className="flex items-start gap-4">
                 <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                   <Settings2 className="h-6 w-6 md:h-7 md:w-7" />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-bold text-white text-lg md:text-xl mb-1">╪ث╪ز┘à╪ز╪ر ╪╣┘à┘┘è╪ر ╪د┘╪ذ┘è╪╣</h3>
                   <p className="text-brand-gray leading-relaxed md:text-lg">
                     ╪ز┘ê┘┘è╪▒ ╪╡┘╪ص╪ر ┘ç╪ذ┘ê╪╖ ╪ز╪ز┘ê┘┘ë ╪د┘╪▒╪» ╪╣┘┘ë ╪د╪│╪ز┘╪│╪د╪▒╪د╪ز ╪د┘╪╣┘à┘╪د╪ة ┘ê╪ز╪╡┘┘è╪ز┘ç┘à╪î ┘╪ز╪│╪ز┘┘à ╪╖┘╪ذ╪د╪ز ╪ش╪د┘ç╪▓╪ر ╪ذ╪ذ┘è╪د┘╪د╪ز ┘â╪د┘à┘╪ر ╪»┘ê┘ ╪د┘╪║╪▒┘é ┘┘è ╪▒╪│╪د╪خ┘ "╪د┘┘à╪│┘╪ش╪▒" ╪║┘è╪▒ ╪د┘╪ش╪د╪»╪ر.
                   </p>
                 </div>
               </li>

               <li className="flex items-start gap-4">
                 <div className="mt-1 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                   <Phone className="h-6 w-6 md:h-7 md:w-7" />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-bold text-white text-lg md:text-xl mb-1">╪ز╪ث┘â┘è╪» ╪د┘╪╖┘╪ذ╪د╪ز</h3>
                   <p className="text-brand-gray leading-relaxed md:text-lg">
                     ┘╪▒┘è┘é ┘à╪«╪ز╪╡ ┘è╪ز┘ê╪د╪╡┘ ┘ç╪د╪ز┘┘è╪د┘ï ┘à╪╣ ╪د┘╪╣┘à┘╪د╪ة ┘╪ز╪ث┘â┘è╪» ╪ش╪»┘è╪ز┘ç ┘é╪ذ┘ ╪د┘╪┤╪ص┘╪î ┘à┘à╪د ┘è┘é┘┘ ┘à┘ ┘╪│╪ذ ╪د┘┘ç╪»╪▒ ╪د┘┘à╪د┘┘è ┘ê╪د┘╪╖┘╪ذ╪د╪ز ╪د┘┘ê┘ç┘à┘è╪ر.
                   </p>
                 </div>
               </li>
             </ul>
          </div>
        </section>

      </main>

      {/* Cookie Consent Notice */}
      <div className="w-full max-w-[700px] px-4 py-4 text-center text-brand-gray text-xs">
        ╪ذ╪د╪│╪ز╪«╪»╪د┘à┘â ┘┘┘à┘ê┘é╪╣ ┘ê┘à╪┤╪د┘ç╪»╪ر ╪د┘┘à╪ص╪ز┘ê┘ë╪î ╪ث┘╪ز ╪ز┘ê╪د┘┘é ╪╣┘┘ë ╪د╪│╪ز╪«╪»╪د┘à ┘à┘┘╪د╪ز ╪ز╪╣╪▒┘è┘ ╪د┘╪د╪▒╪ز╪ذ╪د╪╖ ┘╪ز╪«╪╡┘è╪╡ ╪ز╪ش╪▒╪ذ╪ز┘â ╪د┘╪ح╪╣┘╪د┘┘è╪ر.
      </div>

      <footer className="w-full py-8 text-center text-brand-gray text-xs border-t border-white/5 mt-auto">
        <div className="flex flex-col items-center gap-2">
          <p>&copy; 2026 ╪│┘ê┘â╪ز┘è┘. ╪ش┘à┘è╪╣ ╪د┘╪ص┘é┘ê┘é ┘à╪ص┘┘ê╪╕╪ر.</p>
          <a
            href="/privacy-policy"
            className="text-brand-gray hover:text-brand-cyan transition-colors"
          >
            ╪│┘è╪د╪│╪ر ╪د┘╪«╪╡┘ê╪╡┘è╪ر
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
