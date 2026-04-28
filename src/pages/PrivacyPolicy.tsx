import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="bg-brand-dark text-white min-h-screen flex flex-col items-center w-full" style={{
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility'
    }}>
      {/* Header Section */}
      <header className="w-full max-w-[700px] px-4 sm:px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img 
            src="/Soctiv-Logo.svg" 
            alt="سوكتيف شعار" 
            className="w-10 h-10 object-contain"
            width={40}
            height={40}
          />
          <span className="font-bold text-xl tracking-tight text-white">سوكتيف</span>
        </div>
        <Link 
          to="/"
          className="px-4 py-2 text-white hover:text-brand-cyan transition-colors font-medium"
        >
          العودة للرئيسية
        </Link>
      </header>

      <main className="w-full max-w-[700px] px-4 sm:px-6 py-8 flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center text-brand-cyan mb-4">
          سياسة الخصوصية
        </h1>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">تصريح بيانات Meta Pixel</h2>
          <p className="text-brand-gray leading-relaxed">
            يستخدم موقع سوكتيف أداة Meta Pixel (بيكسل فيسبوك) لجمع بيانات عن تفاعلات الزوار والمستخدمين مع الموقع. يتم جمع هذه البيانات بشكل آلي عند دخولك للموقع.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">الغرض من جمع البيانات</h2>
          <p className="text-brand-gray leading-relaxed">
            تُستخدم البيانات التي يتم جمعها عبر Meta Pixel للأغراض التالية:
          </p>
          <ul className="list-disc list-inside text-brand-gray space-y-2 pl-4">
            <li>قياس أداء الحملات الإعلانية لمنصة سوكتيف على فيسبوك وإنستغرام</li>
            <li>تحسين فعالية الإعلانات وتخصيصها بناءً على تفاعل المستخدمين</li>
            <li>فهم سلوك المستخدمين وتحسين تجربة الاستخدام للموقع</li>
            <li>تقديم محتوى وإعلانات ذات صلة باهتمامات المستخدمين</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">خيارات التحكم في البيانات</h2>
          <p className="text-brand-gray leading-relaxed">
            يمكنك التحكم في إعدادات إعلانات فيسبوك وتعديل تفضيلاتك بخصوص جمع البيانات وتخصيص الإعلانات من خلال الرابط التالي:
          </p>
          <a 
            href="https://www.facebook.com/ads/preferences" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-brand-cyan hover:underline font-medium"
          >
            إعدادات إعلانات فيسبوك
          </a>
          <p className="text-brand-gray leading-relaxed mt-2">
            من خلال هذه الصفحة يمكنك إدارة إعدادات ملفات تعريف الارتباط وتخصيص نوع الإعلانات التي تراها على منصات Meta.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">ملفات تعريف الارتباط (Cookies)</h2>
          <p className="text-brand-gray leading-relaxed">
            باستخدامك لهذا الموقع ومشاهدة المحتوى المتوفر فيه، أنت توافق على استخدام ملفات تعريف الارتباط (Cookies) والتقنيات المشابهة لجمع البيانات بهدف تحسين تجربتك وتخصيص الإعلانات التي تظهر لك.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">آخر تحديث</h2>
          <p className="text-brand-gray leading-relaxed">
            تم تحديث سياسة الخصوصية هذه في تاريخ 20 أبريل 2026.
          </p>
        </section>
      </main>

      <footer className="w-full py-8 text-center text-brand-gray/50 text-xs border-t border-white/5 mt-auto">
        &copy; 2026 سوكتيف. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
};

export default PrivacyPolicy;