/**
 * Marketing Angles Library — Schwartz's 5 Levels of Market Awareness
 * (Based on Eugene Schwartz, *Breakthrough Advertising*)
 *
 * This is the canonical catalog of 30 proven marketing angles — 6 per
 * awareness level. The AI prompt for Product DNA generation (Step 3)
 * injects this catalog as the reference palette, then asks the model to
 * pick 5–6 distinct angles per level and craft Arabic angle names +
 * reasoning specific to the product.
 *
 * The exported `AwarenessLevel` mirror keeps the catalog usable as a
 * typed constant in UI code (e.g. to label a level, to filter angles,
 * to show "what could go here" in a manual picker).
 */
import type { AwarenessLevel } from '@/types/productDNA';

// ─── Public types ──────────────────────────────────────────────────────────

export interface MarketingAngleTemplate {
    /** Stable slug, used as code-level identifier and React key. */
    id: string;
    /** Awareness level this angle is designed to target. */
    level: AwarenessLevel;
    /** Short Arabic display name of the angle. */
    name: string;
    /** The psychological mechanism that makes the angle work (Arabic). */
    mechanism: string;
    /** Reusable Arabic headline template with `{placeholders}`. */
    headlineTemplate: string;
    /** Concrete example hook written in Arabic for clarity. */
    exampleHook: string;
    /** When this angle is the right pick (Arabic). */
    whenToUse: string;
    /** When this angle is the wrong pick (Arabic). */
    whenNotToUse: string;
}

// ─── Level 1: Unaware (most sophisticated) ────────────────────────────────
// العميل لا يعلم أن لديه مشكلة أصلاً — أو لا يعترف بها.
// المهمة: خلق رغبة كامنة أو هزّ صورته عن نفسه.

const UNAWARE_ANGLES: readonly MarketingAngleTemplate[] = [
    {
        id: 'unaware_mass_desire',
        level: 'unaware',
        name: 'تضخيم الرغبة الكامنة',
        mechanism:
            'كل إنسان يحمل رغبة نائمة لم يستثمرها بعد (جمال، ثروة، مكانة، صحة). الزاوية تضخّم هذه الرغبة حتى يصير عدم الفعل مؤلمًا.',
        headlineTemplate: 'تخيّل لو أن {النتيجة المرجوة} أصبحت جزءاً طبيعياً من حياتك كل يوم…',
        exampleHook: 'بشرة مشرقة لا تحتاج إلى فلاتر — تخيّل وأنت تستعدّ لمناسبة مهمة…',
        whenToUse: 'منتجات استهلاكية تلامس رغبة عاطفية أو اجتماعية (جمال، صحة، ثقة، مكانة).',
        whenNotToUse: 'منتجات B2B تقنية، أو جمهور واعٍ جداً بمشكلته (استخدم Problem Aware).',
    },
    {
        id: 'unaware_identity_flip',
        level: 'unaware',
        name: 'قلب الهوية',
        mechanism:
            'بدلاً من بيع المنتج، نُري العميل أنه ليس الشخص الذي يظنّه. "أنت لستِ كسولة… أنتِ تعبتِ من نظام فاشل."',
        headlineTemplate: 'لستَ {الصورة القديمة}… أنتَ {الهوية الحقيقية}، فقط لم تكتشفها بعد.',
        exampleHook: 'لستِ أمّاً مهملة — أنتِ تبحثين عن نظام يختصر عليكِ 3 ساعات يومياً.',
        whenToUse: 'منتجات تساعد العميل على الانتقال من هوية "مكسورة" إلى هوية "مرغوبة".',
        whenNotToUse: 'منتجات تحل مشكلة تقنية واضحة لا تحتاج إعادة تأطير.',
    },
    {
        id: 'unaware_new_era',
        level: 'unaware',
        name: 'آلية العصر الجديد',
        mechanism:
            '"العالم تغيّر، والقواعد القديمة لم تعد تعمل." نُظهر أن ما اعتاد العميل فعله لم يعد كافياً — فيبحث عن حلّ جديد.',
        headlineTemplate: 'في عالم {السنة}، الطريقة القديمة في {السلوك} لم تعد تعمل. هذا ما يعمل الآن.',
        exampleHook: 'في عالم 2026، دفتر المهام لم يعد كافياً — هذا هو النظام الذي يستخدمه المؤسسون.',
        whenToUse: 'منتجات تطرح طريقة جديدة فعلاً، أو تُعيد تعريف مجال قائم.',
        whenNotToUse: 'منتجات تقليدية معروفة جيداً (استخدم Product Aware).',
    },
    {
        id: 'unaware_status_quo_break',
        level: 'unaware',
        name: 'كسر الوضع الراهن',
        mechanism:
            'نُسمّم الراحة. نُظهر أن "الروتين اليومي" الذي يتبعه العميل ليس عادياً — بل هو المشكلة بلبوس آخر.',
        headlineTemplate: 'كل يوم تستمر في {السلوك الخاطئ}، تبتعد خطوة عن {النتيجة المرجوة}.',
        exampleHook: 'كل صباح تتناولين نفس وجبة الإفطار، تظنينها صحية… وهي تُبطئ حرق الدهون.',
        whenToUse: 'منتجات تأتي بديلاً لعادات شائعة (صحة، مال، إنتاجية).',
        whenNotToUse: 'منتجات مكملة لروتين قائم (لا تحارب الروتين).',
    },
    {
        id: 'unaware_hidden_secret',
        level: 'unaware',
        name: 'السر المخفي',
        mechanism:
            'كل إنسان يحب أن يكتشف شيئاً لا يعرفه الآخرون. الزاوية تقدّم "معلومة محجوبة" تجعله يشعر بالتميز.',
        headlineTemplate: 'سرٌّ لا تُخبر به {السلطة/الخبراء} أحداً: {المعلومة المخفية}.',
        exampleHook: 'السرّ الذي تُخفيه شركات العناية بالشعر: 90% من الشامبو يُتلف شعرك بدل أن ينفعه.',
        whenToUse: 'منتجات تكشف حقيقة مدفونة في الصناعة، أو تستند إلى دراسات غير مشهورة.',
        whenNotToUse: 'منتجات لا تملك فعلاً "سراً" — ستبدو كذباً.',
    },
    {
        id: 'unaware_future_cast',
        level: 'unaware',
        name: 'الإسقاط المستقبلي',
        mechanism:
            'نرسم صورة واضحة لمُستقبلين محتملين: واحد لمن يتكيف مع التغيّر، وواحد لمن يبقى مكانه. العميل يختار بنفسه.',
        headlineTemplate: 'بعد {المدة}، هناك فئتان من الناس: من {تبنّى الجديد}، ومن {بقي في القديم}.',
        exampleHook: 'بعد 5 سنوات، هناك من يقرأ بالذكاء الاصطناعي أسرع 10 مرات، ومن لا يزال يقرأ كما في 2010.',
        whenToUse: 'منتجات تُسرّع منحنى تعلّم، أو تُدخل العميل في موجة جديدة مبكراً.',
        whenNotToUse: 'منتجات لا ترتبط باتجاه مستقبلي واضح (تجنّب الإسقاط الكاذب).',
    },
];

// ─── Level 2: Problem Aware ────────────────────────────────────────────────
// العميل يعلم أن لديه مشكلة لكنه لا يعرف بوجود حلول — أو لا يثق بها.

const PROBLEM_AWARE_ANGLES: readonly MarketingAngleTemplate[] = [
    {
        id: 'problem_aware_amplify',
        level: 'problem_aware',
        name: 'تضخيم الألم',
        mechanism:
            'العميل يعلم بالمشكلة لكنه تعوّد عليها. الزاوية تجعله يشعر بحجمها الحقيقي — كل يوم يمرّ هو خسارة صامتة.',
        headlineTemplate: '{الإحساس بالألم} الذي تتعايش معه كل يوم يكلّفك {الخسارة الحقيقية}.',
        exampleHook: 'التعب الذي تتعايش معه صباحاً ليس طبيعياً — يكلّفك 14 ساعة إنتاجية أسبوعياً.',
        whenToUse: 'العميل يظنّ أن "هذه الحياة"، أو "هذا طبيعي". هدفنا: كسر اللامبالاة.',
        whenNotToUse: 'العميل في حالة ألم حاد أصلاً (لا تحتاج تضخيم — استخدم Cost of Inaction).',
    },
    {
        id: 'problem_aware_rediagnose',
        level: 'problem_aware',
        name: 'إعادة التشخيص',
        mechanism:
            'العميل يظنّ أن مشكلته (X) لكنها في الحقيقة (Y). نُعيد تسمية الألم ليفتح الباب لحلّ جديد لم يفكر فيه.',
        headlineTemplate: 'تظنّ أن مشكلتك هي {X}؟ الحقيقة أنها {Y} — ولهذا لم تنجح الحلول السابقة.',
        exampleHook: 'تظنّ أن بشرتك دهنية؟ الحقيقة أن حاجز رطوبتك مدمّر — ولهذا الكريمات لا تنفع.',
        whenToUse: 'منتجات تعالج السبب الجذري لا العرض، خصوصاً حين فشلت حلول سطحية مع العميل.',
        whenNotToUse: 'منتجات سطحية فعلاً (تعيد التشخيص ثم تقدّم حلاً سطحياً — لا منطق).',
    },
    {
        id: 'problem_aware_enemy',
        level: 'problem_aware',
        name: 'تحديد العدو',
        mechanism:
            'إعطاء العميل "عدواً" خارجياً يُلومه بدلاً من نفسه، يُحرّره من الذنب ويجعله مستعداً للحلّ.',
        headlineTemplate: 'المشكلة ليست أنت — إنها {العدو/المؤامرة/العنصر الخفي}.',
        exampleHook: 'وزنك الزائد ليس كسلاً — إنما هرمونات تتلاعب بك. لستَ ضعيفاً، بل مستهدف.',
        whenToUse: 'منتجات تُصحّح خطأً شائعاً صناعياً (شامبو، صابون، مكملات، أغذية).',
        whenNotToUse: 'حين يكون العدو هو العميل نفسه فعلاً (العادة السيئة) — الزاوية ستفشل أخلاقياً.',
    },
    {
        id: 'problem_aware_cost_of_inaction',
        level: 'problem_aware',
        name: 'تكلفة عدم الفعل',
        mechanism:
            'الإنسان يُقدّر الخسارة أكثر من الربح. الزاوية تحوّل "عدم الشراء" إلى خسارة مادية أو زمنية أو صحية واضحة.',
        headlineTemplate: 'كل شهر تتأخر = {خسارة محددة} بدون أن تدري.',
        exampleHook: 'كل شهر تتأخر في ترتيب ميزانيتك = 800 دينار تختفي في مصاريف لا تتذكرها.',
        whenToUse: 'منتجات لها عائد اقتصادي/زمني واضح يمكن حسابه.',
        whenNotToUse: 'منتجات عاطفية أو ترفيهية بحتة (لا تحوّل المتعة لرقم).',
    },
    {
        id: 'problem_aware_shock_stat',
        level: 'problem_aware',
        name: 'الإحصائية الصادمة',
        mechanism:
            'رقم صادم يجعل المشكلة "حقيقية" في ذهن العميل. الأفضل أن يكون الرقم محدداً ومصدره واضحاً.',
        headlineTemplate: '{إحصائية صادمة} — وأنت واحد منهم إن لم تغيّر شيئاً الآن.',
        exampleHook: '73% من رواد الأعمال يخسرون 3 ساعات يومياً في رسائل البريد — وأنت واحد منهم.',
        whenToUse: 'منتجات تُصحّح مشكلة شائعة لها رقم موثّق (مصادر رسمية أو دراسات).',
        whenNotToUse: 'حين لا تملك رقم حقيقي — اختلاق الإحصائيات يدمر الثقة فوراً.',
    },
    {
        id: 'problem_aware_cascade',
        level: 'problem_aware',
        name: 'تسلسل العواقب',
        mechanism:
            'المشكلة ليست معزولة — هي تتفرّع إلى 3-5 مجالات أخرى من حياة العميل. نُريه الخريطة الكاملة.',
        headlineTemplate: 'مشكلتك في {المجال 1} ليست وحدها — إنها السبب في {المجال 2} و{المجال 3} و{المجال 4}.',
        exampleHook: 'أرقك ليس مشكلة نوم فقط — هو السبب في قلة تركيزك، وزيادتك 4 كيلو، وتوترك مع فريقك.',
        whenToUse: 'منتجات تحلّ مشكلة "جذرية" (نوم، هرمونات، توتر) تتفرّع لأعراض أخرى.',
        whenNotToUse: 'منتجات سطحية لا تتفرّع لأعراض أخرى (لا تبالغ بالربط).',
    },
];

// ─── Level 3: Solution Aware ──────────────────────────────────────────────
// العميل يعرف أن حلولاً موجودة — لكنه لم يختر منتجك بعد.

const SOLUTION_AWARE_ANGLES: readonly MarketingAngleTemplate[] = [
    {
        id: 'solution_aware_mechanism',
        level: 'solution_aware',
        name: 'آلية جديدة ومحسّنة',
        mechanism:
            '"كل الحلول القديمة تعمل بنفس الطريقة. حلّنا يعمل بطريقة مختلفة جوهرياً." نُظهر التمايز الميكانيكي.',
        headlineTemplate: 'كل المنتجات في السوق تعتمد على {الآلية القديمة}. نحن نستخدم {الآلية الجديدة}.',
        exampleHook: 'كل كريمات الترطيب ترطّب من الخارج. كريمنا يخترق طبقات الجلد ويُجدّد حاجز الرطوبة من الداخل.',
        whenToUse: 'حين يكون لديك فعلاً آلية مختلفة أو محسّنة موثّقة.',
        whenNotToUse: 'حين لا يوجد فرق ميكانيكي حقيقي — سيبدو ادعاء فارغاً.',
    },
    {
        id: 'solution_aware_process',
        level: 'solution_aware',
        name: 'كشف الآلية',
        mechanism:
            'العميل يريد أن يفهم "كيف يعمل" قبل أن يشتري. نكشف الخطوات الداخلية بشكل يبني ثقة بالذكاء الهندسي للمنتج.',
        headlineTemplate: 'كيف يعمل {المنتج} فعلاً — في 3 خطوات فقط.',
        exampleHook: 'كيف يُزيل 90% من البكتيريا في 30 ثانية: مستخلص طبيعي يكسر جدار الخلية بدون كيماويات.',
        whenToUse: 'منتجات تقنية أو علمية (تقنية، مستحضرات، مكملات، برمجيات).',
        whenNotToUse: 'منتجات بسيطة لا تحتاج كشفاً معمّقاً (تبدو مبالغة).',
    },
    {
        id: 'solution_aware_compare',
        level: 'solution_aware',
        name: 'المقارنة المتفوقة',
        mechanism:
            'جدول أو قائمة مقارنة صريحة تُظهر لماذا منتجنا أفضل من 3 بدائل معروفة. الشفافية تبني ثقة.',
        headlineTemplate: '{منتجنا} مقابل {المنافس 1}، {المنافس 2}، {المنافس 3} — الحقيقة بالأرقام.',
        exampleHook: 'مقارنة شفافة: لماذا مرطبنا يدوم 24 ساعة مقابل 3 ساعات للمنافسين؟',
        whenToUse: 'منتجات لها ميزة قابلة للقياس على المنافسين.',
        whenNotToUse: 'حين لا تملك فعلاً ميزة قابلة للقياس (تجنّب المقارنة الكاذبة).',
    },
    {
        id: 'solution_aware_niche',
        level: 'solution_aware',
        name: 'التخصص في الشريحة',
        mechanism:
            '"مصمّم خصيصاً لـ[شريحة دقيقة]، لا للجميع." هذا الإحساس بالحصرية والاختصاص يتفوّق على المنتجات العامة.',
        headlineTemplate: 'لسنا للجميع. نحن لـ{شريحة دقيقة} فقط — ولهذا نتفوّق على العامة.',
        exampleHook: 'كريم مصمَّم خصيصاً للبشرة العربية في مناخ الخليج — لا تحتاج ترطيب غربي ثقيل.',
        whenToUse: 'منتجات مُصمّمة لشريحة جغرافية/ديموغرافية/مهنية محددة.',
        whenNotToUse: 'منتجات عامة فعلاً (لا تختلق تخصصاً).',
    },
    {
        id: 'solution_aware_risk',
        level: 'solution_aware',
        name: 'إزالة المخاطرة',
        mechanism:
            'العميل يعرف الحلّ لكنه يخاف من المخاطرة. نُقدّم ضمانات تُلغي أسوأ سيناريو في ذهنه.',
        headlineTemplate: 'الخوف من {المخاطرة}؟ إليك لماذا {الحل البديل/الضمان}.',
        exampleHook: 'الخوف من تساقط الشعر بعد البروتين؟ تركيبتنا نباتية 100% — لا تساقط، أو نسترد أموالك.',
        whenToUse: 'منتجات يُخاف من آثارها الجانبية (مستحضرات، أدوية، استثمار).',
        whenNotToUse: 'منتجات لا تملك ضماناً حقيقياً (لا تَعِد بشيء لا تقدر عليه).',
    },
    {
        id: 'solution_aware_speed',
        level: 'solution_aware',
        name: 'ضغط الوقت/الجهد',
        mechanism:
            '"نفس النتيجة — في عُشر الوقت." هذا الوعد القوي يتفوّق على الجودة حين يكون الوقت سلعة نادرة.',
        headlineTemplate: 'نفس نتيجة {المنافس} — في {نسبة} من الوقت/الجهد.',
        exampleHook: 'نفس نتيجة جلسات المساج العميقة — في 7 دقائق في البيت، مرة في الأسبوع.',
        whenToUse: 'منتجات أسرع أو أسهل من حلول قائمة (تطبيق، جهاز منزلي، خدمة سريعة).',
        whenNotToUse: 'منتجات بطيئة فعلاً (سرعة زائفة تدمرك لاحقاً).',
    },
];

// ─── Level 4: Product Aware ────────────────────────────────────────────────
// العميل يعرف منتجك لكنه غير مقتنع — يحتاج دليلاً.

const PRODUCT_AWARE_ANGLES: readonly MarketingAngleTemplate[] = [
    {
        id: 'product_aware_testimonial',
        level: 'product_aware',
        name: 'الشهادة الحقيقية',
        mechanism:
            'العميل يثق بشخص مثله أكثر من العلامة التجارية. شهادة حقيقية ومفصّلة (مع اسم وصورة وسياق) أقوى من أي ادعاء.',
        headlineTemplate: '"{اقتباس حقيقي من العميل}" — {الاسم}، {الموقع/المهنة}.',
        exampleHook: '"كنت أصرف 200 دينار شهرياً على المنظفات. اليوم أنظف بيتي كله بـ45 دينار." — أم أحمد، طرابلس.',
        whenToUse: 'لديك شهادات حقيقية من عملاء بقصص مفصّلة ونتائج قابلة للقياس.',
        whenNotToUse: 'شهادات ضعيفة أو مكررة (تمحو الثقة أسرع من بنائها).',
    },
    {
        id: 'product_aware_case_study',
        level: 'product_aware',
        name: 'دراسة الحالة بالأرقام',
        mechanism:
            'قصة عميل من البداية للنهاية: المشكلة، الحل، النتيجة بالأرقام. هذا العمق يبني إقناعاً لا تستطيع الإعلانات الوصول إليه.',
        headlineTemplate: 'كيف حقق {العميل} {نتيجة قابلة للقياس} في {المدة} باستخدام {المنتج}.',
        exampleHook: 'كيف رفعت "متجر ليلى" مبيعاتها 47% في 60 يوماً — خطوة بخطوة.',
        whenToUse: 'منتجات B2B، خدمات استشارية، منتجات باهظة تتطلب تفكيراً.',
        whenNotToUse: 'منتجات رخيصة سريعة الشراء (الإفراط في التفصيل يحبط العميل).',
    },
    {
        id: 'product_aware_guarantee',
        level: 'product_aware',
        name: 'الضمان القوي',
        mechanism:
            'ضمان واضح وصادم يُلغي المخاطرة. كلما كان الضمان أطول وأوضح، كلما زاد معدل التحويل.',
        headlineTemplate: 'استخدم {المنتج} لـ{المدة}. إن لم تحصل على {النتيجة} — نعيد لك {شكل الاسترداد}.',
        exampleHook: 'جرّب المنصّة 90 يوماً. إن لم تضفف أرباحك — نعيد لك كل ريال، بدون أسئلة.',
        whenToUse: 'منتجات لها ضمان حقيقي وقوي تقدر الشركة على الوفاء به.',
        whenNotToUse: 'منتجات لا تملك ضماناً قوياً (لا تَعِد بغير ما تقدر عليه).',
    },
    {
        id: 'product_aware_risk_reverse',
        level: 'product_aware',
        name: 'عكس المخاطرة',
        mechanism:
            'ننقل كل عبء المخاطرة من العميل إلى الشركة. "أنت لا تخسر شيئاً — فقط إذا لم ينجح، وهذا احتمال 1%."',
        headlineTemplate: 'المخاطرة علينا، النتيجة لك. هذا هو العرض الوحيد من نوعه.',
        exampleHook: 'اشترك الآن. لم يعجبك خلال 30 يوماً؟ نلغي الاشتراك ونرجع لك 100%.',
        whenToUse: 'منتجات جديدة في السوق، أو تحتاج لكسر حاجز الثقة الأول.',
        whenNotToUse: 'منتجات معروفة جداً (الضمان لن يضيف جديداً).',
    },
    {
        id: 'product_aware_authority',
        level: 'product_aware',
        name: 'السلطة المتخصصة',
        mechanism:
            'تأييد من خبير/مؤسسة معروفة ينقل الثقة فوراً. السلطة يجب أن تكون ذات صلة بمجال المنتج.',
        headlineTemplate: 'يستخدمه {الخبير/المؤسسة}. يوصي به {المؤسسة الطبية/الفنية}.',
        exampleHook: 'يُوصى به من قبل 12 طبيب جلدية في ليبيا. معتمد من منظمة الصحة العالمية.',
        whenToUse: 'لديك تأييد حقيقي من خبير/مؤسسة ذات صلة.',
        whenNotToUse: 'تأييد غير ذي صلة (طبيب يُوصي بشامبو لن يفيد).',
    },
    {
        id: 'product_aware_before_after',
        level: 'product_aware',
        name: 'التحوّل قبل/بعد',
        mechanism:
            'رحلة العميل الكاملة من نقطة الألم إلى النتيجة. التحوّل الواضح يصنع إقناعاً بصرياً وعاطفياً.',
        headlineTemplate: 'قبل {المنتج}: {الوضع المؤلم}. بعد {المدة}: {النتيجة المذهلة}.',
        exampleHook: 'قبل: شعر متكسّر وجاف. بعد 21 يوماً: شعر ناعم لامع، 4 سم نمو.',
        whenToUse: 'منتجات لها نتائج بصرية/جسدية واضحة (تجميل، لياقة، صحة، أعمال).',
        whenNotToUse: 'منتجات لها نتائج غير مرئية (خدمات معرفية بحتة).',
    },
];

// ─── Level 5: Most Aware ──────────────────────────────────────────────────
// العميل يعرف المنتج وعلى وشك الشراء — يحتاج دفعة أخيرة.

const MOST_AWARE_ANGLES: readonly MarketingAngleTemplate[] = [
    {
        id: 'most_aware_scarcity',
        level: 'most_aware',
        name: 'الندرة المحدودة',
        mechanism:
            '"لم يتبقَّ سوى 3 قطع / العرض ينتهي بعد ساعتين." الندرة الحقيقية تدفع العميل لاتخاذ القرار فوراً.',
        headlineTemplate: 'بقيت {عدد} وحدة فقط / ينتهي العرض خلال {الوقت}.',
        exampleHook: 'بقيت 7 عبوات من هذا العرض — المخزون لن يُجدَّد قبل شهر.',
        whenToUse: 'لديك ندرة حقيقية (مخزون محدود، عرض موسمي، دفعة محدودة).',
        whenNotToUse: 'ندرة زائفة (العملاء الأذكياء يكتشفون الخدعة بسرعة).',
    },
    {
        id: 'most_aware_bonus_stack',
        level: 'most_aware',
        name: 'حزمة المكافآت',
        mechanism:
            '"اشترِ المنتج الأساسي واحصل على 3 مكافآت بقيمة 200 دولار — مجاناً." القيمة المضافة تبرّر الشراء الفوري.',
        headlineTemplate: 'اشترِ {المنتج} الآن واحصل على {المكافأة 1} + {المكافأة 2} + {المكافأة 3} — مجاناً.',
        exampleHook: 'احصل على الدورة + 3 كتب إلكترونية + جلسة استشارية مجانية — بطلب واحد.',
        whenToUse: 'لديك مكافآت ذات قيمة فعلية تقدر أن تُلحق بالمنتج الأساسي.',
        whenNotToUse: 'مكافآت بلا قيمة حقيقية (كتب قديمة، روابط مكسورة، ملفات فارغة).',
    },
    {
        id: 'most_aware_price_anchor',
        level: 'most_aware',
        name: 'مقارنة السعر/العرض',
        mechanism:
            'إظهار السعر الأصلي مشطوباً والسعر الجديد مُبرَّزاً. أو تقسيم السعر لحصص يومية صغيرة جداً.',
        headlineTemplate: 'سعر {المنتج}: {السعر}. أو {نصف السعر} شهرياً — أقل من قهوة يومياً.',
        exampleHook: '1200 دينار للسنة = 100 دينار شهرياً = 3.3 دينار يومياً — أقل من سندويتشة.',
        whenToUse: 'منتجات لها سعر يمكن تجزئته، أو لها سعر أصلي واضح للخصم.',
        whenNotToUse: 'منتجات رخيصة جداً (التجزئة تُضعف القيمة).',
    },
    {
        id: 'most_aware_reactivation',
        level: 'most_aware',
        name: 'إعادة التفعيل',
        mechanism:
            '"سبق أن أبديت اهتماماً — هذا تذكير لطيف." نُحرّك العملاء الذين تركوا سلة/سجلّوا ولم يكملوا.',
        headlineTemplate: 'لا تزال مهتماً بـ{المنتج}؟ العرض الذي رأيته لا يزال متاحاً — {السبب}.',
        exampleHook: 'المنتج الذي تصفّحته بالأمس — 3 أشخاص اشتروه منذ ذلك الحين. لا تفوّت العرض.',
        whenToUse: 'حملات إعلانية مُعاد استهدافها لمن أبدوا اهتماماً سابقاً.',
        whenNotToUse: 'عملاء جدد لم يروا المنتج من قبل (سيبدو غير مفهوم).',
    },
    {
        id: 'most_aware_loyalty',
        level: 'most_aware',
        name: 'الولاء/Dائرة النخبة',
        mechanism:
            '"أنت من عملائنا المميزين — وهذا العرض لك وحدك." الشعور بالتمييز يُعجّل القرار ويُعزّز الولاء.',
        headlineTemplate: 'عرض خاص لأعضائنا النخبة فقط: {العرض الحصري}.',
        exampleHook: 'باقة VIP الحصرية: منتجنا الأساسي + شحن سريع + دعم مباشر — لأول 50 عميل فقط.',
        whenToUse: 'لديك فعلاً قائمة عملاء حاليين يمكن تصنيفهم "نخبة".',
        whenNotToUse: 'منتج جديد بلا قاعدة عملاء (الادعاء بالتمييز سيبدو ساخراً).',
    },
    {
        id: 'most_aware_all_in_one',
        level: 'most_aware',
        name: 'الحلّ الشامل',
        mechanism:
            '"بدلاً من شراء X وY وZ، اشترِ واحداً يفعل كل شيء." توفير الجهد والوقت والمال في قرار واحد.',
        headlineTemplate: 'بدلاً من {الحل 1} + {الحل 2} + {الحل 3} = {تكلفة}… {منتجنا} يفعلها كلها بـ{سعر واحد}.',
        exampleHook: 'بدلاً من تطبيقي تحرير + منصة نشر + جدولة = 90$/شهر… منصّتنا تفعلها كلها بـ30$/شهر.',
        whenToUse: 'منتج متكامل يحلّ عدة مشاكل كان العميل يدفع لها حلولاً منفصلة.',
        whenNotToUse: 'منتج متخصص يفعل شيئاً واحداً (لا تبالغ بالشمولية).',
    },
];

// ─── Public catalog ────────────────────────────────────────────────────────

/**
 * The full Marketing Angles Library: 30 proven angles, 6 per awareness level.
 * Use this in the AI prompt (Step 3 of Product DNA) as the reference palette
 * the model should pick from when generating product-specific angles.
 */
export const MARKETING_ANGLE_CATALOG: readonly MarketingAngleTemplate[] = Object.freeze([
    ...UNAWARE_ANGLES,
    ...PROBLEM_AWARE_ANGLES,
    ...SOLUTION_AWARE_ANGLES,
    ...PRODUCT_AWARE_ANGLES,
    ...MOST_AWARE_ANGLES,
]);

/** Group the catalog by awareness level for quick lookup. */
export const ANGLES_BY_LEVEL: Readonly<Record<AwarenessLevel, readonly MarketingAngleTemplate[]>> =
    Object.freeze({
        unaware: UNAWARE_ANGLES,
        problem_aware: PROBLEM_AWARE_ANGLES,
        solution_aware: SOLUTION_AWARE_ANGLES,
        product_aware: PRODUCT_AWARE_ANGLES,
        most_aware: MOST_AWARE_ANGLES,
    });

/** Arabic display label for each awareness level (for UI use). */
export const AWARENESS_LEVEL_LABELS_AR: Readonly<Record<AwarenessLevel, string>> = Object.freeze({
    unaware: 'غير مدرك (يحتاج وعي بالمشكلة/الرغبة)',
    problem_aware: 'مدرك للمشكلة (يحتاج آلية حل)',
    solution_aware: 'مدرك للحلول (يحتاج تمايز)',
    product_aware: 'مدرك للمنتج (يحتاج دليلاً)',
    most_aware: 'على وشك الشراء (يحتاج دفعة أخيرة)',
});

/** Stable order for iterating levels in the UI. */
export const AWARENESS_LEVEL_ORDER: readonly AwarenessLevel[] = Object.freeze([
    'unaware',
    'problem_aware',
    'solution_aware',
    'product_aware',
    'most_aware',
]);

/**
 * Build a compact Arabic reference of the catalog suitable for embedding
 * in an AI system prompt. The model reads this to understand the
 * available "palette" of angles, then picks 5–6 per level tailored to
 * the specific product.
 */
export function buildAngleCatalogPromptSection(): string {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════');
    lines.push('مكتبة الزوايا التسويقية المرجعية (Schwartz 5 Levels)');
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push('لكل مستوى وعي، 6 زوايا مُجرَّبة. اختر 5–6 زوايا مميزة من كل مستوى،');
    lines.push('واجعل "angleName" و"reasoning" مخصصَين لهذا المنتج تحديداً —');
    lines.push('لا تنسخ أسماء الزوايا المرجعية حرفياً، بل استخدمها كإلهام لزاوية فريدة.');
    lines.push('');

    for (const level of AWARENESS_LEVEL_ORDER) {
        const angles = ANGLES_BY_LEVEL[level];
        lines.push(`── ${AWARENESS_LEVEL_LABELS_AR[level]} (${angles.length} زوايا مرجعية) ──`);
        angles.forEach((a, i) => {
            lines.push(`${i + 1}. ${a.name}`);
            lines.push(`   الآلية: ${a.mechanism}`);
            lines.push(`   نموذج عنوان: ${a.headlineTemplate}`);
            lines.push(`   مثال: ${a.exampleHook}`);
        });
        lines.push('');
    }

    return lines.join('\n');
}
