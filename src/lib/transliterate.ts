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

// تحويل اسم واحد
const translateSingleName = (name: string): string => {
  const lowerName = name.toLowerCase().trim();
  if (namesDictionary[lowerName]) return namesDictionary[lowerName];

  return heuristicTransliterate(lowerName);
};

const heuristicTransliterate = (text: string): string => {
  let res = text.toLowerCase();

  // Digraphs & Trigraphs
  res = res.replace(/kh/g, 'خ');
  res = res.replace(/gh/g, 'غ');
  res = res.replace(/sh/g, 'ش');
  res = res.replace(/th/g, 'ث');
  res = res.replace(/dh/g, 'ذ');
  res = res.replace(/ch/g, 'تش');
  res = res.replace(/ph/g, 'ف');
  res = res.replace(/ee/g, 'ي');
  res = res.replace(/oo/g, 'و');
  res = res.replace(/ou/g, 'و');

  // Single chars
  const map: Record<string, string> = {
    'a': 'ا', 'b': 'ب', 'c': 'ك', 'd': 'د', 'e': 'ي',
    'f': 'ف', 'g': 'ج', 'h': 'ه', 'i': 'ي', 'j': 'ج',
    'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن', 'o': 'و',
    'p': 'ب', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت',
    'u': 'و', 'v': 'ف', 'w': 'و', 'x': 'كس', 'y': 'ي',
    'z': 'ز', '2': 'ء', '3': 'ع', '5': 'خ', '7': 'ح', '9': 'ص'
  };

  res = res.split('').map(char => map[char] || char).join('');

  // Fix weird endings or connections if needed (very basic)
  return res;
};

// تحويل الاسم الكامل من الإنجليزية للعربية
export const transliterateName = (name: string | null | undefined): string => {
  if (!name) return '';

  // إذا كان النص عربياً، أعده كما هو
  if (isArabic(name)) return name;

  // قسّم الاسم إلى أجزاء وحوّل كل جزء
  const parts = name.split(/\s+/);
  const translatedParts = parts.map(part => translateSingleName(part));

  return translatedParts.join(' ');
};

// تحويل الاسم الأول والأخير معاً
export const transliterateFullName = (firstName: string | null | undefined, lastName: string | null | undefined): string => {
  const first = transliterateName(firstName);
  const last = transliterateName(lastName);
  return `${first} ${last}`.trim();
};
