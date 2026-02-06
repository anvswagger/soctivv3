import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Copy, RefreshCw, Webhook, ExternalLink, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const WebhookSettings = () => {
  const [webhookCode, setWebhookCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/facebook-leads-webhook` : '';

  useEffect(() => {
    fetchWebhookCode();
  }, [user]);

  const fetchWebhookCode = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('webhook_code')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setWebhookCode(data?.webhook_code || null);
    } catch (error) {
      console.error('Error fetching webhook code:', error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateCode = async () => {
    if (!user) return;
    
    setRegenerating(true);
    try {
      // Generate new code
      const newCode = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from('clients')
        .update({ webhook_code: newCode })
        .eq('user_id', user.id);

      if (error) throw error;

      setWebhookCode(newCode);
      toast({
        title: "تم تحديث الرمز",
        description: "تم إنشاء رمز webhook جديد. تأكد من تحديثه في Make.com",
      });
    } catch (error) {
      console.error('Error regenerating code:', error);
      toast({
        title: "خطأ",
        description: "فشل في تجديد الرمز",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: "تم النسخ",
        description: type === 'code' ? "تم نسخ رمز العميل" : "تم نسخ رابط الـ Webhook",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في النسخ",
        variant: "destructive",
      });
    }
  };

  const jsonExample = `{
  "client_code": "${webhookCode || 'YOUR_CLIENT_CODE'}",
  "full_name": "{{1.full_name}}",
  "phone": "{{1.phone_number}}",
  "source": "Facebook Lead Ads"
}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إعدادات Webhook</h1>
          <p className="text-muted-foreground mt-1">
            ربط حملات Facebook Lead Ads مع Make.com لاستقبال العملاء المحتملين تلقائياً
          </p>
        </div>

        {/* Webhook Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              بيانات الـ Webhook
            </CardTitle>
            <CardDescription>
              استخدم هذه البيانات في إعداد Make.com
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : webhookCode ? (
              <>
                <div className="space-y-2">
                  <Label>رمز العميل (Client Code)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookCode} 
                      readOnly 
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookCode, 'code')}
                    >
                      {copied === 'code' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={regenerateCode}
                      disabled={regenerating}
                    >
                      <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    هذا الرمز خاص بك، لا تشاركه مع أحد
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>رابط الـ Webhook (URL)</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookUrl} 
                      readOnly 
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl, 'url')}
                    >
                      {copied === 'url' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>لا يوجد حساب عميل مرتبط</p>
                <p className="text-sm mt-2">يرجى التواصل مع الإدارة</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>خطوات إعداد Make.com</CardTitle>
            <CardDescription>
              اتبع هذه الخطوات لربط حملات Facebook Lead Ads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">إنشاء Scenario جديد</h4>
                  <p className="text-sm text-muted-foreground">
                    ادخل إلى Make.com وأنشئ Scenario جديد
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">إضافة Facebook Lead Ads Trigger</h4>
                  <p className="text-sm text-muted-foreground">
                    ابحث عن "Facebook Lead Ads" واختر "Watch New Lead"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">إضافة HTTP Module</h4>
                  <p className="text-sm text-muted-foreground">
                    أضف "HTTP - Make a request" وقم بتعيين:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>URL: الرابط المذكور أعلاه</li>
                    <li>Method: POST</li>
                    <li>Body type: Raw</li>
                    <li>Content type: JSON (application/json)</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium">إعداد الـ Body</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    انسخ الكود التالي وعدّل المتغيرات حسب حقول Facebook:
                  </p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto" dir="ltr">
                    {jsonExample}
                  </pre>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-medium">تفعيل الـ Scenario</h4>
                  <p className="text-sm text-muted-foreground">
                    فعّل الـ Scenario وستبدأ العملاء المحتملين بالوصول تلقائياً!
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" asChild>
                <a 
                  href="https://www.make.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح Make.com
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WebhookSettings;
