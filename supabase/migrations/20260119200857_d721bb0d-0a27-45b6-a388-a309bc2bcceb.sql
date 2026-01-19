-- جدول cache للأسماء المترجمة
CREATE TABLE public.name_translations (
  english_name TEXT PRIMARY KEY,
  arabic_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.name_translations ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بالقراءة
CREATE POLICY "Anyone can read translations" 
ON public.name_translations 
FOR SELECT 
USING (true);

-- السماح للمستخدمين المسجلين بالإضافة
CREATE POLICY "Authenticated can insert translations" 
ON public.name_translations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);