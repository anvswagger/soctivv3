import { supabase } from "@/integrations/supabase/client";

// قاموس الأسماء الشائعة من الإنجليزية للعربية
const namesDictionary: Record<string, string> = {
  // أسماء الذكور
  'ali': 'علي',
  'ahmed': 'أحمد',
  'ahmad': 'أحمد',
  'mohammed': 'محمد',
  'mohamed': 'محمد',
  'muhammad': 'محمد',
  'hamza': 'حمزة',
  'omar': 'عمر',
  'khalid': 'خالد',
  'khaled': 'خالد',
  'youssef': 'يوسف',
  'yousef': 'يوسف',
  'yusuf': 'يوسف',
  'ibrahim': 'إبراهيم',
  'abdallah': 'عبدالله',
  'abdullah': 'عبدالله',
  'hassan': 'حسن',
  'hussein': 'حسين',
  'husain': 'حسين',
  'fouad': 'فؤاد',
  'fawad': 'فؤاد',
  'faisal': 'فيصل',
  'fahad': 'فهد',
  'fahd': 'فهد',
  'nasser': 'ناصر',
  'nasir': 'ناصر',
  'salim': 'سالم',
  'salem': 'سالم',
  'saeed': 'سعيد',
  'said': 'سعيد',
  'rami': 'رامي',
  'anas': 'أنس',
  'adam': 'آدم',
  'walid': 'وليد',
  'waleed': 'وليد',
  'majid': 'ماجد',
  'majed': 'ماجد',
  'tariq': 'طارق',
  'tarek': 'طارق',
  'ziad': 'زياد',
  'ziyad': 'زياد',
  'sami': 'سامي',
  'samir': 'سمير',
  'karim': 'كريم',
  'kareem': 'كريم',
  'adel': 'عادل',
  'adil': 'عادل',
  'jamal': 'جمال',
  'jamil': 'جميل',
  'nabil': 'نبيل',
  'bilal': 'بلال',
  'moustafa': 'مصطفى',
  'mustafa': 'مصطفى',
  'mustapha': 'مصطفى',
  'osama': 'أسامة',
  'usama': 'أسامة',
  'rashid': 'راشد',
  'rasheed': 'رشيد',
  'habib': 'حبيب',
  'bassam': 'بسام',
  'ismail': 'إسماعيل',
  'esmail': 'إسماعيل',

  // أسماء الإناث
  'fatima': 'فاطمة',
  'aisha': 'عائشة',
  'aysha': 'عائشة',
  'maryam': 'مريم',
  'mariam': 'مريم',
  'sarah': 'سارة',
  'sara': 'سارة',
  'layla': 'ليلى',
  'leila': 'ليلى',
  'nour': 'نور',
  'noor': 'نور',
  'hana': 'هناء',
  'hanaa': 'هناء',
  'dina': 'دينا',
  'lina': 'لينا',
  'rana': 'رنا',
  'rania': 'رانيا',
  'maya': 'مايا',
  'maha': 'مها',
  'salma': 'سلمى',
  'hoda': 'هدى',
  'huda': 'هدى',
  'amina': 'أمينة',
  'amira': 'أميرة',
  'yasmin': 'ياسمين',
  'jasmin': 'ياسمين',
  'khadija': 'خديجة',
  'zainab': 'زينب',
  'zaynab': 'زينب',

  // ألقاب شائعة
  'shaaban': 'شعبان',
  'shabaan': 'شعبان',
  'gelani': 'جيلاني',
  'jilani': 'جيلاني',
  'alekkary': 'العكاري',
  'akkary': 'العكاري',
  'jabran': 'جبران',
  'gibran': 'جبران',
  'hanish': 'حنيش',
  'hneish': 'حنيش',
};

// التحقق مما إذا كان النص يحتوي على حروف عربية
export const isArabic = (text: string): boolean => {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
};

// البحث في القاموس المحلي
const lookupDictionary = (name: string): string | null => {
  const lowerName = name.toLowerCase().trim();
  return namesDictionary[lowerName] || null;
};

// البحث في cache قاعدة البيانات
const lookupCache = async (englishName: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('name_translations')
      .select('arabic_name')
      .eq('english_name', englishName.toLowerCase().trim())
      .single();
    
    if (error || !data) return null;
    return data.arabic_name;
  } catch {
    return null;
  }
};

// حفظ في cache
const saveToCache = async (englishName: string, arabicName: string): Promise<void> => {
  try {
    await supabase
      .from('name_translations')
      .upsert({ 
        english_name: englishName.toLowerCase().trim(), 
        arabic_name: arabicName 
      }, { onConflict: 'english_name' });
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

// استدعاء AI Edge Function
const callAITransliteration = async (name: string): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('transliterate-name', {
      body: { name }
    });
    
    if (error) {
      console.error('AI transliteration error:', error);
      return name; // fallback to original
    }
    
    return data?.arabic_name || name;
  } catch (error) {
    console.error('AI transliteration error:', error);
    return name;
  }
};

// ترجمة اسم واحد باستخدام AI (مع caching)
export const translateNameWithAI = async (name: string): Promise<string> => {
  if (!name || name.trim() === '') return '';
  
  // 1. إذا كان الاسم عربي، إرجاعه مباشرة
  if (isArabic(name)) return name;
  
  // 2. البحث في القاموس المحلي (سريع)
  const dictionaryResult = lookupDictionary(name);
  if (dictionaryResult) return dictionaryResult;
  
  // 3. البحث في cache قاعدة البيانات
  const cachedResult = await lookupCache(name);
  if (cachedResult) return cachedResult;
  
  // 4. استدعاء AI للترجمة
  const aiResult = await callAITransliteration(name);
  
  // 5. حفظ النتيجة في cache للاستخدام المستقبلي
  if (aiResult && aiResult !== name) {
    await saveToCache(name, aiResult);
  }
  
  return aiResult;
};

// ترجمة الاسم الكامل (الأول + الأخير)
export const translateFullNameWithAI = async (
  firstName: string | null | undefined, 
  lastName: string | null | undefined
): Promise<{ firstName: string; lastName: string }> => {
  const translatedFirst = await translateNameWithAI(firstName || '');
  const translatedLast = await translateNameWithAI(lastName || '');
  
  return {
    firstName: translatedFirst,
    lastName: translatedLast
  };
};

// الدوال القديمة للتوافقية (synchronous - تستخدم القاموس فقط)
export const transliterateName = (name: string | null | undefined): string => {
  if (!name) return '';
  if (isArabic(name)) return name;
  
  const parts = name.split(/\s+/);
  const translatedParts = parts.map(part => {
    const dictResult = lookupDictionary(part);
    return dictResult || part;
  });
  
  return translatedParts.join(' ');
};

export const transliterateFullName = (
  firstName: string | null | undefined, 
  lastName: string | null | undefined
): string => {
  const first = transliterateName(firstName);
  const last = transliterateName(lastName);
  return `${first} ${last}`.trim();
};
